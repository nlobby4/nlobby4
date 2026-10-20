#!/usr/bin/env bash

# --------------------------------------------------
# Local GitHub Actions validation script.
#
# Runs act with repository-local defaults for workflow testing.
# This is intended to catch workflow wiring and script issues locally,
# not to replace GitHub-hosted Actions execution.
#
# Usage:
# ./scripts/linux/commands/tasks/act.sh [--list]
# ./scripts/linux/commands/tasks/act.sh [pull_request|push] [job]
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

# --------------------------
# Setup
# --------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../utils/logging/logging.sh"

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command act
check_command docker

# --------------------------
# Configuration
# --------------------------

ACT_EVENT="pull_request"
ACT_JOB=""
ACT_LIST=false
ACT_EVENT_PATH=".github/act/pull_request.json"
ACT_ENV_FILE=".github/act/env"
ACT_SECRETS_FILE=".github/act/secrets"

# --------------------------
# Arguments
# --------------------------

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --list)
      ACT_LIST=true
      shift
      ;;
    pull_request | push)
      ACT_EVENT="$1"
      shift
      ;;
    *)
      if [[ -z "$ACT_JOB" ]]; then
        ACT_JOB="$1"
        shift
      else
        log_error "Unexpected argument: $1"
        exit 1
      fi
      ;;
  esac
done

case "$ACT_EVENT" in
  pull_request)
    ACT_EVENT_PATH=".github/act/pull_request.json"
    ;;
  push)
    ACT_EVENT_PATH=".github/act/push.json"
    ;;
  *)
    log_error "Unsupported local act event: $ACT_EVENT"
    exit 1
    ;;
esac

# --------------------------
# Act
# --------------------------

act_args=(
  "--container-architecture" "linux/amd64"
  "--platform" "ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-latest"
)

if [[ -f "$ACT_EVENT_PATH" ]]; then
  act_args+=("--eventpath" "$ACT_EVENT_PATH")
fi

if [[ -f "$ACT_ENV_FILE" ]]; then
  act_args+=("--env-file" "$ACT_ENV_FILE")
fi

if [[ -f "$ACT_SECRETS_FILE" ]]; then
  act_args+=("--secret-file" "$ACT_SECRETS_FILE")
fi

if [[ "$ACT_LIST" == true ]]; then
  log_info "Listing local GitHub Actions workflow tests with act..."
  act --list "${act_args[@]}"
  exit 0
fi

log_info "Running local GitHub Actions workflow test for $ACT_EVENT with act..."

if [[ -n "$ACT_JOB" ]]; then
  act "$ACT_EVENT" -j "$ACT_JOB" "${act_args[@]}"
else
  act "$ACT_EVENT" "${act_args[@]}"
fi
