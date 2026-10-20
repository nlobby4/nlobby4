#!/usr/bin/env bash

# --------------------------------------------------
# Git ignore validation script.
#
# This script prints files and directories ignored by Git and checks
# .gitignore for duplicate or ineffective rules in the current worktree.
#
# Usage:
# ./scripts/linux/commands/tasks/ignore.sh
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

# --------------------------
# Setup
# --------------------------

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
check_file .gitignore

# --------------------------
# Ignore rules
# --------------------------

rules=()
rule_lines=()
declare -A rule_by_key=()
declare -A rule_text_by_line=()
declare -A duplicate_rules=()

line_number=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line_number="$((line_number + 1))"

  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  rule="${line%"${line##*[![:space:]]}"}"
  key="$rule"

  rules+=("$rule")
  rule_lines+=("$line_number")
  rule_text_by_line["$line_number"]="$rule"

  if [[ -n "${rule_by_key[$key]:-}" ]]; then
    duplicate_rules["$line_number"]="${rule_by_key[$key]}"
  else
    rule_by_key["$key"]="$line_number"
  fi
done < .gitignore

if [[ "${#rules[@]}" -eq 0 ]]; then
  log_warning ".gitignore has no active rules"
else
  rule_label="$(plural_label "${#rules[@]}" "rule" "rules")"
  log_info "Checking ${#rules[@]} active .gitignore $rule_label..."
fi

# --------------------------
# Ignored paths
# --------------------------

ignored_paths=()
while IFS= read -r -d '' path; do
  ignored_paths+=("${path#./}")
done < <(
  find . \
    -mindepth 1 \
    -path ./.git -prune \
    -o -path ./node_modules -prune \
    -o -name .git -prune \
    -o -print0 \
    | git check-ignore --stdin -z --no-index 2> /dev/null || true
)

if [[ "${#ignored_paths[@]}" -eq 0 ]]; then
  log_ok "No ignored files or directories found outside .git and node_modules"
else
  ignored_label="$(plural_label "${#ignored_paths[@]}" "path" "paths")"
  log_info "Ignored files and directories outside .git and node_modules (${#ignored_paths[@]} $ignored_label):"
  printf '%s\n' "${ignored_paths[@]}"
fi

# --------------------------
# Rule effectiveness
# --------------------------

declare -A effective_rules=()
while IFS= read -r -d '' source \
  && IFS= read -r -d '' line \
  && IFS= read -r -d '' _pattern \
  && IFS= read -r -d '' _path; do
  [[ "$source" == ".gitignore" ]] || continue
  effective_rules["$line"]=1
done < <(
  find . \
    -mindepth 1 \
    -path ./.git -prune \
    -o -print0 \
    | git check-ignore --stdin -z --verbose --non-matching --no-index 2> /dev/null || true
)

status=0

if [[ "${#duplicate_rules[@]}" -gt 0 ]]; then
  status=1
  log_warning "Duplicate .gitignore rules found:"
  for duplicate_line in "${!duplicate_rules[@]}"; do
    original_line="${duplicate_rules[$duplicate_line]}"
    log_warning \
      "line $duplicate_line duplicates line $original_line ('${rule_text_by_line[$duplicate_line]}')"
  done
else
  log_ok "No duplicate .gitignore rules detected"
fi

ineffective_rules=()
for index in "${!rules[@]}"; do
  line="${rule_lines[$index]}"
  rule="${rules[$index]}"

  # The deny-by-default and directory traversal rules are structural. They are
  # expected to interact with nearly every other rule in an allowlist setup.
  case "$rule" in
    "*" | "!*/" | "!/" | "!.git/" | ".git" | ".git/")
      continue
      ;;
    *) ;;
  esac

  if [[ -z "${effective_rules[$line]:-}" ]]; then
    ineffective_rules+=("line $line ('$rule')")
  fi
done

if [[ "${#ineffective_rules[@]}" -gt 0 ]]; then
  status=1
  log_warning "Rules that do not affect any current path:"
  printf '%s\n' "${ineffective_rules[@]}"
else
  log_ok "All non-structural .gitignore rules affect at least one current path"
fi

exit "$status"
