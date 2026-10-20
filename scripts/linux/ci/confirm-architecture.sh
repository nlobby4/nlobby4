#!/usr/bin/env bash
# Fail on command errors, unset variables, and masked pipeline failures.
set -euo pipefail

: "${EXPECTED_PLATFORM:?EXPECTED_PLATFORM is required}"
architecture="$(uname --machine)"
case "$architecture" in
  aarch64) architecture=arm64 ;;
  x86_64) architecture=amd64 ;;
  *)
    printf 'unsupported architecture: %s\n' "$architecture" >&2
    exit 1
    ;;
esac
docker_os="$(docker info --format '{{.OSType}}')"
test "$docker_os/$architecture" = "$EXPECTED_PLATFORM"
