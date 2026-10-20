#!/usr/bin/env bash

# --------------------------------------------------
# Dependency-free foundation for the filter utilities.
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
[[ -n "${_FILTER_CORE_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_FILTER_CORE_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_FILTER_CORE_DIR/../functions/validation.sh" || return 1
readonly _FILTER_CORE_DIR

# Public asset locations for callers that need to use an engine directly
readonly JQ_FILTER_DIR="$_FILTER_CORE_DIR/jq"
readonly AWK_FILTER_DIR="$_FILTER_CORE_DIR/awk"

# --------------------------
# Filter engine interface
# --------------------------

# Run a named filter against a file or standard input
run_filter() {
  local engine="${1:-}"
  local filter_name="${2:-}"
  local input="${3:-}"
  local filter

  check_argument "$engine" "filter engine" || return 2
  case "$engine" in
    jq) filter="$JQ_FILTER_DIR/$filter_name.jq" ;;
    awk) filter="$AWK_FILTER_DIR/$filter_name.awk" ;;
    *)
      log_error "unsupported filter engine: $engine (expected jq or awk)"
      return 2
      ;;
  esac

  check_argument "$filter_name" "filter name" || return 2
  check_argument "$input" "filter input" || return 2
  check_command "$engine" || return 2

  if [[ ! "$filter_name" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    log_error "invalid filter name: $filter_name"
    return 2
  fi

  check_file "$filter" || return 2

  if [[ "$input" != "-" ]]; then
    check_file "$input" || return 2
    [[ "$input" == /* ]] || input="./$input"
  fi

  shift 3
  if [[ "$engine" == jq ]]; then
    jq "$@" --from-file "$filter" -- "$input"
  else
    awk "$@" -f "$filter" -- "$input"
  fi
}

# Mark initialization complete
readonly _FILTER_CORE_LOADED=1
