#!/usr/bin/env bash

# --------------------------------------------------
# Workspace readiness context script.
#
# Reports OS, architecture, execution context and workspace readiness.
# Checks write access, cache/storage capacity and the container image contract.
#
# Prints status rows to stdout and diagnostics to stderr.
# Returns nonzero on failed checks without creating caches or pruning storage.
#
# Usage:
# bash scripts/linux/commands/repository/validation/workspace-status.sh
# --------------------------------------------------

# Exit on command errors and unset variables, and propagate pipeline failures
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || exit 1
. "$SCRIPT_DIR/../../../utils/functions/validation.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/logging/status.sh" || exit 1

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false
readonly SCRIPT_DIR

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command uname
check_command python3
check_command jq
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN

# --------------------------
# Helpers
# --------------------------

# Describe the operating system including Windows compatibility shells
_detect_os_name() {
  local kernel_name os_name

  kernel_name="$(uname -s)" || return 1

  case "$kernel_name" in
    MINGW* | MSYS* | CYGWIN*)
      printf '%s' "Windows"
      return
      ;;
    Linux) ;;
    *)
      printf '%s' "$kernel_name"
      return
      ;;
  esac

  os_name="$(run_command "$TIMEOUT_BIN" --signal=TERM --kill-after=1s 5s python3 -c '
import platform
try:
    print(platform.freedesktop_os_release()["PRETTY_NAME"])
except FileNotFoundError:
    print("Linux")
' < /dev/null)" || return "$?"
  printf '%s' "${os_name:-$kernel_name}"
}

# Describe the machine architecture using common container platform names
_detect_architecture() {
  local architecture

  architecture="$(uname -m)" || return 1

  case "$architecture" in
    aarch64) printf '%s' "arm64 (aarch64)" ;;
    x86_64) printf '%s' "amd64 (x86_64)" ;;
    *) printf '%s' "$architecture" ;;
  esac
}

# --------------------------
# Workspace context
# --------------------------

status_reset
overall_status=0
workspace_environment="$(execution_environment)"

set +e
workspace_os="$(_detect_os_name)"
workspace_os_status="$?"
workspace_architecture="$(_detect_architecture)"
workspace_architecture_status="$?"
set -e

if [[ "$workspace_os_status" -eq 0 && -n "$workspace_os" ]]; then
  status_add "Workspace operating system" "$workspace_os"
else
  status_add "Workspace operating system" "unavailable" "${COLOR_RED:-}"
  overall_status=1
fi

if [[ "$workspace_architecture_status" -eq 0 &&
  -n "$workspace_architecture" ]]; then
  status_add "Workspace architecture" "$workspace_architecture"
else
  status_add "Workspace architecture" "unavailable" "${COLOR_RED:-}"
  overall_status=1
fi

status_add "Workspace environment" "$workspace_environment"

# Context alone does not prove that the mounted workspace is usable.
git_directory="$(git rev-parse --absolute-git-dir)"
git_common_directory="$(git rev-parse --git-common-dir)"
if [[ -w . && -x . && -w "$git_directory" && -x "$git_directory" &&
  -w "$git_common_directory" && -x "$git_common_directory" ]]; then
  status_add "Workspace write access" "available"
else
  status_add "Workspace write access" "workspace or Git metadata is not writable" "${COLOR_RED:-}"
  overall_status=1
fi

temporary_directory="${TMPDIR:-/tmp}"
if [[ -d "$temporary_directory" && -w "$temporary_directory" && -x "$temporary_directory" ]]; then
  status_add "Temporary directory" "writable"
else
  status_add "Temporary directory" "missing or not writable" "$COLOR_RED"
  overall_status=1
fi

cache_status="writable"
for cache in .cache/knip .cache/prettier .cache/commitizen .cache/python .cache/trivy; do
  if [[ ! -d "$cache" || ! -w "$cache" || ! -x "$cache" ]]; then
    cache_status="missing or not writable ($cache)"
    break
  fi
done
if [[ "$cache_status" == writable ]]; then
  status_add "Repository caches" "$cache_status"
else
  status_add "Repository caches" "$cache_status" "$COLOR_RED"
  overall_status=1
fi

if [[ -n "${NPM_CONFIG_STORE_DIR:-}" ]]; then
  if [[ -d "$NPM_CONFIG_STORE_DIR" && -w "$NPM_CONFIG_STORE_DIR" && -x "$NPM_CONFIG_STORE_DIR" ]]; then
    status_add "pnpm store" "writable"
  else
    status_add "pnpm store" "missing or not writable" "${COLOR_RED:-}"
    overall_status=1
  fi
fi

if [[ "$workspace_environment" != "Local shell" ]]; then
  contract_output="$(run_command "$TIMEOUT_BIN" --signal=TERM --kill-after=1s 20s \
    python3 "$SCRIPT_DIR/../../../../python/devcontainer-state.py" check < /dev/null 2>&1)" \
    && contract_status=0 || contract_status="$?"
  contract_output="${contract_output//$'\n'/; }"
  contract_output="${contract_output//$'\r'/}"
  if [[ "$contract_status" -eq 0 && -n "$contract_output" ]]; then
    status_add "Image contract" "$contract_output"
  else
    status_add "Image contract" "${contract_output:-unable to verify}" "${COLOR_RED:-}"
    overall_status=1
  fi
fi

if [[ "$workspace_environment" == "GitHub Codespaces" ]]; then
  if [[ -n "${CODESPACE_NAME:-}" ]]; then
    status_add "Codespace name" "$CODESPACE_NAME"
  else
    status_add "Codespace name" "unavailable"
  fi
fi

# Report failures as authentic colored values; never prune caches automatically.
capacity_output="$(run_command "$TIMEOUT_BIN" --signal=TERM --kill-after=1s 10s \
  python3 "$SCRIPT_DIR/../../../../python/devcontainer-capacity.py" < /dev/null)" \
  && capacity_status=0 || capacity_status="$?"
if [[ "$capacity_status" -eq 0 ]]; then
  set +e
  status_import_json "$capacity_output"
  capacity_status="$?"
  set -e
  if [[ "$capacity_status" -eq 2 ]]; then
    status_add "Storage capacity" "unable to inspect" "$COLOR_RED"
  fi
else
  status_add "Storage capacity" "unable to inspect" "$COLOR_RED"
fi
[[ "$capacity_status" -eq 0 ]] || overall_status=1

status_print
exit "$overall_status"
