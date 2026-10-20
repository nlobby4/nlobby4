#!/usr/bin/env bash

# --------------------------------------------------
# Source logging utiliy modules.
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
[[ -n "${_LOGGING_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load modules explicitly so the public API and source order remain deliberate
_LOGGING_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_LOGGING_DIR/core.sh" || return 1
. "$_LOGGING_DIR/log.sh" || return 1
. "$_LOGGING_DIR/label.sh" || return 1
. "$_LOGGING_DIR/terminal.sh" || return 1
. "$_LOGGING_DIR/ansi.sh" || return 1
. "$_LOGGING_DIR/status.sh" || return 1
. "$_LOGGING_DIR/box.sh" || return 1
readonly _LOGGING_DIR

# Mark initialization complete only after all modules load successfully
readonly _LOGGING_LOADED=1
