#!/usr/bin/env bash

# --------------------------------------------------
# Terminal functions for repository scripts.
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
[[ -n "${_TERMINAL_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_TERMINAL_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_TERMINAL_UTILS_DIR/../functions/node.sh" || return 1
readonly _TERMINAL_UTILS_DIR

# --------------------------
# Terminal
# --------------------------

# Return the current terminal width when it is available and valid
terminal_width() {
  local columns terminal_fd

  command -v tput > /dev/null 2>&1 || return 1
  if [[ -t 1 ]]; then
    exec {terminal_fd}>&1 || return 1
  elif [[ -t 2 ]]; then
    exec {terminal_fd}>&2 || return 1
  else
    return 1
  fi

  if ! columns="$(env -u COLUMNS -u LINES tput cols 2> /dev/null <&"$terminal_fd")"; then
    exec {terminal_fd}>&-
    return 1
  fi
  exec {terminal_fd}>&-

  [[ "$columns" =~ ^[1-9][0-9]*$ ]] || return 1

  printf '%s\n' "$columns"
}

# Return one visible width per single-line input
visible_width() {
  local width_output width value
  local widths=()

  if [[ "$#" -eq 0 ]]; then
    return
  fi

  for value in "$@"; do
    if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
      log_error "visible-width input must be a single line"
      return 1
    fi
  done

  width_output="$(run_node_script "$NODE_BIN_DIR/terminal-text.js" visible-width "$@")" || return 1
  mapfile -t widths <<< "$width_output"

  if [[ "${#widths[@]}" -ne "$#" ]]; then
    log_error "visible-width helper returned an unexpected number of results"
    return 1
  fi

  for width in "${widths[@]}"; do
    if [[ ! "$width" =~ ^[0-9]+$ ]]; then
      log_error "visible-width helper returned an invalid width: $width"
      return 1
    fi
  done

  printf '%s\n' "${widths[@]}"
}

# Create a separator line based on terminal width
separator() {
  local width line rule
  width="$(terminal_width)" || width=80

  if [[ -z "${ASCII_ONLY:-}" ]]; then
    rule="─"
  else
    rule="-"
  fi

  printf -v line '%*s' "$width" ''
  printf '%s\n' "${line// /$rule}"
}

# Mark initialization complete
readonly _TERMINAL_LOADED=1
