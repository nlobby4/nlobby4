#!/usr/bin/env bash

# --------------------------------------------------
# Dockerfile lint checks for the shell and ordinary projects.
#
# Restricts the devcontainer to Microsoft's registry, verifies lint fixtures,
# and checks project Dockerfiles using project config or shell defaults.
# Submodules are not scanned or initialized.
#
# Usage:
# bash scripts/linux/commands/tasks/lint/dockerfile.sh
# --------------------------------------------------

set -euo pipefail

hadolint --config .hadolint.yaml --trusted-registry mcr.microsoft.com .devcontainer/Dockerfile
hadolint --config .hadolint.yaml --trusted-registry mcr.microsoft.com policy/fixtures/dockerfile/valid.Dockerfile

if hadolint --config .hadolint.yaml --trusted-registry mcr.microsoft.com policy/fixtures/dockerfile/invalid.Dockerfile > /dev/null 2>&1; then
  echo "invalid Dockerfile fixture unexpectedly passed" >&2
  exit 1
fi

node scripts/node/bin/workspace-check.js lint:dockerfile
