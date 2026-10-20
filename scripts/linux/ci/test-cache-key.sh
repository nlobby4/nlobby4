#!/usr/bin/env bash
# Fail on command errors, unset variables, and masked pipeline failures.
set -euo pipefail

: "${CACHE_HASH:?CACHE_HASH is required}"
: "${RUNNER_OS:?RUNNER_OS is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
printf 'value=test-%s-%s\n' "$RUNNER_OS" "$CACHE_HASH" >> "$GITHUB_OUTPUT"
