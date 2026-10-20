#!/usr/bin/env python3
"""List configured mise commands, version arguments and expected pins.

Tool declarations come from mise.toml, not a second readiness tool list.
Only package/binary naming exceptions and version-flag exceptions live here.
No tool installation or mise task inspection is performed.
"""

import re
import sys
import tomllib
from pathlib import Path


def commands(config):
    tools = config.get("tools")
    if not isinstance(tools, dict) or not tools:
        raise ValueError("mise.toml must declare tools")
    names = {"npm:@devcontainers/cli": "devcontainer"}
    arguments = {"minisign": "-v", "gitleaks": "version"}
    result = []
    for tool, value in tools.items():
        name = names.get(tool, tool.rsplit(":", 1)[-1].rsplit("/", 1)[-1])
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.+-]*", name):
            raise ValueError(f"unsupported command name for mise tool: {tool}")
        version = value.get("version") if isinstance(value, dict) else value
        if not isinstance(version, str) or not re.fullmatch(r"[0-9]+(?:\.[0-9]+)+", version):
            raise ValueError(f"mise tool requires an exact numeric version: {tool}")
        result.append((name, arguments.get(name, "--version"), version))
    return result


if __name__ == "__main__":
    try:
        config = tomllib.loads(Path(sys.argv[1] if len(sys.argv) > 1 else "mise.toml").read_text(encoding="utf-8"))
        for name, argument, version in commands(config):
            print(f"{name}\t{argument}\t{version}")
    except (OSError, ValueError) as error:
        print(f"unable to enumerate mise commands: {error}", file=sys.stderr)
        sys.exit(1)
