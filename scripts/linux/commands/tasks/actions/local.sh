#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for local.sh.
#
# Usage:
# scripts/linux/commands/tasks/actions/local.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

pnpm run actions:test
