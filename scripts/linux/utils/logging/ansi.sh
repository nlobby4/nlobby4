#!/usr/bin/env bash

# --------------------------------------------------
# ANSI text functions for repository scripts.
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
[[ -n "${_ANSI_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_ANSI_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_ANSI_UTILS_DIR/../functions/node.sh" || return 1
readonly _ANSI_UTILS_DIR

# --------------------------
# ANSI
# --------------------------

# Strip ANSI escape sequences from standard input
strip_ansi() {
  run_node_script "$NODE_BIN_DIR/terminal-text.js" strip-ansi
}

# Strip ANSI escapes and transliterate Unicode input to ASCII
to_ascii() {
  run_node_script "$NODE_BIN_DIR/terminal-text.js" to-ascii
}

# Print an ANSI asset with terminal-appropriate formatting
print_ansi_file() {
  local file="${1:-}"
  local ascii_fallback="${2:-}"

  check_file "$file" || return 1

  if [[ "$file" != *.ansi ]]; then
    log_error "ANSI asset must use the .ansi extension: $file"
    return 1
  fi

  if [[ "$#" -ge 2 ]]; then
    check_single_line_argument "$ascii_fallback" "ASCII fallback" || return 1
  fi

  if [[ -n "${ASCII_ONLY:-}" ]]; then
    if [[ "$#" -ge 2 ]]; then
      printf '%s\n' "$ascii_fallback"
    else
      to_ascii < "$file"
    fi
  elif supports_color 1; then
    command cat -- "$file"
  else
    strip_ansi < "$file"
  fi
}

# Mark initialization complete
readonly _ANSI_LOADED=1
