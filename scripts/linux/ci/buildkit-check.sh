#!/usr/bin/env bash
# Fail on command errors, unset variables, and masked pipeline failures.
set -euo pipefail

docker build --check --file .devcontainer/Dockerfile .
