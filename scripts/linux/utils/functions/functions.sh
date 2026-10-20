#!/usr/bin/env bash

# --------------------------------------------------
# Source the repository function helpers.
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
[[ -n "${_FUNCTIONS_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load modules explicitly so the public API and source order remain deliberate
_FUNCTIONS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_FUNCTIONS_DIR/core.sh" || return 1
. "$_FUNCTIONS_DIR/validation.sh" || return 1
. "$_FUNCTIONS_DIR/node.sh" || return 1
. "$_FUNCTIONS_DIR/git.sh" || return 1
readonly _FUNCTIONS_DIR

# Mark initialization complete only after all modules load successfully
readonly _FUNCTIONS_LOADED=1
