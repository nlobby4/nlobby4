#!/usr/bin/env bash

# --------------------------------------------------
# Repository quality checks.
#
# Runs formatting, linting, tests, unused-dependency detection
# and the production-dependency audit, stopping on the first failure.
# Run from this repository's root after installing dependencies.
# Takes no arguments; use individual tasks for tool-specific options.
#
# Usage:
# bash scripts/linux/commands/tasks/check.sh
# --------------------------------------------------

# Exit on command errors and unset variables, and propagate pipeline failures
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" || exit 1
. "$SCRIPT_DIR/../../utils/functions/validation.sh" || exit 1
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
readonly SCRIPT_DIR

# Validation must not implicitly install tools via mise shims
set_mise_auto_install false

# --------------------------
# Arguments
# --------------------------

if [[ "$#" -gt 0 ]]; then
  if [[ "$#" -eq 1 && ("$1" == --help || "$1" == -h) ]]; then
    printf '%s\n' 'Usage:' 'bash scripts/linux/commands/tasks/check.sh' \
      '' 'Run all repository quality checks from this repository root.' \
      'Use individual tasks for tool-specific options.'
    exit 0
  fi
  log_error 'check.sh does not accept arguments; use individual tasks for tool-specific options'
  exit 2
fi

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
if [[ ! . -ef "$SCRIPT_DIR/../../../.." ]]; then
  log_error 'run check.sh from the root of the repository containing this script'
  exit 1
fi
check_file package.json
check_command pnpm

# --------------------------
# Quality checks
# --------------------------

checks=(format:check lint test deps:unused audit)
readonly -a checks

for check in "${checks[@]}"; do
  log_info "Running $check..."
  if pnpm run "$check"; then
    log_ok "$check passed"
  else
    check_status="$?"
    log_error "$check failed (exit status $check_status)"
    exit "$check_status"
  fi
done

log_ok 'All repository quality checks passed'
