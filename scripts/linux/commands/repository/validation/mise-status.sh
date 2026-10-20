#!/usr/bin/env bash

# --------------------------------------------------
# mise readiness validation script.
#
# Verifies the active mise runtime, configuration, tools, trust, and lock state.
#
# Prints status rows to stdout and diagnostics to stderr.
# Returns nonzero on failed checks without installing tools or rewriting locks.
#
# Usage:
# bash scripts/linux/commands/repository/validation/mise-status.sh
# --------------------------------------------------

# Exit on command errors and unset variables, and propagate pipeline failures
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || exit 1
. "$SCRIPT_DIR/../../../utils/filters/filters.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/logging/status.sh" || exit 1

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false
MISE_CONFIG="mise.toml"
MISE_LOCKFILE="mise.lock"
VERSION_MANIFEST=".devcontainer/versions.env"
MISE_METADATA_TIMEOUT=5
MISE_LOCK_TIMEOUT=15
readonly \
  SCRIPT_DIR \
  MISE_CONFIG \
  MISE_LOCKFILE \
  VERSION_MANIFEST \
  MISE_METADATA_TIMEOUT \
  MISE_LOCK_TIMEOUT

# --------------------------
# Helpers
# --------------------------

# Run a probe within both its own timeout and the shared command budget
_mise_probe() {
  local limit="$1"
  local remaining="$((MISE_PROBE_DEADLINE - SECONDS))"
  shift
  [[ "$remaining" -gt 0 ]] || return 124
  [[ "$limit" -le "$remaining" ]] || limit="$remaining"
  "$TIMEOUT_BIN" \
    --signal=TERM \
    --kill-after=1s \
    "${limit}s" \
    "$@" < /dev/null
}

# Run mise metadata probes without exhausting info.sh's overall deadline
_mise_command() {
  _mise_probe "$MISE_METADATA_TIMEOUT" "$MISE_BIN" "$@"
}

# Check whether a numeric dotted version meets a minimum version
_version_at_least() {
  local actual="${1:-}"
  local minimum="${2:-}"
  local actual_parts minimum_parts index actual_part minimum_part

  [[ "$actual" =~ ^[0-9]{1,9}(\.[0-9]{1,9})*$ ]] || return 1
  [[ "$minimum" =~ ^[0-9]{1,9}(\.[0-9]{1,9})*$ ]] || return 1

  IFS='.' read -r -a actual_parts <<< "$actual"
  IFS='.' read -r -a minimum_parts <<< "$minimum"

  for ((index = 0; index < ${#actual_parts[@]} || index < ${#minimum_parts[@]}; index += 1)); do
    actual_part="${actual_parts[index]:-0}"
    minimum_part="${minimum_parts[index]:-0}"

    if ((10#$actual_part > 10#$minimum_part)); then
      return 0
    elif ((10#$actual_part < 10#$minimum_part)); then
      return 1
    fi
  done

  return 0
}

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command jq
check_command python3
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN
# Share a 40-second command budget across metadata, executable and lock probes
MISE_PROBE_DEADLINE="$((SECONDS + 40))"
readonly MISE_PROBE_DEADLINE
check_file "$MISE_CONFIG"
check_file "$MISE_LOCKFILE"
check_file "$VERSION_MANIFEST"

mise_environment="$(execution_environment)"
if [[ "$mise_environment" != 'Local shell' && -x /usr/local/bin/mise ]]; then
  MISE_BIN="/usr/local/bin/mise"
  mise_source="devcontainer system"
else
  MISE_BIN="$(command -v mise || true)"
  check_argument "$MISE_BIN" "mise executable"

  case "$MISE_BIN" in
    /bin/* | /sbin/* | /usr/bin/* | /usr/sbin/* | /usr/local/bin/* | /usr/local/sbin/*)
      mise_source="host system"
      ;;
    *)
      mise_source="host user"
      ;;
  esac
fi
readonly MISE_BIN

expected_mise_version="$(
  run_filter awk \
    env-value \
    "$VERSION_MANIFEST" \
    -v variable_name=MISE_VERSION
)"
check_argument "$expected_mise_version" "expected mise version"

status_reset
overall_status=0

# --------------------------
# mise runtime
# --------------------------

set +e
mise_version_output="$(_mise_command --version 2> /dev/null)"
mise_version_command_status="$?"
set -e

mise_version=""
mise_platform=""
if [[ "$mise_version_command_status" -eq 0 ]]; then
  read -r mise_version mise_platform _ <<< "$mise_version_output"
  if [[ ! "$mise_version" =~ ^[0-9]{1,9}(\.[0-9]{1,9})+$ ||
    ! "$mise_platform" =~ ^[a-z0-9]+-[a-z0-9]+$ ||
    "$mise_version_output" == *$'\n'* || "$mise_version_output" == *$'\r'* ]]; then
    mise_version=''
  fi
fi

if [[ -n "$mise_version" ]]; then
  if [[ "$mise_environment" != 'Local shell' ]]; then
    mise_version_status="$mise_version (expected $expected_mise_version)"
    if [[ "$mise_version" == "$expected_mise_version" ]]; then
      status_add "mise version" "$mise_version_status"
    else
      status_add "mise version" "$mise_version_status" "${COLOR_RED:-}"
      overall_status=1
    fi
  else
    set +e
    minimum_mise_version="$(_mise_command config get min_version --file "$MISE_CONFIG" 2> /dev/null)"
    minimum_version_status="$?"
    set -e
    if [[ ! "$minimum_mise_version" =~ ^[0-9]{1,9}(\.[0-9]{1,9})*$ ]]; then
      minimum_mise_version=''
      minimum_version_status=1
    fi

    mise_version_status="$mise_version (minimum ${minimum_mise_version:-unavailable})"
    version_requirement_status=1
    if [[ "$minimum_version_status" -eq 0 ]]; then
      set +e
      _version_at_least "$mise_version" "$minimum_mise_version"
      version_requirement_status="$?"
      set -e
    fi

    if [[ "$version_requirement_status" -eq 0 ]]; then
      status_add "mise version" "$mise_version_status"
    else
      status_add "mise version" "$mise_version_status" "${COLOR_RED:-}"
      overall_status=1
    fi
  fi
else
  status_add "mise version" "unavailable" "${COLOR_RED:-}"
  overall_status=1
fi

if [[ "$mise_environment" != 'Local shell' && "$mise_source" != 'devcontainer system' ]]; then
  status_add "mise source" "$mise_source (expected devcontainer system)" "$COLOR_RED"
  overall_status=1
else
  status_add "mise source" "$mise_source"
fi

if [[ -z "$mise_version" ]]; then
  status_add "mise configuration" "unable to verify" "${COLOR_RED:-}"
  status_add "mise trust" "unable to verify" "${COLOR_RED:-}"
  status_add "mise tools" "unable to verify" "${COLOR_RED:-}"
  status_add "mise lock" "unable to verify" "${COLOR_RED:-}"
  status_print
  exit 1
fi

# --------------------------
# Configuration and trust
# --------------------------

set +e
config_output="$(_mise_command config ls --json 2> /dev/null)"
config_status="$?"
set -e

repository_root="$(pwd -P)"
config_path="$repository_root/$MISE_CONFIG"
if [[ "$config_status" -ne 0 ]] \
  || ! jq --exit-status 'type == "array"' \
    <<< "$config_output" > /dev/null 2>&1; then
  status_add \
    "mise configuration" \
    "unable to verify" \
    "${COLOR_RED:-}"
  overall_status=1
elif jq \
  --exit-status \
  --arg config_path "$config_path" \
  'any(.[]; type == "object" and .path? == $config_path)' \
  <<< "$config_output" \
  > /dev/null; then
  status_add "mise configuration" "$MISE_CONFIG (active)"
else
  status_add \
    "mise configuration" \
    "$MISE_CONFIG (inactive)" \
    "${COLOR_RED:-}"
  overall_status=1
fi

set +e
trust_output="$(_mise_command trust --show 2> /dev/null)"
trust_status="$?"
set -e

repository_trusted=1
if [[ "$trust_status" -eq 0 ]]; then
  while IFS= read -r trust_entry; do
    [[ "$trust_entry" == *": trusted" ]] || continue

    trust_path="${trust_entry%: trusted}"
    if [[ "$trust_path" == "~" ]]; then
      trust_path="${HOME:-}"
    elif [[ "$trust_path" == \~/* ]]; then
      trust_path="${HOME:-}/${trust_path#\~/}"
    fi

    if [[ -n "$trust_path" && "$trust_path" -ef "$repository_root" ]]; then
      repository_trusted=0
      break
    fi
  done <<< "$trust_output"
fi

if [[ "$repository_trusted" -eq 0 ]]; then
  status_add "mise trust" "trusted"
elif [[ "$trust_status" -ne 0 ]]; then
  status_add "mise trust" "unable to verify" "${COLOR_RED:-}"
  overall_status=1
else
  status_add "mise trust" "not trusted" "${COLOR_RED:-}"
  overall_status=1
fi

# --------------------------
# Tool installation state
# --------------------------

set +e
missing_output="$(_mise_command ls --current --missing --json 2> /dev/null)"
missing_status="$?"
set -e

if [[ "$missing_status" -ne 0 ]]; then
  status_add "mise tools" "unable to verify" "${COLOR_RED:-}"
  overall_status=1
elif ! jq --exit-status 'type == "object"' \
  <<< "$missing_output" > /dev/null 2>&1; then
  status_add "mise tools" "unable to verify" "${COLOR_RED:-}"
  overall_status=1
elif jq --exit-status 'length == 0' \
  <<< "$missing_output" > /dev/null; then
  status_add "mise tools" "all configured tools installed"
else
  status_add \
    "mise tools" \
    "one or more configured tools are missing" \
    "${COLOR_RED:-}"
  overall_status=1
fi

# --------------------------
# Required executable capabilities
# --------------------------

failed_executables=()
set +e
configured_commands="$(_mise_probe 5 python3 "$SCRIPT_DIR/../../../../python/mise-tool-commands.py" "$MISE_CONFIG")"
configured_commands_status="$?"
set -e
while IFS=$'\t' read -r executable version_argument expected_version; do
  [[ "$configured_commands_status" -eq 0 ]] || break
  if [[ ! "$executable" =~ ^[A-Za-z0-9][A-Za-z0-9_.+-]*$ ||
    ! "$version_argument" =~ ^(--version|-v|version)$ ||
    ! "$expected_version" =~ ^[0-9]+(\.[0-9]+)+$ ]]; then
    configured_commands_status=1
    break
  fi
  set +e
  executable_path="$(_mise_command which "$executable" 2> /dev/null)"
  executable_status="$?"
  set -e
  if [[ "$executable_status" -ne 0 || ! -f "$executable_path" || ! -x "$executable_path" ]]; then
    failed_executables+=("$executable")
    continue
  fi
  set +e
  executable_output="$(_mise_probe "$MISE_METADATA_TIMEOUT" "$executable_path" "$version_argument" 2> /dev/null)"
  executable_status="$?"
  set -e
  version_pattern="(^|[^[:alnum:].])v?${expected_version//./[.]}([^[:alnum:].+-]|$)"
  if [[ "$executable_status" -ne 0 || ! "$executable_output" =~ $version_pattern ]]; then
    failed_executables+=("$executable")
  fi
done <<< "$configured_commands"
if [[ "$configured_commands_status" -ne 0 || -z "$configured_commands" ]]; then
  status_add "mise executables" "unable to enumerate configured commands" "$COLOR_RED"
  overall_status=1
elif [[ "${#failed_executables[@]}" -eq 0 ]]; then
  status_add "mise executables" "configured commands runnable with pinned versions"
else
  status_add "mise executables" "unavailable or version misaligned: ${failed_executables[*]}" "${COLOR_RED:-}"
  overall_status=1
fi

# --------------------------
# Lockfile state
# --------------------------

set +e
_mise_probe 10 python3 "$SCRIPT_DIR/../../../../python/devcontainer-state.py" validate-tool-locks > /dev/null
graphs_status="$?"
set -e
if [[ "$graphs_status" -ne 0 ]]; then
  status_add "mise dependency graphs" "missing, invalid, or bootstrap misaligned" "${COLOR_RED:-}"
  overall_status=1
else
  status_add "mise dependency graphs" "native lock digests verified"
fi

set +e
lock_output="$(
  MISE_SAFE=1 _mise_probe "$MISE_LOCK_TIMEOUT" "$MISE_BIN" \
    lock \
    --dry-run \
    --json \
    --platform "$mise_platform" \
    2> /dev/null
)"
lock_status="$?"
set -e

if [[ "$lock_status" -ne 0 ]] \
  || ! jq --exit-status 'type == "array"' \
    <<< "$lock_output" > /dev/null 2>&1; then
  status_add "mise lock" "unable to verify" "${COLOR_RED:-}"
  overall_status=1
elif jq --exit-status 'length == 0' \
  <<< "$lock_output" > /dev/null; then
  status_add \
    "mise lock" \
    "version entries up to date for ${mise_platform:-current platform}"
else
  status_add \
    "mise lock" \
    'out of date; run "pnpm run devcontainer:update --locks"' \
    "${COLOR_RED:-}"
  overall_status=1
fi

status_print
exit "$overall_status"
