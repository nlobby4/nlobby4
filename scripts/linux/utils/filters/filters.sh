#!/usr/bin/env bash

# --------------------------------------------------
# Source filter utility modules.
#
# This script is not meant to be run directly.
# Source this barrel to load the folder's public helpers and asset paths.
#
# Loading modules does not run checks or install dependencies.
# --------------------------------------------------

# Guard against direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced, not executed directly" >&2
  exit 1
fi

# Guard against multiple sourcing
[[ -n "${_FILTERS_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load modules explicitly so the public API and source order remain deliberate
_FILTERS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_FILTERS_DIR/core.sh" || return 1
readonly _FILTERS_DIR

# Mark initialization complete only after all modules load successfully
readonly _FILTERS_LOADED=1
