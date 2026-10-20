#!/usr/bin/env bash
# Fail on command errors, unset variables, and masked pipeline failures.
set -euo pipefail

sudo apt-get update
sudo apt-get install --yes --no-install-recommends cmark-gfm
