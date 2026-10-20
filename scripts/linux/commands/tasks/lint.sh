#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for lint.sh.
#
# Usage:
# scripts/linux/commands/tasks/lint.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

pnpm run lint:actions && pnpm run lint:actions:security && pnpm run lint:commit && pnpm run lint:devcontainer && pnpm run lint:dockerfile && pnpm run lint:editorconfig && pnpm run lint:js && pnpm run lint:md && pnpm run lint:md:gfm && pnpm run lint:policy && pnpm run lint:schema && pnpm run lint:shell && pnpm run lint:toml && pnpm run lint:yaml
