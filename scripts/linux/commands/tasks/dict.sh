#!/usr/bin/env bash

# --------------------------------------------------
# Dictionary validator.
#
# Checks spellcheck/*.txt dictionaries for duplicate entries, entries with no
# textual matches in repository files, and entries accepted by cspell without
# project dictionaries.
#
# Usage:
# ./scripts/linux/commands/tasks/dict.sh
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
check_command grep
check_command jq
check_command mktemp
check_command pnpm
check_command sed
check_file .cspell.json

DICTIONARY_DIR="spellcheck"
readonly DICTIONARY_DIR
check_directory "$DICTIONARY_DIR"

dictionary_files=()
dictionary_temp="$(mktemp -d)"
trap 'rm -rf -- "$dictionary_temp"' EXIT
find "$DICTIONARY_DIR" -maxdepth 1 -type f -name '*.txt' -print0 \
  | sort -z > "$dictionary_temp/files"
while IFS= read -r -d '' file; do
  dictionary_files+=("$file")
done < "$dictionary_temp/files"

if [[ "${#dictionary_files[@]}" -eq 0 ]]; then
  log_ok "$DICTIONARY_DIR has no dictionary files"
  exit 0
fi

# --------------------------
# Parse dictionary
# --------------------------

unique_words=()
duplicate_words=()
duplicate_locations=()
duplicate_first_locations=()
declare -A seen_words=()
declare -A first_seen_locations=()

for dictionary_file in "${dictionary_files[@]}"; do
  line_no=0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_no=$((line_no + 1))

    line="${line%$'\r'}"
    word="${line#"${line%%[![:space:]]*}"}"
    word="${word%"${word##*[![:space:]]}"}"

    [[ -z "$word" || "$word" == \#* ]] && continue

    location="$dictionary_file:$line_no"

    if [[ -n "${seen_words[$word]:-}" ]]; then
      duplicate_words+=("$word")
      duplicate_locations+=("$location")
      duplicate_first_locations+=("${first_seen_locations[$word]}")
    else
      seen_words["$word"]="$location"
      first_seen_locations["$word"]="$location"
      unique_words+=("$word")
    fi
  done < "$dictionary_file"
done

if [[ "${#unique_words[@]}" -eq 0 ]]; then
  log_ok "$DICTIONARY_DIR dictionary files have no active entries"
  exit 0
fi

# --------------------------
# Temporary files
# --------------------------

project_files="$dictionary_temp/project-files"
: > "$project_files"
cspell_config="$dictionary_temp/cspell.json"
cspell_output="$dictionary_temp/cspell-output"
cspell_issue_template="\$row"
dictionary_input="$dictionary_temp/input"

# --------------------------
# Collect project files
# --------------------------

git ls-files --cached --others --exclude-standard --deduplicate -z -- \
  ":!$DICTIONARY_DIR/**" ':!pnpm-lock.yaml' ':!docs/**' \
  | git check-attr -z --stdin binary > "$dictionary_temp/attributes"
while IFS= read -r -d '' path \
  && IFS= read -r -d '' attribute \
  && IFS= read -r -d '' value; do
  if [[ "$attribute" == "binary" && "$value" != "set" ]]; then
    printf '%s\0' "$path" >> "$project_files"
  fi
done < "$dictionary_temp/attributes"

if [[ ! -s "$project_files" ]]; then
  log_error "no project files found"
  exit 1
fi

# --------------------------
# Check unused entries
# --------------------------

word_is_used() {
  local word="$1"
  local escaped_word
  local file

  escaped_word="$(printf '%s' "$word" | sed 's/[][\\.^$*+?{}()|]/\\&/g')" || return 2

  while IFS= read -r -d '' file; do
    [[ -f "$file" ]] || continue

    grep -qiE \
      "(^|[^[:alnum:]])${escaped_word}([^[:alnum:]]|$)" \
      "$file"
    local grep_status="$?"
    if [[ "$grep_status" -eq 0 ]]; then
      return 0
    fi
    [[ "$grep_status" -eq 1 ]] || return "$grep_status"
  done < "$project_files"

  return 1
}

unused_words=()
unused_locations=()

for word in "${unique_words[@]}"; do
  set +e
  word_is_used "$word"
  word_status="$?"
  set -e
  if [[ "$word_status" -gt 1 ]]; then
    log_error "could not check dictionary word: $word"
    exit "$word_status"
  elif [[ "$word_status" -eq 1 ]]; then
    unused_words+=("$word")
    unused_locations+=("${first_seen_locations[$word]}")
  fi
done

# --------------------------
# Check redundant entries
# --------------------------

jq --arg root "$PWD" '
  del(.import)
  | (.dictionaries // []) |= map(select(startswith("project-") | not))
  | (.dictionaryDefinitions // []) |= map(select(.name | startswith("project-") | not))
  | (.dictionaryDefinitions // []) |= map(
      if (.path // "" | startswith("./")) then
        .path = ($root + "/" + (.path | ltrimstr("./")))
      else
        .
      end
    )
' .cspell.json > "$cspell_config"

printf '%s\n' "${unique_words[@]}" > "$dictionary_input"

pnpm exec cspell lint \
  "stdin://dictionary-redundancy.txt" \
  --root . \
  --config "$cspell_config" \
  --no-cache \
  --no-color \
  --no-exit-code \
  --no-must-find-files \
  --no-progress \
  --no-summary \
  --issue-template "$cspell_issue_template" \
  < "$dictionary_input" \
  > "$cspell_output"

redundant_words=()
redundant_locations=()
declare -A required_input_lines=()

while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[0-9]+$ ]] || continue
  required_input_lines["$line"]=1
done < "$cspell_output"

for i in "${!unique_words[@]}"; do
  input_line="$((i + 1))"
  [[ -z "${required_input_lines[$input_line]:-}" ]] || continue

  word="${unique_words[$i]}"
  redundant_words+=("$word")
  redundant_locations+=("${first_seen_locations[$word]}")
done

# --------------------------
# Report
# --------------------------

status=0

for i in "${!duplicate_words[@]}"; do
  word="${duplicate_words[$i]}"
  location="${duplicate_locations[$i]}"
  first_location="${duplicate_first_locations[$i]}"

  log_warning \
    "$word -> duplicate dictionary entry at $location" \
    "(first seen at $first_location)"
  status=1
done

for i in "${!unused_words[@]}"; do
  word="${unused_words[$i]}"
  location="${unused_locations[$i]}"

  log_warning \
    "$word -> not found in project files" \
    "($location)"
  status=1
done

for i in "${!redundant_words[@]}"; do
  word="${redundant_words[$i]}"
  location="${redundant_locations[$i]}"

  log_warning \
    "$word -> accepted by cspell without project dictionaries" \
    "($location)"
  status=1
done

if [[ "$status" -eq 0 ]]; then
  entry_label="$(
    plural_label \
      "${#unique_words[@]}" \
      "dictionary entry" \
      "dictionary entries"
  )"

  log_ok \
    "All ${#unique_words[@]} active $entry_label" \
    "in $DICTIONARY_DIR dictionary files are used, unique, and required"
  exit 0
fi

unused_count="${#unused_words[@]}"
duplicate_count="${#duplicate_words[@]}"
redundant_count="${#redundant_words[@]}"
unused_label="$(plural_label "$unused_count" "unused entry" "unused entries")"
duplicate_label="$(plural_label "$duplicate_count" "duplicate entry" "duplicate entries")"
redundant_label="$(plural_label "$redundant_count" "redundant entry" "redundant entries")"

log_info \
  "$unused_count $unused_label," \
  "$duplicate_count $duplicate_label," \
  "$redundant_count $redundant_label" \
  "found in $DICTIONARY_DIR dictionary files"

exit 1
