#!/usr/bin/env bash

# --------------------------------------------------
# Docker readiness validation script.
#
# Verifies pinned Docker/plugin versions, the local DinD daemon and builder.
# Exercises Buildx, Docker and Compose with an offline disposable workload.
# Removes only probe resources and never prunes shared caches.
#
# Prints status rows to stdout and diagnostics to stderr.
# Returns nonzero on failed checks without installing or repairing tools.
#
# Usage:
# bash scripts/linux/commands/repository/validation/docker-status.sh
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
. "$SCRIPT_DIR/../../../utils/filters/filters.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/logging/status.sh" || exit 1

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false
DEVCONTAINER_CONFIG=".devcontainer/devcontainer.json"
readonly SCRIPT_DIR DEVCONTAINER_CONFIG

# --------------------------
# Helpers
# --------------------------

# Run a bounded Docker command so an unhealthy daemon cannot stall startup
_docker_command() {
  "$TIMEOUT_BIN" --signal=TERM --kill-after=1s 5s docker "$@"
}

# Check whether dockerd is running in the current process namespace
_has_local_docker_daemon() {
  local process_name_file process_name

  for process_name_file in /proc/[0-9]*/comm; do
    [[ -r "$process_name_file" ]] || continue
    IFS= read -r process_name < "$process_name_file" || continue
    [[ "$process_name" == "dockerd" ]] && return 0
  done

  return 1
}

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command docker
check_command uname
check_command python3
expected_architecture="$(uname -m)"
case "$expected_architecture" in
  x86_64) expected_architecture=amd64 ;;
  aarch64) expected_architecture=arm64 ;;
  *) ;;
esac
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN
DOCKER_PROBE_DEADLINE="$((SECONDS + 40))"
readonly DOCKER_PROBE_DEADLINE
check_file "$DEVCONTAINER_CONFIG"

set +e
expected_versions_output="$(
  run_filter jq \
    json-prefix-match \
    "$DEVCONTAINER_CONFIG" \
    --raw-output \
    --argjson object_path '["features"]' \
    --arg key_prefix 'ghcr.io/devcontainers/features/docker-in-docker:' \
    --argjson fields '["version", "mobyBuildxVersion", "dockerDashComposeVersion"]'
)"
expected_versions_status="$?"
set -e
if [[ "$expected_versions_status" -ne 0 ]]; then
  exit 1
fi
mapfile -t expected_versions <<< "$expected_versions_output"
if [[ "${#expected_versions[@]}" -ne 3 ]]; then
  log_error "expected exactly one Docker, Buildx, and Compose version"
  exit 1
fi
expected_docker_version="${expected_versions[0]}"
expected_buildx_version="${expected_versions[1]}"
expected_compose_version="${expected_versions[2]}"
check_argument "$expected_docker_version" "expected Docker version"
check_argument "$expected_buildx_version" "expected Buildx version"
check_argument "$expected_compose_version" "expected Compose version"

if [[ ! "$expected_docker_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  log_error "invalid expected Docker version: $expected_docker_version"
  exit 1
fi

if [[ ! "$expected_buildx_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  log_error "invalid expected Buildx version: $expected_buildx_version"
  exit 1
fi

if [[ ! "$expected_compose_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  log_error "invalid expected Compose version: $expected_compose_version"
  exit 1
fi

status_reset
overall_status=0

# --------------------------
# Docker runtime
# --------------------------

set +e
version_output="$(_docker_command version --format '{{.Client.Version}}|{{.Server.Version}}|{{.Server.Os}}|{{.Server.Arch}}' 2> /dev/null)"
version_status="$?"
set -e

IFS='|' read -r client_version server_version server_os server_arch \
  <<< "$version_output"

if [[ -n "$client_version" ]]; then
  client_status="$client_version (expected $expected_docker_version)"
  if [[ "$client_version" == "$expected_docker_version" || "$client_version" == "$expected_docker_version-1" ]]; then
    status_add "Docker client" "$client_status"
  else
    status_add "Docker client" "$client_status" "${COLOR_RED:-}"
    overall_status=1
  fi
else
  status_add "Docker client" "unavailable" "${COLOR_RED:-}"
  overall_status=1
fi

if [[ "$version_status" -eq 0 && -n "$server_version" &&
  "$version_output" != *$'\n'* && "$version_output" != *$'\r'* ]]; then
  daemon_status="$server_version (${server_os:-unknown}/${server_arch:-unknown}; expected $expected_docker_version)"
  if [[ ("$server_version" == "$expected_docker_version" || "$server_version" == "$expected_docker_version-1") &&
    "$server_os" == linux && "$server_arch" == "$expected_architecture" ]]; then
    status_add "Docker daemon" "$daemon_status"
  else
    status_add "Docker daemon" "$daemon_status; expected linux/$expected_architecture" "${COLOR_RED:-}"
    overall_status=1
  fi
else
  status_add "Docker daemon" "unavailable" "${COLOR_RED:-}"
  overall_status=1
fi

set +e
_has_local_docker_daemon
local_daemon_status="$?"
set -e

if [[ "$local_daemon_status" -eq 0 ]]; then
  status_add "Local dockerd process" "detected"
else
  status_add "Local dockerd process" "not detected" "${COLOR_RED:-}"
  overall_status=1
fi

set +e
docker_context="$(_docker_command context show 2> /dev/null)"
docker_context_status="$?"
set -e
if [[ "$docker_context_status" -eq 0 && -n "$docker_context" &&
  "$docker_context" != *$'\n'* && "$docker_context" != *$'\r'* ]]; then
  status_add "Docker context" "$docker_context"
else
  docker_context=''
  status_add "Docker context" "unavailable" "$COLOR_RED"
  overall_status=1
fi

if [[ -n "${DOCKER_CONTEXT:-}" && -n "$docker_context" ]]; then
  set +e
  docker_endpoint="$(_docker_command context inspect "$docker_context" --format '{{.Endpoints.docker.Host}}' 2> /dev/null)"
  docker_endpoint_status="$?"
  set -e
elif [[ -n "${DOCKER_HOST:-}" ]]; then
  docker_endpoint="$DOCKER_HOST"
  docker_endpoint_status=0
elif [[ -n "$docker_context" ]]; then
  set +e
  docker_endpoint="$(_docker_command context inspect "$docker_context" --format '{{.Endpoints.docker.Host}}' 2> /dev/null)"
  docker_endpoint_status="$?"
  set -e
else
  docker_endpoint=""
  docker_endpoint_status=1
fi
[[ "$docker_endpoint_status" -eq 0 ]] || docker_endpoint=''
if [[ "$docker_endpoint" == *$'\n'* || "$docker_endpoint" == *$'\r'* ]]; then
  docker_endpoint=''
  docker_endpoint_status=1
fi
if [[ "$docker_endpoint_status" -eq 0 && "$docker_endpoint" == "unix:///var/run/docker.sock" ]]; then
  status_add "Docker endpoint" "$docker_endpoint"
else
  status_add "Docker endpoint" "${docker_endpoint:-unavailable} (expected local DinD socket)" "${COLOR_RED:-}"
  overall_status=1
fi

# --------------------------
# Docker plugins
# --------------------------

set +e
buildx_output="$(_docker_command buildx version 2> /dev/null)"
buildx_command_status="$?"
set -e
if [[ "$buildx_command_status" -eq 0 && "$buildx_output" =~ (^|[[:space:]])v?([0-9]+\.[0-9]+\.[0-9]+(-1)?)([[:space:]]|$) ]]; then
  buildx_version="${BASH_REMATCH[2]}"
  buildx_status="$buildx_version (expected $expected_buildx_version)"
  if [[ "$buildx_version" == "$expected_buildx_version" || "$buildx_version" == "$expected_buildx_version-1" ]]; then
    status_add "Docker Buildx" "$buildx_status"
  else
    status_add "Docker Buildx" "$buildx_status" "${COLOR_RED:-}"
    overall_status=1
  fi

  set +e
  builder_output="$(
    set -o pipefail
    # Builder health rules belong to this command, not the generic selector.
    _docker_command buildx ls --format json --timeout 5s 2> /dev/null \
      | run_filter jq \
        json-array-match \
        - \
        --raw-output \
        --slurp \
        --argjson match_path '["Current"]' \
        --argjson match_value true \
        2> /dev/null \
      | jq --raw-output '
          if (.Name | type) != "string" or (.Name | length) == 0
            or (.Name | test("[\u0000\r\n]"))
            or (.Nodes | type) != "array" or (.Nodes | length) == 0
          then error("Invalid builder name or nodes")
          else .Name, (all(.Nodes[]; .Status == "running") | tostring)
          end
        ' 2> /dev/null
  )"
  builder_status="$?"
  set -e
  mapfile -t builder_fields <<< "$builder_output"

  if [[ "$builder_status" -ne 0 || "${#builder_fields[@]}" -ne 2 ]]; then
    status_add "Docker builder" "unavailable" "${COLOR_RED:-}"
    overall_status=1
  elif [[ "${builder_fields[1]}" == "true" ]]; then
    status_add "Docker builder" "${builder_fields[0]} (running)"
  elif [[ "${builder_fields[1]}" == "false" ]]; then
    status_add \
      "Docker builder" \
      "${builder_fields[0]} (one or more nodes unavailable)" \
      "${COLOR_RED:-}"
    overall_status=1
  else
    status_add "Docker builder" "unavailable" "${COLOR_RED:-}"
    overall_status=1
  fi
else
  status_add "Docker Buildx" "unavailable" "${COLOR_RED:-}"
  overall_status=1
fi

set +e
compose_version="$(_docker_command compose version --short 2> /dev/null)"
compose_command_status="$?"
set -e
[[ "$compose_command_status" -eq 0 ]] || compose_version=''
[[ "$compose_version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]] || compose_version=''
if [[ "$compose_command_status" -eq 0 && "${compose_version#v}" == "$expected_compose_version" ]]; then
  status_add "Docker Compose" "$compose_version (expected $expected_compose_version)"
else
  status_add "Docker Compose" "${compose_version:-unavailable} (expected $expected_compose_version)" "${COLOR_RED:-}"
  overall_status=1
fi

if [[ "$overall_status" -eq 0 ]]; then
  workload_budget="$((DOCKER_PROBE_DEADLINE - SECONDS))"
  [[ "$workload_budget" -le 20 ]] || workload_budget=20
  workload_status=124
  workload_output=''
  if [[ "$workload_budget" -gt 0 ]]; then
    set +e
    workload_output="$("$TIMEOUT_BIN" --signal=TERM --kill-after=8s "${workload_budget}s" \
      python3 "$SCRIPT_DIR/../../../../python/devcontainer-workload.py" < /dev/null)"
    workload_status="$?"
    set -e
  fi
  if [[ "$workload_status" -eq 0 ]]; then
    status_add "Docker workloads" "Buildx, Docker and Compose passed; cleaned up"
  else
    status_add "Docker workloads" "${workload_output:-build, execution or cleanup failed}" "$COLOR_RED"
    overall_status=1
  fi
else
  status_add "Docker workloads" "not run; Docker prerequisites failed" "$COLOR_RED"
fi

status_print
exit "$overall_status"
