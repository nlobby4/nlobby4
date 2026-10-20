#!/usr/bin/env bash

# --------------------------------------------------
# Box rendering functions for repository scripts.
#
# This script is not meant to be run directly,
# scripts relying on these helpers source this as needed.
# --------------------------------------------------

# Guard against direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "This file is meant to be sourced, not executed directly" >&2
  exit 1
fi

# Guard against multiple sourcing
[[ -n "${_BOX_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_BOX_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_BOX_UTILS_DIR/terminal.sh" || return 1
readonly _BOX_UTILS_DIR

# --------------------------
# Boxes
# --------------------------

# Stream a terminal-width box around a file or standard input
print_box() (
  local title="${1:-}"
  local file="${2:-}"
  local border_color="${3:-}"
  local terminal_width content_width title_width
  local padding top_fill
  local top_left top_right bottom_left bottom_right horizontal vertical
  local border_reset=""
  local rendered_line

  set -o pipefail

  check_single_line_argument "$title" "box title" || return 1
  check_argument "$file" "box content file" || return 1
  title="${title//$'\t'/  }"

  if [[ -n "$border_color" ]]; then
    check_single_line_argument "$border_color" "box border color" || return 1
  fi

  if [[ "$file" != "-" ]]; then
    check_file "$file" || return 1
    exec < "$file" || return 1
  fi

  terminal_width="$(terminal_width)" || terminal_width=80
  check_unsigned_integer "$terminal_width" "terminal width" 1 || return 1
  content_width="$((terminal_width - 4))"

  if ! title_width="$(visible_width "$title" 2> /dev/null)" \
    || [[ "$((title_width + 2))" -gt "$content_width" ]]; then
    printf '%s\n' "$title"
    command cat
    return
  fi

  if [[ -z "${ASCII_ONLY:-}" ]]; then
    top_left="╭"
    top_right="╮"
    bottom_left="╰"
    bottom_right="╯"
    horizontal="─"
    vertical="│"
  else
    top_left="+"
    top_right="+"
    bottom_left="+"
    bottom_right="+"
    horizontal="-"
    vertical="|"
  fi

  if [[ -n "$border_color" ]] && supports_color 1; then
    border_reset="${COLOR_RESET:-}"
  else
    border_color=""
  fi

  printf -v top_fill '%*s' "$((content_width - title_width - 1))" ''
  printf '%s%s%s%s %s %s%s%s%s\n' \
    "$border_color" \
    "$top_left" \
    "$horizontal" \
    "$border_reset" \
    "$title" \
    "$border_color" \
    "${top_fill// /$horizontal}" \
    "$top_right" \
    "$border_reset"

  if ! run_node_script "$NODE_BIN_DIR/terminal-text.js" format-lines "$content_width" --pad \
    | while IFS= read -r rendered_line; do
      printf '%s%s%s %s %s%s%s\n' \
        "$border_color" \
        "$vertical" \
        "$border_reset" \
        "$rendered_line" \
        "$border_color" \
        "$vertical" \
        "$border_reset"
    done; then
    log_error "unable to render box content"
    return 1
  fi

  printf -v padding '%*s' "$((content_width + 2))" ''
  printf '%s%s%s%s%s\n' \
    "$border_color" \
    "$bottom_left" \
    "${padding// /$horizontal}" \
    "$bottom_right" \
    "$border_reset"
)

# Mark initialization complete
readonly _BOX_LOADED=1
