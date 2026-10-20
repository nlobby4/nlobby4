#!/usr/bin/env bash

# --------------------------------------------------
# Git attributes verification script.
#
# This script checks whether organization-owned tracked files have a corresponding
# rule in .gitattributes (e.g. to enforce consistent text handling)
# and detects overlapping rules. Projects own their specific attributes policy.
#
# Usage:
# ./scripts/linux/commands/tasks/attributes.sh
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
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command git
check_file .gitattributes

# --------------------------
# Verification
# --------------------------

missing_attributes=()
attribute_temp="$(mktemp -d)"
trap 'rm -rf -- "$attribute_temp"' EXIT
git ls-files -z -- ':!projects/**' > "$attribute_temp/files"
git check-attr -z --stdin -a < "$attribute_temp/files" > "$attribute_temp/attributes"
while IFS= read -r -d '' path \
  && IFS= read -r -d '' attribute \
  && IFS= read -r -d '' value; do
  if [[ "$attribute" == "text" && "$value" == "auto" ]]; then
    missing_attributes+=("$path")
  fi
done < "$attribute_temp/attributes"

if [[ "${#missing_attributes[@]}" -gt 0 ]]; then
  log_warning ".gitattributes rule missing for the following files:"
  printf '%s\n' "${missing_attributes[@]}"
else
  log_ok "All files have a corresponding rule in .gitattributes"
fi

uppercase_extensions=()
while IFS= read -r -d '' path; do
  filename="${path##*/}"

  # Dotfiles without another dot, such as .gitignore, do not have an extension.
  if [[ "$filename" == .* && "$filename" != *.*.* ]]; then
    continue
  fi

  if [[ "$filename" == *.* ]]; then
    extension="${filename##*.}"
    if [[ "$extension" =~ [[:upper:]] ]]; then
      uppercase_extensions+=("$path")
    fi
  fi
done < "$attribute_temp/files"

if [[ "${#uppercase_extensions[@]}" -gt 0 ]]; then
  log_warning "Uppercase file extensions found:"
  printf '%s\n' "${uppercase_extensions[@]}"
else
  log_ok "No uppercase file extensions detected"
fi

# --------------------------
# Overlap detection
# --------------------------

# Rewrites each .gitattributes pattern with a unique marker attribute
# (ov_rule_N=set) and supplies it to git as an *additional* attributes
# file via -c core.attributesFile, leaving the real .gitattributes
# untouched. For every tracked file, `git check-attr --all` then
# reveals exactly which marker(s) fired, i.e. which original patterns
# matched that file. Broad rules may appear before more specific rules, but
# broad rules after specific rules are reported because Git attributes are
# order-sensitive and later matches can override earlier attribute values.

pattern_specificity() {
  local pattern="${1:-}"
  local literal="$pattern"
  local without_slashes="$pattern"

  literal="${literal//\*/}"
  literal="${literal//\?/}"
  literal="${literal//\[/}"
  literal="${literal//\]/}"

  without_slashes="${without_slashes//\//}"

  # Prefer path-specific rules, then rules with more literal characters.
  printf '%d\n' "$(((${#pattern} - ${#without_slashes}) * 1000 + ${#literal}))"
}

tmp_rules="$attribute_temp/rules"
: > "$tmp_rules"

line_no=0
patterns=()
declare -A pattern_by_line=()
declare -A pattern_score_by_line=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line_no=$((line_no + 1))
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  pattern="${line%%[[:space:]]*}"

  patterns+=("$line_no:$pattern")
  pattern_by_line["$line_no"]="$pattern"
  pattern_score_by_line["$line_no"]="$(pattern_specificity "$pattern")"
  printf '%s ov_rule_%d=set\n' "$pattern" "$line_no" >> "$tmp_rules"
done < .gitattributes

if [[ "${#patterns[@]}" -eq 0 ]]; then
  log_info "No non-default patterns found in .gitattributes"
else
  status=0
  declare -A file_rules=()
  git ls-files -z ':!.gitattributes' ':!projects/**' \
    | git -c core.attributesFile="$tmp_rules" check-attr -z --all --stdin > "$attribute_temp/overlaps"
  while IFS= read -r -d '' path \
    && IFS= read -r -d '' attribute \
    && IFS= read -r -d '' value; do
    [[ "$value" == "set" ]] || continue
    [[ "$attribute" == ov_rule_* ]] || continue
    file_rules["$path"]+="${attribute#ov_rule_} "
  done < "$attribute_temp/overlaps"

  found_overlap=0
  for path in "${!file_rules[@]}"; do
    rule_list=()
    read -ra rule_list <<< "${file_rules[$path]}"
    if [[ "${#rule_list[@]}" -gt 1 ]]; then
      max_score=-1
      max_rules=()
      for rule_number in "${rule_list[@]}"; do
        rule_score="${pattern_score_by_line[$rule_number]}"
        if [[ "$rule_score" -gt "$max_score" ]]; then
          max_score="$rule_score"
          max_rules=("$rule_number")
        elif [[ "$rule_score" -eq "$max_score" ]]; then
          max_rules+=("$rule_number")
        fi
      done

      # Matching a broad rule and a more specific rule is intentional. Only
      # report here when multiple most-specific rules still compete for the file.
      if [[ "${#max_rules[@]}" -gt 1 ]]; then
        found_overlap=1
        status=1
        desc=""
        for rule_number in "${max_rules[@]}"; do
          desc+="line $rule_number ('${pattern_by_line[$rule_number]}') "
        done
        log_warning "$path -> matched by $desc"
        continue
      fi
    fi

    highest_score_so_far=-1
    highest_rule_so_far=""
    for rule_number in "${rule_list[@]}"; do
      rule_score="${pattern_score_by_line[$rule_number]}"
      if [[ "$rule_score" -lt "$highest_score_so_far" ]]; then
        found_overlap=1
        status=1
        log_warning \
          "$path -> broader line $rule_number ('${pattern_by_line[$rule_number]}') appears after more specific line $highest_rule_so_far ('${pattern_by_line[$highest_rule_so_far]}')"
        break
      fi

      if [[ "$rule_score" -gt "$highest_score_so_far" ]]; then
        highest_score_so_far="$rule_score"
        highest_rule_so_far="$rule_number"
      fi
    done
  done

  if [[ "$found_overlap" -eq 0 ]]; then
    log_ok "No overlapping .gitattributes rules detected"
  fi

  exit "$status"
fi
