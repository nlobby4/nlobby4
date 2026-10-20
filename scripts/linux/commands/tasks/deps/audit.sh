#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for audit.sh.
#
# Usage:
# scripts/linux/commands/tasks/deps/audit.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

pnpm audit --prod --audit-level=high
