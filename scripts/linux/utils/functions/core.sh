#!/usr/bin/env bash

# --------------------------------------------------
# Dependency-free foundation for the repository utilities.
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
[[ -n "${_FUNCTIONS_CORE_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load only the logging foundation needed for diagnostics
_FUNCTIONS_CORE_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_FUNCTIONS_CORE_DIR/../logging/log.sh" || return 1
readonly _FUNCTIONS_CORE_DIR

# --------------------------
# Command and argument checks
# --------------------------

# Check if a command is available to the shell
check_command() {
  local command_name="${1:-}"

  if [[ -z "$command_name" ]]; then
    log_error "missing required argument: command name"
    return 1
  fi

  command -v -- "$command_name" > /dev/null 2>&1 || {
    log_error "$command_name is required but is not available"
    return 1
  }
}

# Check if a required argument is provided
check_argument() {
  local value="${1:-}"
  local name="${2:-argument}"

  if [[ -z "$value" ]]; then
    log_error "missing required argument: $name"
    return 1
  fi
}

# Check if a required argument contains exactly one line
check_single_line_argument() {
  local value="${1:-}"
  local name="${2:-argument}"

  check_argument "$value" "$name" || return 1

  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    log_error "$name must be a single line"
    return 1
  fi
}

# --------------------------
# Tool installation policy
# --------------------------

# Set both mise auto-install switches for this shell and its child processes
set_mise_auto_install() {
  local enabled="${1-false}"

  if [[ "$#" -gt 1 || ("$enabled" != true && "$enabled" != false) ]]; then
    log_error 'set_mise_auto_install expects true or false'
    return 2
  fi

  export MISE_AUTO_INSTALL="$enabled" MISE_NOT_FOUND_AUTO_INSTALL="$enabled"
}

# Run a command without mise auto-install unless --auto-install is requested
run_command() (
  local auto_install=false

  if [[ "${1:-}" == --auto-install ]]; then
    auto_install=true
    shift
  fi
  if [[ "${1:-}" == -- ]]; then
    shift
  elif [[ "${1:-}" == -* ]]; then
    log_error "unsupported run_command option: $1"
    return 2
  fi
  check_argument "${1:-}" 'command name' || return 2
  set_mise_auto_install "$auto_install" || return 2
  "$@"
)

# --------------------------
# Command selection
# --------------------------

# Find the first available command optionally matching literal version text
find_command() {
  local candidate version
  local probe_version=false
  local version_argument=--version
  local version_marker=""

  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --version-contains)
        check_argument "${2:-}" "version text" || return 2
        version_marker="$2"
        probe_version=true
        shift 2
        ;;
      --version-arg)
        check_argument "${2:-}" "version argument" || return 2
        version_argument="$2"
        probe_version=true
        shift 2
        ;;
      --)
        shift
        break
        ;;
      -*)
        log_error "unsupported find_command option: $1"
        return 2
        ;;
      *) break ;;
    esac
  done

  [[ "$#" -gt 0 ]] || {
    log_error "missing required argument: command candidates"
    return 2
  }
  for candidate in "$@"; do
    check_single_line_argument "$candidate" "command candidate" || return 2
  done

  for candidate in "$@"; do
    command -v -- "$candidate" > /dev/null 2>&1 || continue
    if [[ "$probe_version" == true ]]; then
      version="$(
        set +e
        run_command -- "$candidate" "$version_argument" 2>&1
      )" || continue
      [[ "$version" == *"$version_marker"* ]] || continue
    fi
    printf '%s\n' "$candidate"
    return 0
  done

  if [[ -n "$version_marker" ]]; then
    log_error "no matching command available: $* (required version text: $version_marker)"
  else
    log_error "no matching command available: $*"
  fi
  return 2
}

# Find GNU timeout using its common Linux and macOS command names
find_timeout() {
  find_command --version-contains '(GNU coreutils)' timeout gtimeout gnutimeout
}

# --------------------------
# Execution environment
# --------------------------

# Describe the current shell environment using platform flags and container markers
execution_environment() {
  if [[ "${CODESPACES:-}" =~ ^(1|true|TRUE)$ ]]; then
    printf '%s' 'GitHub Codespaces'
  elif [[ "${REMOTE_CONTAINERS:-}" =~ ^(1|true|TRUE)$ ||
    "${DEVCONTAINER:-}" =~ ^(1|true|TRUE)$ ]]; then
    printf '%s' 'VS Code Dev Container'
  elif [[ -f /.dockerenv || -f /run/.containerenv ]]; then
    printf '%s' 'Container'
  else
    printf '%s' 'Local shell'
  fi
}

# Mark initialization complete
readonly _FUNCTIONS_CORE_LOADED=1
