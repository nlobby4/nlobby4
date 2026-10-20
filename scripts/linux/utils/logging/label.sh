#!/usr/bin/env bash

# --------------------------------------------------
# Label functions for repository scripts.
#
# This script is not meant to be run directly,
# scripts relying on these functions source this as needed.
# --------------------------------------------------

# Guard against direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced, not executed directly" >&2
  exit 1
fi

# Guard against multiple sourcing
[[ -n "${_LABEL_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_LABEL_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_LABEL_UTILS_DIR/../functions/validation.sh" || return 1
readonly _LABEL_UTILS_DIR

# --------------------------
# Labels
# --------------------------

# Return a singular or plural label based on a count
plural_label() {
  local count="${1:-}"
  local singular="${2:-item}"
  local plural="${3:-${singular}s}"

  check_unsigned_integer "$count" "plural count" || return 1

  if [[ "$count" == "1" ]]; then
    printf '%s' "$singular"
  else
    printf '%s' "$plural"
  fi
}

# Mark initialization complete
readonly _LABEL_LOADED=1
