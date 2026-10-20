#!/usr/bin/env bash

# --------------------------------------------------
# Node script execution functions for repository scripts.
#
# This script is not meant to be run directly,
# scripts relying on these helpers source this as needed.
# --------------------------------------------------

# Guard against direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced, not executed directly" >&2
  exit 1
fi

# Guard against multiple sourcing
[[ -n "${_NODE_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_NODE_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_NODE_UTILS_DIR/validation.sh" || return 1
NODE_BIN_DIR="$_NODE_UTILS_DIR/../../../node/bin"
readonly _NODE_UTILS_DIR

# Public helper location used by modules that source this file
# shellcheck disable=SC2034
readonly NODE_BIN_DIR

# --------------------------
# Node scripts
# --------------------------

# Run a node script
run_node_script() {
  local command_options=()
  local script

  if [[ "${1:-}" == --auto-install ]]; then
    command_options+=(--auto-install)
    shift
  fi
  if [[ "${1:-}" == -- ]]; then
    shift
  fi
  script="${1:-}"

  check_argument "$script" "Node script file" || return 1
  check_command node || return 1
  check_file "$script" || return 1
  shift

  run_command "${command_options[@]}" -- node -- "$script" "$@"
}

# Mark initialization complete
readonly _NODE_LOADED=1
