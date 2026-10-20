#!/usr/bin/env bash
set -euo pipefail

tombi lint mise.toml
mise tasks validate --errors-only
