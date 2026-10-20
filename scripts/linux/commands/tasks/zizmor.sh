#!/usr/bin/env bash

# --------------------------------------------------
# GitHub Actions security validation script.
#
# Finds tracked and untracked GitHub Actions workflows, action definitions, and
# Dependabot configurations and audits them with zizmor. Local runs are offline
# by default; set ZIZMOR_OFFLINE=false to enable audits that require GitHub data.
#
# Usage:
# ./scripts/linux/commands/tasks/zizmor.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../utils/logging/label.sh" || exit 1
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/logging/logging.sh"

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command git
check_command zizmor

# --------------------------
# Collect GitHub Actions audit inputs
# --------------------------

input_list="$(mktemp)"
trap 'rm -f -- "$input_list"' EXIT

git ls-files \
  --cached \
  --others \
  --exclude-standard \
  -z \
  -- \
  ".github/workflows/*.yaml" \
  ".github/workflows/*.yml" \
  ".github/dependabot.yaml" \
  ".github/dependabot.yml" \
  "**/action.yaml" \
  "**/action.yml" \
  > "$input_list"

input_files=()
while IFS= read -r -d '' file; do
  [[ -f "$file" ]] || continue
  input_files+=("$file")
done < "$input_list"

if [[ "${#input_files[@]}" -eq 0 ]]; then
  log_ok "No GitHub Actions security inputs found"
  exit 0
fi

# --------------------------
# Zizmor
# --------------------------

zizmor_args=(
  "--no-progress"
  "--strict-collection"
  "--collect"
  "workflows"
  "--collect"
  "actions"
  "--collect"
  "dependabot"
)

if [[ "${ZIZMOR_OFFLINE:-true}" == "true" ]]; then
  zizmor_args+=("--offline")
fi

if [[ -n "${ZIZMOR_FORMAT:-}" ]]; then
  zizmor_args+=("--format" "$ZIZMOR_FORMAT")
fi

log_info "Running zizmor on repository GitHub Actions security inputs..."

zizmor "${zizmor_args[@]}" -- "."

input_label="$(plural_label "${#input_files[@]}" "input" "inputs")"
log_ok "zizmor passed for ${#input_files[@]} GitHub Actions security $input_label"
