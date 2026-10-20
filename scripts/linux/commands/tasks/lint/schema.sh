#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for schema.sh.
#
# Usage:
# scripts/linux/commands/tasks/lint/schema.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

node scripts/node/bin/update-schemas.js --check
node scripts/node/bin/validate-schemas.js
