#!/usr/bin/env bash

# --------------------------------------------------
# Path and integer validation for repository scripts.
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
[[ -n "${_VALIDATION_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_VALIDATION_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_VALIDATION_UTILS_DIR/core.sh" || return 1
readonly _VALIDATION_UTILS_DIR

# --------------------------
# Validation
# --------------------------

# Check if a regular file exists
check_file() {
  local file="${1:-}"

  check_argument "$file" "file path" || return 1

  [[ -f "$file" ]] || {
    log_error "not a regular file: $file"
    return 1
  }
}

# Check if a directory exists
check_directory() {
  local directory="${1:-}"

  check_argument "$directory" "directory path" || return 1

  [[ -d "$directory" ]] || {
    log_error "not a directory: $directory"
    return 1
  }
}

# Check if a path exists
check_path() {
  local path="${1:-}"

  check_argument "$path" "path" || return 1

  [[ -e "$path" ]] || {
    log_error "path not found: $path"
    return 1
  }
}

# Check if a symlink exists, including broken symlinks
check_symlink() {
  local symlink="${1:-}"

  check_argument "$symlink" "symlink path" || return 1

  [[ -L "$symlink" ]] || {
    log_error "not a symbolic link: $symlink"
    return 1
  }
}

# Check if a symlink exists and its target exists
check_resolved_symlink() {
  local symlink="${1:-}"

  check_symlink "$symlink" || return 1

  [[ -e "$symlink" ]] || {
    log_error "symlink target does not resolve: $symlink"
    return 1
  }
}

# Check if an argument is a canonical non-negative integer within a range
check_unsigned_integer() {
  local value="${1:-}"
  local name="${2:-integer}"
  local minimum="${3:-0}"
  local maximum="${4:-9223372036854775807}"
  local LC_ALL=C

  if [[ ! "$minimum" =~ ^(0|[1-9][0-9]*)$ ]]; then
    log_error "invalid integer minimum: $minimum"
    return 1
  fi

  if [[ ! "$maximum" =~ ^(0|[1-9][0-9]*)$ ]]; then
    log_error "invalid integer maximum: $maximum"
    return 1
  fi

  if [[ "${#minimum}" -gt "${#maximum}" ]] \
    || {
      [[ "${#minimum}" -eq "${#maximum}" ]] \
        && [[ "$minimum" > "$maximum" ]]
    }; then
    log_error "integer minimum must not exceed maximum: $minimum > $maximum"
    return 1
  fi

  if [[ ! "$value" =~ ^(0|[1-9][0-9]*)$ ]]; then
    log_error "$name must be an integer between $minimum and $maximum"
    return 1
  fi

  if [[ "${#value}" -lt "${#minimum}" ]] \
    || {
      [[ "${#value}" -eq "${#minimum}" ]] \
        && [[ "$value" < "$minimum" ]]
    } \
    || [[ "${#value}" -gt "${#maximum}" ]] \
    || {
      [[ "${#value}" -eq "${#maximum}" ]] \
        && [[ "$value" > "$maximum" ]]
    }; then
    log_error "$name must be an integer between $minimum and $maximum"
    return 1
  fi
}

# Mark initialization complete
readonly _VALIDATION_LOADED=1
