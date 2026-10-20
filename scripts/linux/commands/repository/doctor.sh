#!/usr/bin/env bash

# --------------------------------------------------
# Repository doctor and safe local repair command.
#
# Checks managed Git settings, LFS filters, workspace caches, script permissions
# and installed Husky hooks. Repairs these when safe, or explains manual action.
# --check reports the same local issues without changing repository state.
#
# Never installs dependencies, downloads LFS objects, changes identity/signing,
# replaces custom hook paths, changes ownership or updates locks. Independent
# checks continue after failures. Success covers managed local setup only.
# Run mise run health separately to verify the complete development environment.
#
# Usage:
# bash scripts/linux/commands/repository/doctor.sh [--check]
#
# Diagnostic boundaries inspired by Doom's doctor command:
# https://github.com/doomemacs/core/blob/master/docs/getting_started.org
# --------------------------------------------------

# Propagate repair failures explicitly so independent checks can finish
set -uo pipefail
set +e

# --------------------------
# Setup
# --------------------------

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || exit 1
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../utils/functions/validation.sh" || exit 1
. "$SCRIPT_DIR/../../utils/logging/log.sh" || exit 1
readonly SCRIPT_DIR

CHECK_ONLY=false
for argument in "$@"; do
  case "$argument" in
    --check) CHECK_ONLY=true ;;
    --help | -h)
      printf '%s\n' 'Usage: doctor.sh [--check]' \
        'Default: repair safe repository-local setup; --check: report only.' \
        'Use mise run health for complete readiness validation.'
      exit 0
      ;;
    *)
      log_error "Unknown option: $argument"
      exit 2
      ;;
  esac
done
readonly CHECK_ONLY
set_mise_auto_install false

check_repository_root || exit 1
for command_name in chmod git mkdir mktemp rm; do
  check_command "$command_name" || exit 1
done
TIMEOUT_BIN="$(find_timeout)" || exit 1
DOCTOR_DEADLINE="$((SECONDS + 120))"
readonly TIMEOUT_BIN DOCTOR_DEADLINE

script_list=''
trap '[[ -z "$script_list" ]] || rm -f -- "$script_list"' EXIT
passed=0
failed=0
hook_names=(
  applypatch-msg pre-applypatch post-applypatch pre-commit pre-merge-commit
  prepare-commit-msg commit-msg post-commit pre-rebase post-checkout post-merge
  pre-push pre-auto-gc post-rewrite sendemail-validate fsmonitor-watchman
  reference-transaction proc-receive post-index-change pre-receive update
  post-receive post-update push-to-checkout
)
readonly -a hook_names

# --------------------------
# Helpers
# --------------------------

# Bound local tools and prevent interactive or implicit installation behavior
_doctor_command() {
  local remaining="$((DOCTOR_DEADLINE - SECONDS))"
  [[ "$remaining" -gt 0 ]] || {
    log_error 'Doctor command budget exhausted'
    return 124
  }
  [[ "$remaining" -le 15 ]] || remaining=15
  GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=Never \
    GIT_ASKPASS=/bin/false SSH_ASKPASS=/bin/false SSH_ASKPASS_REQUIRE=force \
    run_command "$TIMEOUT_BIN" --signal=TERM --kill-after=2s "${remaining}s" "$@" < /dev/null
}

# Run an independent check and preserve its failure for the final summary
_doctor_step() {
  local label="$1" result
  shift
  log_info "$label"
  "$@"
  result="$?"
  if [[ "$result" -eq 0 ]]; then
    passed="$((passed + 1))"
  else
    failed="$((failed + 1))"
    log_error "$label needs attention"
  fi
}

# Read a Git value while distinguishing absence from a command failure
_doctor_config() {
  local scope="$1" key="$2" result
  local options=() selector=--get
  [[ "$scope" != local ]] || options+=(--local)
  [[ "$scope" != local ]] || selector=--get-all
  case "$key" in
    filter.lfs.required | rerere.enabled | rerere.autoupdate) options+=(--bool) ;;
    core.autocrlf) options+=(--bool-or-str) ;;
    *) ;;
  esac
  _doctor_command git config "${options[@]}" "$selector" "$key"
  result="$?"
  [[ "$result" -eq 1 ]] && return 0
  return "$result"
}

# Restore one owned local setting and verify its effective value
_doctor_setting() {
  local key="$1" expected="$2" required_file="${3:-}" current effective
  if [[ -n "$required_file" ]]; then
    check_file "$required_file" || return 1
    [[ -r "$required_file" ]] || {
      log_error "Unreadable file: $required_file"
      return 1
    }
  fi
  current="$(_doctor_config local "$key")" || return 1
  effective="$(_doctor_config effective "$key")" || return 1
  if [[ "$current" == "$expected" && "$effective" == "$expected" ]]; then
    log_ok "$key already correct"
    return 0
  fi
  if [[ "$current" == "$expected" ]]; then
    log_error "$key is overridden; resolve the worktree or command-level override"
    return 1
  fi
  if [[ "$CHECK_ONLY" == true ]]; then
    log_warning "$key needs repair; run mise run doctor"
    return 1
  fi
  _doctor_command git config --local --replace-all "$key" "$expected" || return 1
  current="$(_doctor_config local "$key")" || return 1
  effective="$(_doctor_config effective "$key")" || return 1
  if [[ "$current" != "$expected" || "$effective" != "$expected" ]]; then
    log_error "$key remains incorrect or overridden; inspect Git configuration"
    return 1
  fi
  log_ok "$key repaired"
}

# Repair filters without installing or overwriting any Git hooks
_doctor_lfs() {
  local result=0 index
  local fields=(clean smudge process required)
  local values=('git-lfs clean -- %f' 'git-lfs smudge -- %f' 'git-lfs filter-process' true)
  _doctor_command git lfs version > /dev/null || {
    log_error 'Git LFS unavailable; install the system prerequisite, then rerun doctor'
    return 1
  }
  for index in "${!fields[@]}"; do
    _doctor_setting "filter.lfs.${fields[index]}" "${values[index]}" || result=1
  done
  return "$result"
}

# Refuse symlinks in any component of a repository-owned path
_doctor_no_symlinks() {
  local parent="$1" next
  while [[ -n "$parent" ]]; do
    [[ ! -L "$parent" ]] || {
      log_error "Refusing symlinked repository path: $parent"
      return 1
    }
    next="${parent%/*}"
    [[ "$next" != "$parent" ]] || break
    parent="$next"
  done
}

# Create a workspace cache without following symlinked path components
_doctor_directory() {
  local directory="$1"
  _doctor_no_symlinks "$directory" || return 1
  if [[ ! -d "$directory" ]]; then
    if [[ "$CHECK_ONLY" == true ]]; then
      log_warning "Missing cache directory: $directory; run mise run doctor"
      return 1
    fi
    mkdir -p -- "$directory" || return 1
  fi
  [[ -w "$directory" && -x "$directory" ]] || {
    log_error "Cache is not writable/searchable: $directory; repair permissions manually"
    return 1
  }
  log_ok "Cache available: $directory"
}

# Check each active workspace cache without pruning or changing ownership
_doctor_caches() {
  local directory result=0
  for directory in .cache/knip .cache/prettier .cache/commitizen .cache/python .cache/trivy; do
    _doctor_directory "$directory" || result=1
  done
  return "$result"
}

# Report store ownership problems without changing shared host or volume data
_doctor_store() {
  local store="${NPM_CONFIG_STORE_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/pnpm/store}"
  if [[ ! -d "$store" || ! -w "$store" || ! -x "$store" ]]; then
    log_error "pnpm store missing or inaccessible: $store"
    log_info 'Install locked dependencies or correct the configured store/permissions; doctor does not chown shared storage'
    return 1
  fi
  log_ok 'Configured pnpm store is accessible'
}

# Repair only owner execution permission on regular repository source files
_doctor_executable() {
  local file="$1"
  _doctor_no_symlinks "$file" || return 1
  [[ ! -L "$file" && -f "$file" && -r "$file" ]] || {
    log_error "Refusing non-regular, symlinked or unreadable script: $file"
    return 1
  }
  [[ ! -x "$file" ]] || return 0
  if [[ "$CHECK_ONLY" == true ]]; then
    log_warning "Not executable: $file; run mise run doctor"
    return 1
  fi
  chmod u+x -- "$file" || return 1
  [[ -x "$file" ]] || return 1
  log_ok "Executable permission repaired: $file"
}

# Discover managed shell sources and actual Git hooks without scanning dependencies
_doctor_executables() {
  local file hook result=0
  script_list="$(mktemp)" || return 1
  _doctor_command git ls-files --cached --others --exclude-standard --deduplicate -z \
    -- 'scripts/*.sh' ':!scripts/**/node_modules/**' > "$script_list" || return 1
  while IFS= read -r -d '' file; do
    # Deleted index entries can be intentional working-tree edits
    [[ -e "$file" || -L "$file" ]] || continue
    _doctor_executable "$file" || result=1
  done < "$script_list"
  [[ ! -L .husky ]] || {
    log_error 'Refusing symlinked .husky'
    return 1
  }
  for hook in "${hook_names[@]}"; do
    file=".husky/$hook"
    [[ -e "$file" || -L "$file" ]] || continue
    _doctor_executable "$file" || result=1
  done
  return "$result"
}

# Verify installed Husky state without trusting its install command exit alone
_doctor_husky_ready() {
  local hook count=0 local_path effective_path expected_runner actual_runner wrapper
  local expected_wrapper=$'#!/usr/bin/env sh\n. "$(dirname "$0")/h"'
  local_path="$(_doctor_config local core.hooksPath)" || return 1
  effective_path="$(_doctor_config effective core.hooksPath)" || return 1
  [[ "$local_path" == .husky/_ && "$effective_path" == .husky/_ ]] || return 1
  [[ -f .husky/_/h && -s .husky/_/h && -r .husky/_/h ]] || return 1
  [[ -x node_modules/.bin/husky && -f node_modules/husky/husky && -r node_modules/husky/husky ]] || return 1
  expected_runner="$(_doctor_command git hash-object --no-filters -- node_modules/husky/husky)" || return 1
  actual_runner="$(_doctor_command git hash-object --no-filters -- .husky/_/h)" || return 1
  [[ "$expected_runner" == "$actual_runner" ]] || return 1
  for hook in "${hook_names[@]}"; do
    [[ -f ".husky/$hook" ]] || continue
    count="$((count + 1))"
    [[ -r ".husky/$hook" && -x ".husky/$hook" &&
      -f ".husky/_/$hook" && -r ".husky/_/$hook" && -x ".husky/_/$hook" ]] || return 1
    # The pinned Husky 9 installer owns these wrappers, not the source hooks
    wrapper="$(< ".husky/_/$hook")"
    [[ "$wrapper" == "$expected_wrapper" ]] || return 1
  done
  [[ "$count" -gt 0 ]]
}

# Recreate owned Husky wrappers while preserving source hooks and custom hook paths
_doctor_husky() {
  local file hook local_path effective_path output
  [[ -d .husky && ! -L .husky && ! -L .husky/_ ]] || {
    log_error 'Missing or symlinked .husky directory; restore reviewed repository files'
    return 1
  }
  for file in .husky/_/* .husky/_/.gitignore; do
    [[ ! -L "$file" ]] || {
      log_error "Refusing symlinked Husky artifact: $file"
      return 1
    }
  done
  [[ "${HUSKY:-}" != 0 ]] || {
    log_error 'Husky is disabled by HUSKY=0; enable it explicitly'
    return 1
  }
  local_path="$(_doctor_config local core.hooksPath)" || return 1
  effective_path="$(_doctor_config effective core.hooksPath)" || return 1
  for output in "$local_path" "$effective_path"; do
    if [[ -n "$output" && "$output" != .husky/_ ]]; then
      log_error 'Custom Git hook path preserved; resolve it manually before enabling repository Husky hooks'
      return 1
    fi
  done
  if _doctor_husky_ready; then
    log_ok 'Husky hooks already correct'
    return 0
  fi
  if [[ "$CHECK_ONLY" == true ]]; then
    log_warning 'Husky needs repair; install locked dependencies, then run mise run doctor'
    return 1
  fi
  [[ -x node_modules/.bin/husky ]] || {
    log_error 'Husky unavailable; install locked dependencies first (mise run install)'
    return 1
  }
  output="$(_doctor_command node_modules/.bin/husky 2>&1)" || {
    log_error "Husky installation failed: $output"
    return 1
  }
  [[ -z "$output" ]] || log_info "$output"
  for hook in "${hook_names[@]}"; do
    [[ -f ".husky/$hook" ]] || continue
    _doctor_executable ".husky/_/$hook" || return 1
  done
  if ! _doctor_husky_ready; then
    log_error 'Husky postconditions failed; inspect installed dependencies and hook overrides'
    return 1
  fi
  log_ok 'Husky hooks repaired'
}

# --------------------------
# Diagnosis and repair
# --------------------------

log_info "Repository doctor (check-only=$CHECK_ONLY)"
_doctor_step 'Git blame configuration' _doctor_setting blame.ignoreRevsFile .git-blame-ignore-revs .git-blame-ignore-revs
_doctor_step 'Git commit template' _doctor_setting commit.template .gitmessage .gitmessage
# Let tracked attributes control LF defaults and explicit CRLF exceptions
_doctor_step 'Git line-ending policy' _doctor_setting core.autocrlf false .gitattributes
_doctor_step 'Git conflict resolution reuse' _doctor_setting rerere.enabled true
_doctor_step 'Git conflict resolution review' _doctor_setting rerere.autoupdate false
_doctor_step 'Git LFS filters' _doctor_lfs
_doctor_step 'Workspace caches' _doctor_caches
_doctor_step 'pnpm store access' _doctor_store
_doctor_step 'Repository executable permissions' _doctor_executables
_doctor_step 'Husky hooks' _doctor_husky

# --------------------------
# Summary
# --------------------------

if [[ "$failed" -gt 0 ]]; then
  log_error "Doctor completed: $passed checks passed, $failed need attention"
  log_info 'Follow the diagnostics above; dependencies, identity, signing and external services require explicit setup'
  exit 1
fi
log_ok "Doctor completed: $passed checks passed"
log_info 'Run mise run health to verify complete repository readiness'
