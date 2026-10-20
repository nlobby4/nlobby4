#!/usr/bin/env bash
set -euo pipefail

gitleaks git --staged --redact --config .gitleaks.toml .
