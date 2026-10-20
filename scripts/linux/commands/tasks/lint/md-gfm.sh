#!/usr/bin/env bash

# --------------------------------------------------
# GFM conformance smoke test.
#
# Parses repository Markdown with GitHub's cmark-gfm extensions enabled. The
# authoring policy and actionable diagnostics remain owned by markdownlint.
# --------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/logging/logging.sh"

check_repository_root
check_command cmark-gfm
check_command git

required_extensions=(autolink strikethrough table tagfilter tasklist)
available_extensions="$(cmark-gfm --list-extensions)"

for extension in "${required_extensions[@]}"; do
  if ! grep -qx "$extension" <<< "$available_extensions"; then
    log_error "cmark-gfm extension is unavailable: $extension"
    exit 1
  fi
done

markdown_files=()
markdown_file_list="$(mktemp)"
trap 'rm -f -- "$markdown_file_list"' EXIT

git ls-files --cached --others --exclude-standard -z -- '*.md' ':!projects/**' \
  > "$markdown_file_list"

while IFS= read -r -d '' file; do
  markdown_files+=("$file")
done < "$markdown_file_list"

if [[ "${#markdown_files[@]}" -eq 0 ]]; then
  log_ok "No Markdown files found"
  exit 0
fi

for file in "${markdown_files[@]}"; do
  cmark-gfm \
    --validate-utf8 \
    --extension autolink \
    --extension strikethrough \
    --extension table \
    --extension tagfilter \
    --extension tasklist \
    "$file" > /dev/null
done

log_ok "cmark-gfm parsed ${#markdown_files[@]} Markdown files"
