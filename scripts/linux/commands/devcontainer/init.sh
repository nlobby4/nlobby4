#!/usr/bin/env bash

# Wait for the isolated Docker-in-Docker daemon before running health checks.

# Exit on command errors and unset variables, and propagate pipeline failures.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/recover-bootstrap.sh"
. "$SCRIPT_DIR/../../utils/functions/core.sh" || exit 1
set +e
TIMEOUT_BIN="$(find_timeout)"
timeout_status="$?"
set -e
[[ "$timeout_status" -eq 0 ]] || exit 1
readonly TIMEOUT_BIN

if ! "$TIMEOUT_BIN" --signal=TERM --kill-after=1s 30s bash -c '
  until docker version >/dev/null 2>&1; do sleep 1; done
'; then
  printf 'Docker-in-Docker did not become ready within 30 seconds. Data volumes were preserved. Run devcontainer-recover.sh --restart on the host for a bounded restart and validation.\n' >&2
  exit 1
fi

# Validation must not implicitly install tools via mise shims.
set_mise_auto_install false
exec "$TIMEOUT_BIN" --signal=TERM --kill-after=2s 300s bash "$SCRIPT_DIR/../repository/health.sh"
