#!/usr/bin/env bash

# --------------------------------------------------
# Logging functions for repository scripts.
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
[[ -n "${_LOG_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_LOG_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_LOG_UTILS_DIR/core.sh" || return 1
readonly _LOG_UTILS_DIR

# --------------------------
# Message Logging
# --------------------------

# Resolve color against the output stream
_log_message() {
  local label="$1" color="$2" message="$3"

  if supports_color 1; then
    printf '%s%s%s %s\n' "$color" "$label" "$COLOR_RESET" "$message"
  else
    printf '%s %s\n' "$label" "$message"
  fi
}

log_ok() { _log_message "$LOG_OK" "$COLOR_GREEN" "$*"; }
log_info() { _log_message "$LOG_INFO" "$COLOR_CYAN" "$*"; }
log_warning() { _log_message "$LOG_WARN" "$COLOR_YELLOW" "$*"; }
log_error() { _log_message "$LOG_ERROR" "$COLOR_RED" "$*" >&2; }

# Mark initialization complete
readonly _LOG_LOADED=1
