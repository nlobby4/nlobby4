#!/usr/bin/env python3
"""Read-only filesystem capacity checks for workspace and container storage."""

import json
import os
import shutil
import tempfile
from pathlib import Path


def minimum(environment, name, default):
    value = environment.get(name, str(default))
    if not value.isascii() or not value.isdecimal() or not 1 <= int(value) <= 2147483647:
        raise ValueError(f"{name} must be an integer between 1 and 2147483647")
    return int(value)


def capacity(label, directory, minimum_mib, minimum_inodes, statvfs=None):
    try:
        inspect = statvfs or getattr(os, "statvfs", None)
        state = inspect(directory) if inspect else None
        free_bytes = state.f_bavail * state.f_frsize if state else shutil.disk_usage(directory).free
        free_mib = free_bytes // (1024 * 1024)
        ok = free_mib >= minimum_mib
        value = f"{free_mib} MiB free (minimum {minimum_mib} MiB)"
        if state and state.f_files > 0 and state.f_favail >= 0:
            ok = ok and state.f_favail >= minimum_inodes
            value += f"; {state.f_favail} inodes free (minimum {minimum_inodes})"
        else:
            value += "; inode accounting unavailable"
        return {"label": label, "value": value, "ok": ok}
    except OSError as error:
        return {"label": label, "value": f"unable to inspect capacity: {error.strerror}", "ok": False}


def rows(environment=os.environ):
    try:
        minimum_mib = minimum(environment, "DEVCONTAINER_MIN_FREE_MIB", 1024)
        minimum_inodes = minimum(environment, "DEVCONTAINER_MIN_FREE_INODES", 1000)
    except ValueError as error:
        return [{"label": "Storage capacity", "value": str(error), "ok": False}]
    targets = [("Workspace capacity", "."), ("Temporary storage capacity", tempfile.gettempdir())]
    if environment.get("NPM_CONFIG_STORE_DIR"):
        targets.append(("pnpm store capacity", environment["NPM_CONFIG_STORE_DIR"]))
    if Path("/.dockerenv").exists() or Path("/run/.containerenv").exists():
        # These are the dedicated DinD volume mount points in devcontainer.json.
        for label, directory in [("Docker storage capacity", "/var/lib/docker"),
                                 ("Containerd storage capacity", "/var/lib/containerd")]:
            if Path(directory).exists():
                targets.append((label, directory))
    return [capacity(label, directory, minimum_mib, minimum_inodes) for label, directory in targets]


if __name__ == "__main__":
    # Health flags, not process failure, convey per-filesystem readiness to Bash.
    print(json.dumps(rows()))
