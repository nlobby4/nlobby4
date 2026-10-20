#!/usr/bin/env bash

# --------------------------------------------------
# Repository readiness summary script.
#
# Runs validation scripts in parallel and prints their output in boxes.
# Returns nonzero when a check or its output rendering fails.
#
# Called by health.sh on every devcontainer start
# Intended for use after setup.sh, not during the image build
#
# Usage:
# bash scripts/linux/commands/repository/info.sh
# --------------------------------------------------

# Exit on command errors and unset variables, and propagate pipeline failures
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || exit 1
VALIDATION_DIR="$SCRIPT_DIR/validation"
. "$SCRIPT_DIR/../../utils/functions/validation.sh" || exit 1
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../utils/logging/logging.sh" || exit 1
readonly SCRIPT_DIR VALIDATION_DIR

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command bash
check_command mktemp
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN
check_directory "$VALIDATION_DIR"

# --------------------------
# Shared Git refresh
# --------------------------

_REPOSITORY_GIT_REFRESH_STATUS=1
if git remote get-url origin > /dev/null 2>&1; then
  set +e
  git_refresh_upstream origin > /dev/null 2>&1
  _REPOSITORY_GIT_REFRESH_STATUS="$?"
  set -e
fi
readonly _REPOSITORY_GIT_REFRESH_STATUS
export _REPOSITORY_GIT_REFRESH_STATUS

set +e
_REPOSITORY_GIT_UPSTREAM_REMOTE="$(git_upstream_remote 2> /dev/null)"
set -e
_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS=1
if [[ "$_REPOSITORY_GIT_UPSTREAM_REMOTE" == origin ]]; then
  _REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS="$_REPOSITORY_GIT_REFRESH_STATUS"
elif [[ -n "$_REPOSITORY_GIT_UPSTREAM_REMOTE" ]]; then
  set +e
  git_refresh_upstream "$_REPOSITORY_GIT_UPSTREAM_REMOTE" > /dev/null 2>&1
  _REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS="$?"
  set -e
fi
readonly _REPOSITORY_GIT_UPSTREAM_REMOTE _REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS
export _REPOSITORY_GIT_UPSTREAM_REMOTE _REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS

# --------------------------
# Run readiness checks
# --------------------------

shopt -s nullglob
validation_checks=("$VALIDATION_DIR"/*.sh)
shopt -u nullglob
readonly -a validation_checks

if [[ "${#validation_checks[@]}" -eq 0 ]]; then
  log_error "no scripts found in $VALIDATION_DIR"
  exit 1
fi

check_titles=()
check_outputs=()
check_pids=()
child_color_mode=never

if supports_color 1; then
  child_color_mode=always
fi
readonly child_color_mode

# Reap outstanding check processes
_cleanup_info() {
  local pid

  for pid in "${check_pids[@]}"; do
    [[ -n "$pid" ]] || continue
    kill "$pid" 2> /dev/null || true
  done

  for pid in "${check_pids[@]}"; do
    [[ -n "$pid" ]] || continue
    wait "$pid" 2> /dev/null || true
  done

  rm -rf -- "$info_tmp_dir"
}

info_tmp_dir="$(mktemp -d)"
trap _cleanup_info EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for check_path in "${validation_checks[@]}"; do
  check_name="${check_path##*/}"
  check_name="${check_name%.sh}"
  check_title="${check_name//-/ }"
  check_output="$info_tmp_dir/$check_name.log"

  COLOR_MODE="$child_color_mode" "$TIMEOUT_BIN" --signal=TERM --kill-after=2s 60s bash "$check_path" < /dev/null > "$check_output" 2>&1 &
  check_titles+=("$check_title")
  check_outputs+=("$check_output")
  check_pids+=("$!")
done

overall_status=0
for check_index in "${!check_pids[@]}"; do
  border_color=""

  check_status=0
  wait "${check_pids[check_index]}" || check_status="$?"
  if [[ "$check_status" -eq 0 && ! -s "${check_outputs[check_index]}" ]]; then
    printf 'Readiness check completed without validation output\n' >> "${check_outputs[check_index]}"
    check_status=1
  fi
  if [[ "$check_status" -ne 0 ]]; then
    border_color="${COLOR_RED:-}"
    overall_status=1
    if [[ "$check_status" -eq 124 ]]; then
      printf 'Readiness check exceeded its deadline\n' >> "${check_outputs[check_index]}"
    elif [[ "$check_status" -eq 137 ]]; then
      printf 'Readiness check was killed or exited with status 137\n' >> "${check_outputs[check_index]}"
    elif [[ ! -s "${check_outputs[check_index]}" ]]; then
      printf 'Readiness check exited with status %s without output\n' "$check_status" >> "${check_outputs[check_index]}"
    fi
  fi
  check_pids[check_index]=""

  set +e
  print_box \
    "${check_titles[check_index]}" \
    "${check_outputs[check_index]}" \
    "$border_color"
  render_status="$?"
  set -e
  if [[ "$render_status" -ne 0 ]]; then
    printf '%s\n' "${check_titles[check_index]}"
    cat -- "${check_outputs[check_index]}"
    overall_status=1
  fi
done

trap - EXIT
_cleanup_info
exit "$overall_status"
