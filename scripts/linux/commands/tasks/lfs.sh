#!/usr/bin/env bash

# --------------------------------------------------
# Git LFS verification script.
#
# Checks whether files matching a Git LFS rule in .gitattributes
# are stored as LFS pointers. Also detects LFS pointers that no
# longer match a .gitattributes rule.
#
# Usage:
# ./scripts/linux/commands/tasks/lfs.sh
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
check_git_lfs
check_git_lfs_configured
check_command jq
check_command mktemp
check_file .gitattributes

# --------------------------
# Verification
# --------------------------

if git rev-parse --verify HEAD > /dev/null 2>&1; then
  if ! fsck_output="$(git lfs fsck --pointers 2>&1)"; then
    printf '%s\n' "$fsck_output" >&2
    log_error "Git LFS pointer verification failed"
    exit 1
  fi
else
  log_info "Skipping Git LFS fsck because HEAD does not exist yet"
fi

# Use NUL-delimited Git output so whitespace and special characters in
# filenames do not affect parsing.
attributes_output="$(mktemp)"
actual_paths_output="$(mktemp)"
trap 'rm -f "$attributes_output" "$actual_paths_output"' EXIT

if ! git ls-files -z \
  | git check-attr -z --stdin filter \
    > "$attributes_output"; then
  log_error "Unable to read Git LFS attributes"
  exit 1
fi

expected_paths=()
declare -A expected_lfs=()
while IFS= read -r -d '' path \
  && IFS= read -r -d '' attribute \
  && IFS= read -r -d '' value; do
  if [[ "$attribute" == "filter" && "$value" == "lfs" ]]; then
    expected_paths+=("$path")
    expected_lfs["$path"]=1
  fi
done < "$attributes_output"

# Git LFS documents its JSON output as stable for scripts. Validate the
# response before extracting NUL-delimited filenames with jq.
lfs_json="$(git lfs ls-files --json)"
if ! jq -e \
  '(.files == null) or
    ((.files | type == "array") and
      all(.files[]; .name | type == "string"))' \
  > /dev/null <<< "$lfs_json"; then
  log_error "Unexpected output from git lfs ls-files --json"
  exit 1
fi

actual_paths=()
declare -A actual_lfs=()
if ! jq -j \
  '(.files // [])[] | select(.checkout != false) | .name, "\u0000"' \
  <<< "$lfs_json" \
  > "$actual_paths_output"; then
  log_error "Unable to extract Git LFS file paths"
  exit 1
fi

while IFS= read -r -d '' path; do
  actual_paths+=("$path")
  actual_lfs["$path"]=1
done < "$actual_paths_output"

# Files matching an LFS rule but not stored as LFS pointers, such as files
# committed before the rule was added without migrating them.
missing_lfs=()
for path in "${expected_paths[@]}"; do
  if [[ -z "${actual_lfs[$path]:-}" ]]; then
    missing_lfs+=("$path")
  fi
done

# LFS pointers that no longer match an LFS rule, such as files left behind
# after a rule was removed or narrowed.
orphaned_lfs=()
for path in "${actual_paths[@]}"; do
  if [[ -z "${expected_lfs[$path]:-}" ]]; then
    orphaned_lfs+=("$path")
  fi
done

# --------------------------
# Report
# --------------------------

status=0

for path in "${missing_lfs[@]}"; do
  log_warning \
    "$path -> matches filter=lfs but is not stored as an LFS pointer"
  status=1
done

for path in "${orphaned_lfs[@]}"; do
  log_warning \
    "$path -> stored as an LFS pointer but does not match filter=lfs"
  status=1
done

if [[ "$status" -eq 0 ]]; then
  tracked_count="${#expected_paths[@]}"
  file_label="$(plural_label "$tracked_count" "file" "files")"

  if [[ "$tracked_count" -eq 0 ]]; then
    log_ok "No tracked files require Git LFS"
  else
    log_ok \
      "All $tracked_count $file_label matching filter=lfs" \
      "are stored as Git LFS pointers"
  fi
else
  missing_count="${#missing_lfs[@]}"
  orphaned_count="${#orphaned_lfs[@]}"
  missing_label="$(
    plural_label \
      "$missing_count" \
      "missing LFS pointer" \
      "missing LFS pointers"
  )"
  orphaned_label="$(
    plural_label \
      "$orphaned_count" \
      "orphaned LFS pointer" \
      "orphaned LFS pointers"
  )"

  log_info \
    "$missing_count $missing_label," \
    "$orphaned_count $orphaned_label found"
fi

exit "$status"
