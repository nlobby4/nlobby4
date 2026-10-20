#!/usr/bin/env bash

# --------------------------------------------------
# Accumulated status rows with aligned labels and optional value colors.
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
[[ -n "${_STATUS_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_STATUS_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_STATUS_UTILS_DIR/terminal.sh" || return 1
. "$_STATUS_UTILS_DIR/../filters/filters.sh" || return 1
readonly _STATUS_UTILS_DIR

# --------------------------
# Status
# --------------------------

# Store corresponding status labels, values and optional colors
_status_labels=()
_status_values=()
_status_colors=()

# Clear all accumulated status entries
status_reset() {
  _status_labels=()
  _status_values=()
  _status_colors=()
}

# Add a status label and value
status_add() {
  local label="${1:-}"
  local value="${2:-}"
  local color="${3:-}"

  check_single_line_argument "$label" "status label" || return 1
  check_single_line_argument "$value" "status value" || return 1

  label="${label//$'\t'/  }"
  value="${value//$'\t'/  }"

  if [[ -n "$color" ]]; then
    check_single_line_argument "$color" "status color" || return 1
  fi

  _status_labels+=("$label")
  _status_values+=("$value")
  _status_colors+=("$color")
}

# Import JSON status rows returning 0 for healthy, 1 for unhealthy or 2 for invalid
status_import_json() {
  local rows label value healthy color result=0

  check_argument "${1:-}" 'JSON status rows' || return 2
  rows="$(run_filter jq json-table - --raw-output \
    --argjson columns '[{"field":"label","type":"string","nonempty":true},{"field":"value","type":"string","nonempty":true},{"field":"ok","type":"boolean"}]' \
    <<< "$1")" || return 2

  while IFS=$'\t' read -r label value healthy; do
    # jq escapes tabs and backslashes in TSV; decode only its validated output
    label="$(printf '%b' "$label")"
    value="$(printf '%b' "$value")"
    color=''
    if [[ "$healthy" == false ]]; then
      color="$COLOR_RED"
      result=1
    fi
    status_add "$label" "$value" "$color" || return 2
  done <<< "$rows"

  return "$result"
}

# Print accumulated status entries with aligned labels
status_print() {
  local max_label_width=0
  local label label_width padding width_output value color
  local color_enabled=""
  local widths=()
  local index

  if [[ "${#_status_labels[@]}" -eq 0 ]]; then
    return
  fi

  if width_output="$(visible_width "${_status_labels[@]}" 2> /dev/null)"; then
    mapfile -t widths <<< "$width_output"
    for label_width in "${widths[@]}"; do
      if [[ "$label_width" -gt "$max_label_width" ]]; then
        max_label_width="$label_width"
      fi
    done
  fi

  if supports_color 1; then
    color_enabled=1
  fi

  for index in "${!_status_labels[@]}"; do
    label="${_status_labels[index]}"
    label_width="${widths[index]:-0}"
    padding="$((max_label_width - label_width))"
    value="${_status_values[index]}"
    color="${_status_colors[index]}"
    if [[ -n "$color_enabled" && -n "$color" ]]; then
      value="${color}${value}${COLOR_RESET:-}"
    fi
    printf '%s%*s: %s\n' \
      "$label" \
      "$padding" \
      '' \
      "$value"
  done
}

# Mark initialization complete
readonly _STATUS_LOADED=1
