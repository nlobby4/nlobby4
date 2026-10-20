#!/usr/bin/env bash
set -euo pipefail

gitleaks git --redact --config .gitleaks.toml .
