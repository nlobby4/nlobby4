#!/usr/bin/env python3

# --------------------------------------------------
# Collect shell or project-owned third-party license notices.
#
# Uses pnpm's inventory for direct dependencies and pinned upstream tool notices.
# Does not collect transitive dependencies, install tools or initialize projects.
# Check mode verifies recorded inputs and notice bytes without network access.
#
# Usage:
# python3 scripts/python/collect-licenses.py [--check] [--project PATH]
# --------------------------------------------------

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, build_opener


ROOT = Path(__file__).resolve().parents[2]
NOTICE = re.compile(r"^(licen[sc]e|copying|copyright|notice)(?:$|[._-])", re.I)
REMOTE_FILES = (
    "LICENSE", "LICENSE.txt", "LICENSE.md", "license", "COPYING",
    "LICENSE-MIT", "LICENSE-APACHE", "NOTICE", "NOTICE.txt",
)
MAX_NOTICE = 4 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    if not value or value in {".", ".."}:
        raise ValueError("Invalid license owner identifier")
    return quote(value, safe="")


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2, ensure_ascii=False) + "\n").encode()


def command(args, cwd=ROOT, timeout=120):
    env = dict(os.environ, MISE_AUTO_INSTALL="false", MISE_NOT_FOUND_AUTO_INSTALL="false")
    result = subprocess.run(args, cwd=cwd, env=env, capture_output=True, timeout=timeout, check=False)
    if result.returncode:
        raise ValueError(f"{args[0]} failed: {result.stderr.decode(errors='replace').strip()}")
    if not result.stdout.strip():
        raise ValueError(f"{args[0]} returned no inventory")
    # pnpm 10 returns this plain-text sentinel for dependency-free projects
    if args[-3:] == ["licenses", "list", "--json"] and result.stdout.strip() == b"No licenses in packages found":
        return {}
    try:
        return json.loads(result.stdout)
    except ValueError as error:
        raise ValueError(f"{args[0]} returned invalid inventory JSON") from error


def notice_bytes(file):
    if file.is_symlink() or not file.is_file() or file.stat().st_size > MAX_NOTICE:
        raise ValueError(f"Unsafe or oversized notice: {file.name}")
    data = file.read_bytes()
    if not data.strip() or b"\0" in data:
        raise ValueError(f"Empty or binary notice: {file.name}")
    return data


def notice_files(directory):
    files = []
    for file in sorted(directory.rglob("*")):
        relative = file.relative_to(directory)
        if not file.is_file() or any(part in {"node_modules", ".git", "tests", "test"} for part in relative.parts[:-1]):
            continue
        if NOTICE.match(file.name) or "licenses" in relative.parts[:-1]:
            files.append(file)
    return files


def npm_notices(report, outputs, records):
    for expression, packages in sorted(report.items()):
        for package in packages:
            for directory in package["paths"]:
                owner = Path(directory)
                manifest = json.loads((owner / "package.json").read_text())
                if manifest["name"] != package["name"] or manifest["version"] not in package["versions"]:
                    raise ValueError("pnpm license inventory disagrees with installed package metadata")
                name, version = manifest["name"], manifest["version"]
                identity = f"npm:{name}@{version}"
                notices = []
                for file in notice_files(owner):
                    relative = file.relative_to(owner).as_posix()
                    target = f"npm/{encoded(name)}/{encoded(version)}/{relative}"
                    data = notice_bytes(file)
                    if target in outputs and outputs[target] != data:
                        raise ValueError(f"Conflicting installed notice bytes: {target}")
                    outputs[target] = data
                    notices.append(target)
                previous = records.get(identity)
                notices = sorted(set(notices + (previous["notices"] if previous else [])))
                records[identity] = {"name": name, "version": version, "license": expression, "notices": notices}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        raise ValueError("License acquisition must not follow redirects")


def download(url):
    try:
        with build_opener(NoRedirect).open(url, timeout=30) as response:
            data = response.read(MAX_NOTICE + 1)
    except HTTPError as error:
        if error.code == 404:
            return None
        raise
    if not data.strip() or len(data) > MAX_NOTICE or b"\0" in data:
        raise ValueError("Empty, oversized or binary upstream notice")
    return data


def tool_pins(root):
    config = tomllib.loads((root / "mise.toml").read_text())
    pins = {name: value if isinstance(value, str) else value["version"] for name, value in config["tools"].items()}
    bootstrap = (root / ".devcontainer/versions.env").read_text()
    match = re.search(r"^MISE_VERSION=([0-9.]+)$", bootstrap, re.M)
    if not match:
        raise ValueError("Missing exact mise bootstrap version")
    pins["mise"] = match[1]
    if any(not re.fullmatch(r"[0-9]+(?:\.[0-9]+)+", value) for value in pins.values()):
        raise ValueError("License collection requires exact tool versions")
    return pins


def primary_notices(root, outputs, records, fetch=download):
    sources = json.loads((root / "licenses/sources.json").read_text())["tools"]
    pins = tool_pins(root)
    if sources.keys() != pins.keys():
        raise ValueError("License tool sources must cover exactly the configured shell tools and mise")

    def acquire(item):
        name, version = item
        source = sources[name]
        if not re.fullmatch(r"[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+", source["repository"]) or source["tag"] not in {"v{version}", "{version}"}:
            raise ValueError("Unsafe pinned tool license source")
        base = f"https://raw.githubusercontent.com/{source['repository']}/{source['tag'].replace('{version}', version)}/"
        acquired = {}
        urls = {}
        for file in REMOTE_FILES:
            data = fetch(base + file)
            if data is not None:
                target = f"tools/{encoded(name)}/{version}/{file}"
                acquired[target] = data
                urls[target] = base + file
        if not acquired:
            raise ValueError(f"No upstream notice found for {name}@{version}")
        return name, version, acquired, urls

    with ThreadPoolExecutor(max_workers=6) as executor:
        for name, version, acquired, urls in executor.map(acquire, sorted(pins.items())):
            outputs.update(acquired)
            records[f"tool:{name}@{version}"] = {"name": name, "version": version, "notices": sorted(acquired), "sources": urls}


def direct_inventory(owners, report):
    selected = {}
    for owner in owners:
        manifest = json.loads((owner / "package.json").read_text())
        dependencies = {}
        for field in ("dependencies", "devDependencies", "optionalDependencies"):
            dependencies.update(manifest.get(field, {}))
        for name in dependencies:
            installed = owner / "node_modules" / name / "package.json"
            if not installed.is_file():
                if name in manifest.get("optionalDependencies", {}):
                    continue
                raise ValueError(f"Direct dependency is not installed: {name}")
            package = json.loads(installed.read_text())
            matched = False
            for expression, packages in report.items():
                if any(item["name"] == package["name"] and package["version"] in item["versions"] for item in packages):
                    selected.setdefault(expression, []).append({"name": package["name"], "versions": [package["version"]], "paths": [str(installed.parent)]})
                    matched = True
                    break
            if not matched:
                raise ValueError(f"Direct dependency missing from pnpm license inventory: {name}")
    return selected


def inputs(root, owner):
    files = [root / "pnpm-lock.yaml", owner / "package.json", root / "scripts/python/collect-licenses.py"]
    if owner == root:
        files += [root / file for file in ("scripts/node/package.json", "mise.toml", "mise.lock", ".devcontainer/versions.env", ".devcontainer/devcontainer.json", ".devcontainer/Dockerfile", "licenses/sources.json", "schemas/sources.lock.json", "scripts/python/collect-licenses.py")]
        files += sorted((root / ".mise/locks").rglob("*"))
    return {file.relative_to(root).as_posix(): digest(file.read_bytes()) for file in files if file.is_file()}


def collect(root, owner, run=command, fetch=download):
    manifest = json.loads((owner / "package.json").read_text())
    selectors = [manifest["name"]]
    if owner == root:
        selectors.append(json.loads((root / "scripts/node/package.json").read_text())["name"])
    args = ["pnpm"]
    for selector in selectors:
        args += ["--filter", selector]
    args += ["licenses", "list", "--json"]
    outputs, records = {}, {}
    owners = [owner, root / "scripts/node"] if owner == root else [owner]
    npm_notices(direct_inventory(owners, run(args, cwd=root)), outputs, records)
    gaps = []
    if owner == root:
        primary_notices(root, outputs, records, fetch)
        schema_lock = json.loads((root / "schemas/sources.lock.json").read_text())
        for file, expected in schema_lock["licenses"].items():
            if not re.fullmatch(r"schema/LICENSE\.[a-zA-Z0-9-]+\.txt", file) or digest((root / "licenses" / file).read_bytes()) != expected:
                raise ValueError("Schema license drift")
            outputs[file] = (root / "licenses" / file).read_bytes()
    for identity, package in records.items():
        if not package["notices"]:
            gaps.append(f"{identity}: package declares a license but ships no notice file")
    inventory = {"format": 1, "owner": owner.relative_to(root).as_posix(), "inputs": inputs(root, owner), "packages": dict(sorted(records.items())), "files": {file: digest(data) for file, data in sorted(outputs.items())}, "gaps": sorted(gaps), "coverage": "Direct Node dependencies, configured mise/bootstrap tools and schema sources only. Transitive dependencies and operating-system packages are intentionally excluded."}
    return outputs, inventory


def check(root, owner):
    folder = owner / "licenses"
    inventory = json.loads((folder / "inventory.json").read_text())
    if inventory["format"] != 1 or inventory["owner"] != owner.relative_to(root).as_posix() or inventory["inputs"] != inputs(root, owner):
        raise ValueError("License inputs drifted; run pnpm run licenses:update for the affected owner")
    for file, expected in inventory["files"].items():
        target = (folder / file).resolve()
        if not target.is_relative_to(folder.resolve()) or digest(target.read_bytes()) != expected:
            raise ValueError(f"License notice drift: {file}")
    return inventory


def main():
    parser = argparse.ArgumentParser(description="Collect owner-scoped license notices without installing tools")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--project", type=Path)
    parser.add_argument("--all-projects", action="store_true")
    args = parser.parse_args()
    if args.all_projects and args.project:
        parser.error("--all-projects cannot be combined with --project")
    owner = (ROOT / args.project).resolve() if args.project else ROOT
    if owner != ROOT and (not owner.is_relative_to(ROOT / "projects") or owner.is_relative_to(ROOT / "projects/submodules") or not (owner / "package.json").is_file()):
        parser.error("--project must select an ordinary npm project, not a submodule")
    owners = [owner]
    if args.all_projects:
        workspace = command(["pnpm", "list", "--recursive", "--depth", "-1", "--json"])
        for package in workspace:
            project = Path(package["path"]).resolve()
            if project.is_relative_to(ROOT / "projects") and not project.is_relative_to(ROOT / "projects/submodules"):
                owners.append(project)
    # Acquire all owners before writing so download failures preserve inventories
    collected = [(item, None, check(ROOT, item)) if args.check else (item, *collect(ROOT, item)) for item in owners]
    for item, outputs, inventory in collected:
        if outputs is not None:
            (item / "licenses").mkdir(parents=True, exist_ok=True)
            for file, data in outputs.items():
                target = item / "licenses" / file
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
            (item / "licenses/inventory.json").write_bytes(json_bytes(inventory))
        print(f"{inventory['owner']}: verified {len(inventory['files'])} notices across {len(inventory['packages'])} records")
        if inventory["gaps"]:
            print(f"{len(inventory['gaps'])} coverage gaps recorded in {inventory['owner']}/licenses/inventory.json", file=sys.stderr)


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print(f"License collection failed: {error}", file=sys.stderr)
        sys.exit(1)
