#!/usr/bin/env bash

# --------------------------------------------------
# Commitlint runner.
#
# With no arguments, validates only the latest commit. Arguments are forwarded
# to the repository-local Commitlint binary through pnpm, allowing the Git hook
# to pass one commit message file with --edit.
#
# Usage:
# scripts/linux/commands/tasks/lint/commit.sh
# scripts/linux/commands/tasks/lint/commit.sh --edit .git/COMMIT_EDITMSG
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

commitlint_args=("$@")

if [[ "${#commitlint_args[@]}" -eq 0 ]]; then
  commitlint_args+=(--last)
fi

commitlint "${commitlint_args[@]}" --verbose
