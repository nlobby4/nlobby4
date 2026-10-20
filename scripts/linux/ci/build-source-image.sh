#!/usr/bin/env bash
# Fail on command errors, unset variables, and masked pipeline failures.
set -euo pipefail

: "${IMAGE:?IMAGE is required}"
. "$(dirname -- "${BASH_SOURCE[0]}")/source-date-epoch.sh"
mkdir -p .generated
devcontainer build --workspace-folder . --no-cache --frozen-lockfile --image-name "$IMAGE" \
  --output "type=docker,rewrite-timestamp=true"
