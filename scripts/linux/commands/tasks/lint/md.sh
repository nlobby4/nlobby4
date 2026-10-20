#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for md.sh.
#
# Usage:
# scripts/linux/commands/tasks/lint/md.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

markdownlint-cli2 --config .markdownlint-cli2.json
