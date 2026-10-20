#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for format.sh.
#
# Usage:
# scripts/linux/commands/tasks/format.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

node scripts/node/bin/workspace-check.js format
