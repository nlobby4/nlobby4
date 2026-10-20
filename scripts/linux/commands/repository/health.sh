#!/usr/bin/env bash

# --------------------------------------------------
# Repository health check script.
#
# Runs each verification script in isolation and reports
# a non-zero exit status if any check fails. A failed check does not
# prevent the remaining checks from running.
#
# Used by the development container during startup.
#
# Usage:
# ./scripts/linux/commands/repository/health.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

# --------------------------
# Setup
# --------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TASKS_DIR="$SCRIPT_DIR/../tasks"
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../utils/logging/logging.sh"

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command bash

# --------------------------
# Validation
# --------------------------

printf '\n'
set +e
print_ansi_file "scripts/linux/resources/banner.ansi" "nlobby4"
set -e
printf '\n'
separator
printf '\n'
log_info "Checking repository health..."

checks=(
  attributes.sh
  lfs.sh
)
readonly -a checks

overall_status=0
heading_color=""
heading_reset=""
heading_underline=""
check_index=0

if supports_color 1; then
  heading_color="${COLOR_CYAN:-}"
  heading_reset="${COLOR_RESET:-}"
  heading_underline=$'\033[4m'
fi

printf '\n'

for check in "${checks[@]}"; do
  check_path="$TASKS_DIR/$check"

  if [[ "$check_index" -gt 0 ]]; then
    printf '\n'
  fi

  printf '%s%s%s:%s\n' "$heading_color" "$heading_underline" "$check" "$heading_reset"
  check_index="$((check_index + 1))"

  if [[ ! -f "$check_path" ]]; then
    log_error "$check is missing at $check_path"
    overall_status=1
    continue
  fi

  # Invoking Bash creates an isolated process for each check
  if bash "$check_path"; then
    log_ok "$check passed"
  else
    log_error "$check reported issues"
    overall_status=1
  fi
done

printf '\n'

separator
if ! bash "$SCRIPT_DIR/info.sh"; then
  overall_status=1
fi

printf '\n'

# --------------------------
# Summary
# --------------------------

printf '%s%s%s:%s\n' "$heading_color" "$heading_underline" "summary" "$heading_reset"

if [[ "$overall_status" -eq 0 ]]; then
  log_ok "All health checks passed"
else
  log_error "One or more health checks failed"
  log_info "See output above for details"
fi

separator
exit "$overall_status"
