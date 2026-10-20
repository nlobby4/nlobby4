#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for actions-security.sh.
#
# Usage:
# scripts/linux/commands/tasks/lint/actions-security.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

bash scripts/linux/commands/tasks/zizmor.sh
