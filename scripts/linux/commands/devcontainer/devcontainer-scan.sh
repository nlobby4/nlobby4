#!/usr/bin/env bash

# --------------------------------------------------
# Development container image security scan.
#
# Builds the local development-container image by default, scans it for high
# and critical vulnerabilities and secrets, and generates an SPDX JSON SBOM.
# CI can provide an existing image with DEVCONTAINER_IMAGE and disable the
# build with DEVCONTAINER_SCAN_BUILD=false.
#
# Usage:
# mise run devcontainer:scan
# pnpm run devcontainer:scan
#
# Manual path with an existing image:
# DEVCONTAINER_IMAGE=example@sha256:... DEVCONTAINER_SCAN_BUILD=false \
#   bash scripts/linux/commands/devcontainer/devcontainer-scan.sh
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

image="${DEVCONTAINER_IMAGE:-nlobby4-devcontainer:scan}"
build_image="${DEVCONTAINER_SCAN_BUILD:-true}"
sbom_output="${DEVCONTAINER_SBOM_OUTPUT:-.generated/devcontainer.spdx.json}"
export TRIVY_CACHE_DIR="${TRIVY_CACHE_DIR:-.cache/trivy}"

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command trivy
check_file .trivyignore.yaml

case "$build_image" in
  true | false) ;;
  *)
    log_error "DEVCONTAINER_SCAN_BUILD must be true or false"
    exit 1
    ;;
esac

if [[ "$build_image" == true ]]; then
  check_command devcontainer
  check_command docker
  docker info > /dev/null

  log_info "Building development container image $image..."
  devcontainer build \
    --workspace-folder . \
    --frozen-lockfile \
    --image-name "$image"
fi

# --------------------------
# Scan and SBOM
# --------------------------

mkdir -p "$TRIVY_CACHE_DIR" "$(dirname -- "$sbom_output")"

log_info "Generating SPDX JSON SBOM at $sbom_output..."
trivy image \
  --format spdx-json \
  --output "$sbom_output" \
  "$image"

log_info "Scanning $image for high and critical vulnerabilities and secrets..."
trivy image \
  --exit-code 1 \
  --ignorefile .trivyignore.yaml \
  --scanners vuln,secret \
  --severity HIGH,CRITICAL \
  "$image"

log_ok "Development container security scan passed"
