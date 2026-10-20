#!/usr/bin/env bash

# --------------------------------------------------
# Source all Bash utility modules.
#
# This script is not meant to be run directly.
# Source this barrel to load the folder's public helpers.
#
# Loading modules does not run checks or install dependencies.
# --------------------------------------------------

# Guard against direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced, not executed directly" >&2
  exit 1
fi

# Guard against multiple sourcing
[[ -n "${_UTILS_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load modules explicitly so the public API and source order remain deliberate
_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_UTILS_DIR/logging/logging.sh" || return 1
. "$_UTILS_DIR/functions/functions.sh" || return 1
. "$_UTILS_DIR/filters/filters.sh" || return 1
readonly _UTILS_DIR

# Mark initialization complete only after all modules load successfully
readonly _UTILS_LOADED=1
