#!/usr/bin/env bash

# --------------------------------------------------
# Package script wrapper for spell.sh.
#
# Usage:
# scripts/linux/commands/tasks/lint/spell.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

cspell lint --no-progress --no-must-find-files --cache --cache-strategy content
