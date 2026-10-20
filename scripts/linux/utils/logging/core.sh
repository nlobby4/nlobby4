#!/usr/bin/env bash

# --------------------------------------------------
# Dependency-free foundation for the logging utilities.
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
[[ -n "${_CORE_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

COLOR_GREEN=$'\033[0;32m'
COLOR_RED=$'\033[0;31m'
COLOR_YELLOW=$'\033[0;33m'
COLOR_CYAN=$'\033[0;36m'
COLOR_RESET=$'\033[0m'

# Public colors are consumed by modules that source this file
# shellcheck disable=SC2034
readonly \
  COLOR_GREEN \
  COLOR_RED \
  COLOR_YELLOW \
  COLOR_CYAN \
  COLOR_RESET

if [[ -z "${ASCII_ONLY:-}" ]]; then
  LOG_OK="✓ SUCCESS:"
  LOG_ERROR="✗ ERROR:"
  LOG_WARN="⚠ WARNING:"
  LOG_INFO="i INFO:"
else
  LOG_OK="[OK]:"
  LOG_ERROR="[ERROR]:"
  LOG_WARN="[WARN]:"
  LOG_INFO="[INFO]:"
fi

# Public labels are consumed by the message helpers
# shellcheck disable=SC2034
readonly LOG_OK LOG_ERROR LOG_WARN LOG_INFO

# --------------------------
# Color policy
# --------------------------

# Resolve color policy for an open stream
supports_color() {
  local file_descriptor="${1:-}"
  local colors

  [[ "$file_descriptor" =~ ^[0-9]+$ ]] || return 1
  [[ -e "/dev/fd/$file_descriptor" ]] || return 1
  [[ -z "${NO_COLOR:-}" && "${TERM:-}" != dumb ]] || return 1

  case "${COLOR_MODE:-auto}" in
    always) return 0 ;;
    auto) ;;
    *) return 1 ;;
  esac

  [[ "${GITHUB_ACTIONS:-}" == true ]] && return 0
  [[ -t "$file_descriptor" && -z "${CI:-}" ]] || return 1
  command -v tput > /dev/null 2>&1 || return 1
  colors="$(tput colors 2> /dev/null)" || return 1
  [[ "$colors" =~ ^[1-9][0-9]*$ && "$colors" -ge 8 ]]
}

# Mark initialization complete
readonly _CORE_LOADED=1
