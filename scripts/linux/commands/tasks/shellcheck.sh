#!/usr/bin/env bash

# --------------------------------------------------
# ShellCheck runner.
#
# Checks shell and ordinary project scripts with the shared ShellCheck binary.
# Native configuration discovery respects project .shellcheckrc overrides and
# falls back to the shell configuration. Independent submodules are excluded.
#
# Usage:
# ./scripts/linux/commands/tasks/shellcheck.sh
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
check_command shellcheck

# --------------------------
# Collect shell scripts
# --------------------------

shell_files=()
declare -A seen_shell_files

add_shell_file() {
  local file="${1:-}"

  [[ -n "$file" && -f "$file" ]] || return 0
  [[ -z "${seen_shell_files[$file]:-}" ]] || return 0

  shell_files+=("$file")
  seen_shell_files["$file"]=1
}

has_shell_shebang() {
  local file="${1:-}"
  local first_line

  [[ -n "$file" && -f "$file" ]] || return 1
  IFS= read -r first_line < "$file" || return 1

  [[ "$first_line" =~ ^'#!'.*(^|[/[:space:]])(ba)?sh([[:space:]]|$) ]]
}

shell_list="$(mktemp)"
trap 'rm -f -- "$shell_list"' EXIT
git ls-files --cached --others --exclude-standard --deduplicate -z -- \
  '*.sh' '.husky/*' ':!.husky/_/**' ':!projects/submodules/**' > "$shell_list"
while IFS= read -r -d '' file; do
  add_shell_file "$file"
done < "$shell_list"

git ls-files --cached --others --exclude-standard --deduplicate -z -- \
  ':!.husky/_/**' ':!projects/submodules/**' > "$shell_list"
while IFS= read -r -d '' file; do
  set +e
  has_shell_shebang "$file"
  shebang_status="$?"
  set -e
  if [[ "$shebang_status" -eq 0 ]]; then
    add_shell_file "$file"
  fi
done < "$shell_list"

if [[ "${#shell_files[@]}" -eq 0 ]]; then
  log_ok "No shell scripts found"
  exit 0
fi

# --------------------------
# ShellCheck
# --------------------------

log_info "Running ShellCheck on ${#shell_files[@]} shell scripts..."

shellcheck "${shell_files[@]}"

script_label="$(plural_label "${#shell_files[@]}" "script" "scripts")"
log_ok "ShellCheck passed for ${#shell_files[@]} shell $script_label"
