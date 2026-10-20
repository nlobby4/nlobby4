#!/usr/bin/env python3
"""Derive package-manager and runtime declarations from mise's exact tool pins."""
import json
import os
import re
import tempfile
import tomllib
from pathlib import Path


def synchronize(root=Path.cwd()):
    tools = tomllib.loads((root / "mise.toml").read_text())["tools"]
    versions = {}
    for name in ("node", "npm:pnpm"):
        value = tools[name]
        version = value.get("version") if isinstance(value, dict) else value
        if not isinstance(version, str) or not re.fullmatch(r"\d+\.\d+\.\d+", version):
            raise ValueError(f"expected an exact version for {name}")
        versions[name] = version
    target = root / "package.json"
    if target.is_symlink() or not target.is_file():
        raise ValueError("package.json must be a regular file")
    before = target.read_text()
    value = json.loads(before)
    value["packageManager"] = f'pnpm@{versions["npm:pnpm"]}'
    engines = value.setdefault("engines", {})
    major = int(versions["node"].split(".")[0])
    engines["node"] = f'>={versions["node"]} <{major + 1}'
    engines["pnpm"] = f'>={versions["npm:pnpm"].split(".")[0]}'
    after = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    if after == before:
        return False
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf8", dir=root, prefix=".package-update-", delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(after)
            stream.flush()
            os.fchmod(stream.fileno(), target.stat().st_mode & 0o777)
            os.fsync(stream.fileno())
            if target.read_text() != before:
                raise ValueError("package.json changed during synchronization")
            os.replace(temporary, target)
        finally:
            temporary.unlink(missing_ok=True)
    return True


if __name__ == "__main__":
    print("Toolchain declarations synchronized" if synchronize() else "Toolchain declarations unchanged")
