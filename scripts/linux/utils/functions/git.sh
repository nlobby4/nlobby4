#!/usr/bin/env bash

# --------------------------------------------------
# Git checks and operations for repository scripts.
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
[[ -n "${_GIT_LOADED:-}" ]] && return

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
_GIT_UTILS_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || return 1
. "$_GIT_UTILS_DIR/core.sh" || return 1
readonly _GIT_UTILS_DIR

# --------------------------
# Repository checks
# --------------------------

# Check if the current directory is inside a git repository
check_git_repo() {
  check_command git || return 1

  git rev-parse --git-dir > /dev/null 2>&1 || {
    log_error "not inside a git repository"
    return 1
  }
}

# Check if the git lfs subcommand is available
check_git_lfs() {
  check_command git || return 1

  git lfs version > /dev/null 2>&1 || {
    log_error "git lfs is required but is not available"
    return 1
  }
}

# Check repository-local LFS filters and their effective values
check_git_lfs_configured() {
  local index key repository_value effective_value
  local filters=(clean smudge process required)
  local expected_values=(
    'git-lfs clean -- %f'
    'git-lfs smudge -- %f'
    'git-lfs filter-process'
    true
  )
  local options=()

  check_git_repo || return 1
  check_git_lfs || return 1

  for index in "${!filters[@]}"; do
    key="filter.lfs.${filters[index]}"
    options=()
    [[ "${filters[index]}" != required ]] || options=(--bool)

    repository_value="$(git config --local "${options[@]}" --get "$key" 2> /dev/null)" \
      || repository_value=""
    effective_value="$(git config "${options[@]}" --get "$key" 2> /dev/null)" \
      || effective_value=""

    if [[ "$repository_value" != "${expected_values[index]}" ||
      "$effective_value" != "${expected_values[index]}" ]]; then
      log_error "git lfs is not configured for this repository: $key is missing, incorrect, or overridden"
      return 1
    fi
  done
}

# Check if the script is run from the repository root
check_repository_root() {
  check_command git || return 1

  local repository_root current_dir

  repository_root="$(git rev-parse --show-toplevel 2> /dev/null && printf '.')" || {
    log_error "not inside a git worktree"
    return 1
  }
  repository_root="${repository_root%$'\n'.}"

  if [[ "." -ef "$repository_root" ]]; then
    return
  fi

  current_dir="$(pwd -P)" || current_dir="${PWD:-unknown}"
  log_error "run this script from repository root: expected $repository_root, got $current_dir"
  return 1
}

# --------------------------
# Upstream operations
# --------------------------

# Run bounded non-interactive network git operations
_git_noninteractive() {
  local timeout_command
  timeout_command="$(find_timeout)" || return 2

  GIT_TERMINAL_PROMPT=0 \
    GIT_ASKPASS=/bin/false \
    GCM_INTERACTIVE=Never \
    SSH_ASKPASS=/bin/false \
    SSH_ASKPASS_REQUIRE=force \
    "$timeout_command" --signal=KILL 15s \
    git -c credential.interactive=false "$@"
}

# Run local object inspection without implicitly downloading missing objects
_git_local() {
  if git --no-lazy-fetch rev-parse --git-dir > /dev/null 2>&1; then
    GIT_NO_LAZY_FETCH=1 git --no-lazy-fetch "$@"
  elif git config --get extensions.partialClone > /dev/null 2>&1 \
    || git config --get-regexp '^remote\..*\.promisor$' > /dev/null 2>&1; then
    log_error "local inspection of partial clones requires Git with --no-lazy-fetch support"
    return 2
  else
    GIT_NO_LAZY_FETCH=1 git "$@"
  fi
}

# Print the configured upstream remote of the current branch
git_upstream_remote() {
  local branch remote

  check_git_repo || return 2
  branch="$(git symbolic-ref --quiet --short HEAD 2> /dev/null)" || return 1
  remote="$(git config --get "branch.$branch.remote" 2> /dev/null)" || return 1
  [[ -n "$remote" ]] || return 1
  printf '%s\n' "$remote"
}

# Resolve the upstream branch in the canonical namespace used by refresh
git_upstream_ref() {
  local remote branch merge_ref upstream_ref

  remote="$(git_upstream_remote)" || return "$?"
  branch="$(git symbolic-ref --quiet --short HEAD 2> /dev/null)" || return 1
  merge_ref="$(git config --get-all "branch.$branch.merge" 2> /dev/null)" || return 1
  if [[ "$merge_ref" != refs/heads/* || "$merge_ref" == *$'\n'* ]]; then
    log_error "git upstream must identify one branch"
    return 2
  fi
  if [[ "$remote" == . ]]; then
    upstream_ref="$merge_ref"
  else
    git remote get-url -- "$remote" > /dev/null 2>&1 || return 1
    upstream_ref="refs/remotes/$remote/${merge_ref#refs/heads/}"
  fi
  git check-ref-format "$upstream_ref" > /dev/null 2>&1 || return 2
  printf '%s\n' "$upstream_ref"
}

# Refresh only remote-tracking branches using the specified or upstream remote
git_refresh_upstream() {
  local remote="${1:-}"
  local configured_remote remote_names

  check_git_repo || return 2

  if [[ -z "$remote" ]]; then
    remote="$(git_upstream_remote)" || return "$?"
  fi

  if [[ "$remote" == "." ]]; then
    return 0
  fi

  if ! git remote get-url -- "$remote" > /dev/null 2>&1; then
    return 1
  fi

  git check-ref-format "refs/remotes/$remote/probe" > /dev/null 2>&1 || {
    log_error "invalid git remote namespace: $remote"
    return 2
  }

  remote_names="$(git remote)" || return 2
  while IFS= read -r configured_remote; do
    [[ "$configured_remote" != "$remote" ]] || continue
    if [[ "$configured_remote" == "$remote/"* || "$remote" == "$configured_remote/"* ]]; then
      log_error "overlapping git remote namespaces: $remote and $configured_remote"
      return 2
    fi
  done <<< "$remote_names"

  _git_noninteractive fetch --quiet --atomic --prune \
    --no-tags --no-prune-tags --no-recurse-submodules --no-auto-maintenance \
    --no-write-fetch-head --refmap= -- "$remote" \
    "+refs/heads/*:refs/remotes/$remote/*" > /dev/null 2>&1 || {
    log_error "unable to fetch git remote: $remote"
    return 2
  }
}

# Print the default branch advertised by a remote
git_remote_default_branch() {
  local remote="${1:-}"
  local references reference target

  check_argument "$remote" "git remote" || return 2
  check_git_repo || return 2
  find_timeout > /dev/null || return 2

  if ! git remote get-url -- "$remote" > /dev/null 2>&1; then
    return 1
  fi

  references="$(_git_noninteractive ls-remote --symref -- "$remote" HEAD 2> /dev/null)" \
    || return 1

  while IFS=$'\t' read -r reference target; do
    if [[ "$target" == "HEAD" && "$reference" == "ref: refs/heads/"* ]]; then
      printf '%s\n' "${reference#ref: refs/heads/}"
      return 0
    fi
  done <<< "$references"

  return 1
}

# Check paths against a unique merge base using resolved immutable commits
git_upstream_paths_changed() {
  local upstream_ref="${1:-}"
  local upstream_commit head_commit merge_base diff_status

  check_argument "$upstream_ref" "git upstream ref" || return 2
  shift

  if [[ "$#" -eq 0 ]]; then
    log_error "missing required argument: git pathspec"
    return 2
  fi

  check_git_repo || return 2

  upstream_commit="$(_git_local rev-parse --verify --quiet --end-of-options "$upstream_ref^{commit}" 2> /dev/null)" || {
    log_error "unable to resolve git upstream: $upstream_ref"
    return 2
  }

  head_commit="$(_git_local rev-parse --verify --quiet 'HEAD^{commit}' 2> /dev/null)" || {
    log_error "unable to resolve git HEAD"
    return 2
  }

  merge_base="$(_git_local merge-base --all "$head_commit" "$upstream_commit" 2> /dev/null)" || {
    log_error "unable to determine merge base with git upstream: $upstream_ref"
    return 2
  }

  if [[ "$merge_base" == *$'\n'* ]]; then
    log_error "multiple merge bases with git upstream: $upstream_ref"
    return 2
  fi

  if _git_local diff --quiet --no-ext-diff --no-textconv --ignore-submodules=none \
    --no-relative "$merge_base" "$upstream_commit" -- "$@" 2> /dev/null; then
    return 1
  else
    diff_status="$?"
  fi

  case "$diff_status" in
    1)
      return 0
      ;;
    *)
      log_error "unable to compare git upstream paths"
      return 2
      ;;
  esac
}

# Mark initialization complete
readonly _GIT_LOADED=1
