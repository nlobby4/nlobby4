#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for test-list.sh.
#
# Usage:
# scripts/linux/commands/tasks/actions/test-list.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

bash scripts/linux/commands/tasks/act.sh --list "$@"
