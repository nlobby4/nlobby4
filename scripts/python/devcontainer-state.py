#!/usr/bin/env python3
"""Record and verify image inputs without relying on Node or workspace packages.

Python 3.11's standard-library TOML parser lets us exclude mise tasks from the
image contract while retaining toolchain settings and the complete tool lock.
This is drift detection, not an attestation against a malicious container.
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

PACKAGES = ("curl", "git-lfs", "jq", "python3-venv", "yq", "gawk", "cmark-gfm")
FILES = (
    ".mise/aqua.yaml",
    ".devcontainer/Dockerfile",
    ".devcontainer/versions.env",
    ".devcontainer/checksums.sha256",
    ".devcontainer/devcontainer-lock.json",
    ".dockerignore",
    "scripts/python/devcontainer-state.py",
)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def native_locks(root):
    """Validate mise's graph digests and fingerprint their companion manifests.

    mise normalizes CRLF for native lock digests. Companion manifests are also
    image inputs, though mise's digest covers only the native lock itself.
    """
    lock = tomllib.loads((root / "mise.lock").read_text())
    if lock.get("lockfile_version") != 3:
        raise ValueError("mise native graph locking requires lockfile format 3")
    result = {}
    for entries in lock.get("tools", {}).values():
        for entry in entries:
            backend = entry.get("backend", "")
            required = "aube" if backend.startswith("npm:") else (
                "uv" if backend.startswith(("pipx:", "pypi:"))
                and entry.get("options", {}).get("uvx") == "true" else None
            )
            if required and required not in entry:
                raise ValueError(f"missing native graph: {backend}")
            for kind, names in (("aube", ("aube-lock.yaml", "package.json")),
                                ("uv", ("uv.lock", "pyproject.toml"))):
                if kind not in entry:
                    continue
                graph = entry[kind]
                directory = Path(graph["path"])
                if (directory.is_absolute() or ".." in directory.parts
                        or directory.parts[:2] != (".mise", "locks")):
                    raise ValueError(f"invalid native graph path: {directory}")
                for name in names:
                    relative = directory / name
                    target = root / relative
                    if not target.resolve().is_relative_to(root.resolve() / ".mise/locks"):
                        raise ValueError(f"native graph escapes lock directory: {relative}")
                    contents = target.read_bytes().replace(b"\r\n", b"\n")
                    digest = hashlib.sha256(contents).hexdigest()
                    if name == names[0] and graph.get("digest") != f"sha256:{digest}":
                        raise ValueError(f"native graph digest mismatch: {relative}")
                    result[str(relative)] = digest
    return result


def inputs(root):
    result = {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
              for name in FILES}
    config = json.loads((root / ".devcontainer/devcontainer.json").read_text())
    result["devcontainer image configuration"] = hashlib.sha256(canonical({
        key: config.get(key) for key in ("build", "features", "remoteUser")
    })).hexdigest()
    mise = tomllib.loads((root / "mise.toml").read_text())
    mise.pop("tasks", None)
    result["mise tool configuration"] = hashlib.sha256(canonical(mise)).hexdigest()
    result["mise.lock"] = hashlib.sha256(
        canonical(tomllib.loads((root / "mise.lock").read_text()))
    ).hexdigest()
    result.update(native_locks(root))
    return result


def tool_locks(root, check_manifest=True):
    """Check literal tool pins and frozen Linux artifacts without registry access.

    mise's dry-run JSON reports version changes only, not missing unchanged
    URL/checksum metadata. Native sidecars remain owned and checked by mise.
    """
    config = tomllib.loads((root / "mise.toml").read_text())["tools"]
    locked = tomllib.loads((root / "mise.lock").read_text())["tools"]
    if set(config) != set(locked):
        raise ValueError("mise tool declarations and lock entries differ")
    for name, value in config.items():
        version = value.get("version") if isinstance(value, dict) else value
        entries = locked[name]
        if (not isinstance(version, str) or not re.fullmatch(r"\d+(?:\.\d+)+", version)
                or len(entries) != 1 or entries[0].get("version") != version
                or version not in entries[0].get("specifiers", [])):
            raise ValueError(f"mise tool pin/lock mismatch: {name}")
        entry = entries[0]
        if entry.get("aube") or entry.get("uv"):
            continue
        for platform in ("linux-x64", "linux-arm64"):
            artifact = entry.get(f"platforms.{platform}", entry.get("platforms", {}).get(platform, {}))
            if (not artifact.get("url", "").startswith("https://")
                    or not re.fullmatch(r"sha256:[a-f0-9]{64}", artifact.get("checksum", ""))):
                raise ValueError(f"missing frozen artifact for {name} on {platform}")
    native_locks(root)
    if check_manifest:
        manifest = json.loads((root / "package.json").read_text())
        version = config["npm:pnpm"]
        if isinstance(version, dict):
            version = version["version"]
        if manifest.get("packageManager") != f"pnpm@{version}":
            raise ValueError("packageManager must match mise's pnpm pin")


def packages():
    result = subprocess.run(
        ["dpkg-query", "-W", "-f=${Package}\t${Version}\n", *PACKAGES],
        check=True, capture_output=True, text=True, timeout=10,
    )
    return dict(line.split("\t", 1) for line in result.stdout.splitlines())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("record", "check", "validate-locks", "validate-tool-locks"))
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--manifest", type=Path,
                        default=Path("/usr/local/share/devcontainer/state.json"))
    args = parser.parse_args()
    if args.mode in ("validate-locks", "validate-tool-locks"):
        if args.mode == "validate-tool-locks":
            tool_locks(args.root)
        native_locks(args.root)
        mise = tomllib.loads((args.root / "mise.toml").read_text())
        version = re.search(r"^MISE_VERSION=(.+)$",
                            (args.root / ".devcontainer/versions.env").read_text(), re.M)
        if not version or mise.get("min_version") != version[1]:
            raise ValueError("mise minimum must match the pinned bootstrap version")
        print("native dependency graphs and mise bootstrap match")
        return 0
    actual = {"format": 1, "inputs": inputs(args.root), "packages": packages()}
    if args.mode == "record":
        # Image inputs intentionally exclude workspace package.json. Verify
        # both platform artifacts before accepting the build's tool contract.
        tool_locks(args.root, check_manifest=False)
        args.manifest.write_text(json.dumps(actual, indent=2, sort_keys=True) + "\n")
        return 0
    expected = json.loads(args.manifest.read_text())
    if expected.get("format") != 1:
        raise ValueError("unsupported image contract format; rebuild required")
    differences = [
        name for section in ("inputs", "packages")
        for name in set(expected[section]) | set(actual[section])
        if expected[section].get(name) != actual[section].get(name)
    ]
    if differences:
        print("rebuild required: " + ", ".join(sorted(differences)))
        return 1
    print("build inputs and system packages match")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.SubprocessError) as error:
        print(f"image contract unavailable: {error}", file=sys.stderr)
        sys.exit(1)
