#!/usr/bin/env bash

# --------------------------------------------------
# Node.js readiness validation script.
#
# Verifies Node.js, pnpm, npm and dependency state when package.json exists.
# Checks cached hashes and installed bytes using a frozen offline copy.
# Refreshes upstream refs unless a shared refresh result is supplied.
#
# Prints status rows to stdout and diagnostics to stderr.
# Returns nonzero on failed checks without downloading or repairing packages.
# Upstream dependency changes remain advisory.
#
# Usage:
# bash scripts/linux/commands/repository/validation/node-status.sh
# --------------------------------------------------

# Exit on command errors and unset variables, and propagate pipeline failures
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || exit 1
. "$SCRIPT_DIR/../../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/functions/node.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/logging/status.sh" || exit 1

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false
NODE_STATUS_SCRIPT="$NODE_BIN_DIR/node-status.js"
# Leave room for the bounded Git refresh and rendering inside info.sh's deadline
NODE_STATUS_TIMEOUT=35s
readonly SCRIPT_DIR NODE_STATUS_SCRIPT NODE_STATUS_TIMEOUT

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command jq
check_command node
check_file "$NODE_STATUS_SCRIPT"
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN
status_reset
overall_status=0

# --------------------------
# Dependency install state
# --------------------------

refresh_status=1
if [[ -f package.json ]]; then
  set +e
  upstream_remote="$(git_upstream_remote 2> /dev/null)"
  set -e
  if [[ -n "$upstream_remote" && "$upstream_remote" == "${_REPOSITORY_GIT_UPSTREAM_REMOTE:-}" &&
    "${_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS:-}" =~ ^[012]$ ]]; then
    refresh_status="$_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS"
  elif [[ "$upstream_remote" == origin && "${_REPOSITORY_GIT_REFRESH_STATUS:-}" =~ ^[012]$ ]]; then
    refresh_status="$_REPOSITORY_GIT_REFRESH_STATUS"
  elif [[ -n "$upstream_remote" ]]; then
    set +e
    git_refresh_upstream "$upstream_remote" 2> /dev/null
    refresh_status="$?"
    set -e
  fi

  if [[ "$refresh_status" -eq 0 ]]; then
    set +e
    upstream_ref="$(git_upstream_ref 2> /dev/null)"
    set -e

    upstream_changes_status=1
    if [[ -n "$upstream_ref" ]]; then
      set +e
      git_upstream_paths_changed \
        "$upstream_ref" \
        ':(glob)**/package.json' \
        ':(glob)**/pnpm-lock.yaml' \
        ':(glob)**/pnpm-workspace.yaml'
      upstream_changes_status="$?"
      set -e
    fi

    case "$upstream_changes_status" in
      0)
        status_add \
          "Node.js remote dependencies" \
          "upstream has dependency changes; pull before installing"
        ;;
      1) ;;
      *)
        status_add "Node.js remote dependencies" "unable to verify"
        ;;
    esac
  elif [[ "$refresh_status" -eq 2 ]]; then
    status_add "Node.js remote dependencies" "unable to connect to $upstream_remote"
  fi
fi

if [[ -f package.json ]]; then
  set +e
  node_status_output="$(run_command "$TIMEOUT_BIN" \
    --signal=TERM --kill-after=1s "$NODE_STATUS_TIMEOUT" \
    node -- "$NODE_STATUS_SCRIPT")"
  node_status_status="$?"
  set -e
  if [[ "$node_status_status" -eq 0 ]]; then
    set +e
    status_import_json "$node_status_output"
    node_status_status="$?"
    set -e
    if [[ "$node_status_status" -eq 2 ]]; then
      status_add "Node.js dependencies" "invalid status output" "$COLOR_RED"
    fi
  elif [[ "$node_status_status" -eq 124 || "$node_status_status" -eq 137 ]]; then
    status_add "Node.js dependencies" "inspection timed out" "$COLOR_RED"
  else
    status_add "Node.js dependencies" "unable to inspect" "$COLOR_RED"
  fi
  [[ "$node_status_status" -eq 0 ]] || overall_status=1
else
  status_add \
    "Node.js dependencies" \
    "package.json not present" \
    "${COLOR_RED:-}"
  overall_status=1
fi

status_print
exit "$overall_status"
