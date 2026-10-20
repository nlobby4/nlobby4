#!/usr/bin/env bash

# --------------------------------------------------
# Git readiness validation script.
#
# Verifies required Git setup and reports advisory repository freshness.
# Enabled signing must sign and verify a temporary commit without prompts.
# Signing probes do not change repository objects, refs or the index.
# Refreshes remote-tracking refs unless a shared refresh result is supplied.
#
# Prints status rows to stdout and diagnostics to stderr.
# Returns nonzero on failed required checks. Freshness remains advisory.
#
# Usage:
# bash scripts/linux/commands/repository/validation/git-status.sh
# --------------------------------------------------

# Exit on command errors and unset variables, and propagate pipeline failures
set -euo pipefail

# --------------------------
# Setup
# --------------------------

# Load dependent scripts
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)" \
  || exit 1
. "$SCRIPT_DIR/../../../utils/logging/label.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/functions/validation.sh" || exit 1
. "$SCRIPT_DIR/../../../utils/logging/status.sh" || exit 1

# Readiness checks must not implicitly install tools via mise shims
set_mise_auto_install false
readonly SCRIPT_DIR

# --------------------------
# Helpers
# --------------------------

# Hide the identifying portion of an email address
_mask_email() {
  local email="${1:-}"
  local local_part domain

  if [[ -z "$email" ]]; then
    printf '%s' "unset"
    return
  fi

  if [[ ! "$email" =~ ^([^@]+)@([^@]+)$ ]]; then
    printf '%s' "invalid"
    return
  fi

  local_part="${BASH_REMATCH[1]}"
  domain="${BASH_REMATCH[2]}"

  if [[ "$domain" == "users.noreply.github.com" ]]; then
    printf '%s' "***@$domain"
  elif [[ "${#local_part}" -le 1 ]]; then
    printf '%s' "*@$domain"
  else
    printf '%s' "${local_part:0:1}***@$domain"
  fi
}

# Hide remote credentials and query parameters before displaying a URL
_mask_remote_url() {
  local remote_url="${1:-}"
  local display_url="$remote_url"

  if [[ "$display_url" == *$'\n'* || "$display_url" == *$'\r'* ]]; then
    printf '%s' 'invalid remote URL'
    return
  fi

  if [[ "$display_url" == *"://"* ]]; then
    display_url="${display_url%%\#*}"
    display_url="${display_url%%\?*}"
  fi

  if [[ "$display_url" =~ ^([^:]+://)([^/@]+@)(.+)$ ]]; then
    printf '%s' "${BASH_REMATCH[1]}***@${BASH_REMATCH[3]}"
  elif [[ "$display_url" =~ ^[^/@]+@([^/]+:.+)$ ]]; then
    printf '%s' "***@${BASH_REMATCH[1]}"
  else
    printf '%s' "$display_url"
  fi
}

# Report advisory divergence without downloading missing local objects
_add_branch_status() {
  local local_ref="$1"
  local remote_ref="$2"
  local label="$3"
  local counts counts_status ahead_count behind_count
  local ahead_label behind_label

  set +e
  counts="$(
    _git_local rev-list --left-right --count "$local_ref...$remote_ref" 2> /dev/null
  )"
  counts_status="$?"
  set -e
  if [[ "$counts_status" -ne 0 ]]; then
    status_add "Git branch $label" "unable to compare with $remote_ref"
    return
  fi

  remote_ref="${remote_ref#refs/remotes/}"
  remote_ref="${remote_ref#refs/heads/}"
  read -r ahead_count behind_count <<< "$counts"

  if [[ ! "$ahead_count" =~ ^[0-9]+$ || ! "$behind_count" =~ ^[0-9]+$ ]]; then
    status_add "Git branch $label" "received an invalid comparison with $remote_ref"
    return
  fi

  if [[ "$ahead_count" -eq 0 && "$behind_count" -eq 0 ]]; then
    status_add "Git branch $label" "up to date with $remote_ref"
  elif [[ "$ahead_count" -eq 0 ]]; then
    behind_label="$(plural_label "$behind_count" "commit" "commits")"
    status_add \
      "Git branch $label" \
      "$behind_count $behind_label behind $remote_ref"
  elif [[ "$behind_count" -eq 0 ]]; then
    ahead_label="$(plural_label "$ahead_count" "commit" "commits")"
    status_add \
      "Git branch $label" \
      "$ahead_count $ahead_label ahead of $remote_ref"
  else
    ahead_label="$(plural_label "$ahead_count" "commit" "commits")"
    behind_label="$(plural_label "$behind_count" "commit" "commits")"
    status_add \
      "Git branch $label" \
      "$ahead_count $ahead_label ahead of and $behind_count $behind_label behind $remote_ref (diverged)"
  fi
}

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command git
check_command python3
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN

current_branch="$(git branch --show-current)"
set +e
upstream_ref="$(git_upstream_ref 2> /dev/null)"
set -e
status_reset
overall_status=0

# --------------------------
# Git identity
# --------------------------

git_name="$(git config --get user.name || true)"
git_email="$(git config --get user.email || true)"

if [[ -n "$git_name" && "$git_name" != *$'\n'* && "$git_name" != *$'\r'* ]]; then
  status_add "Git user.name" "$git_name"
else
  status_add "Git user.name" "unset or invalid" "${COLOR_RED:-}"
  overall_status=1
fi

if [[ -n "$git_email" ]]; then
  if [[ ! "$git_email" =~ ^[^[:space:]@]+@[^[:space:]@]+$ ]]; then
    status_add "Git user.email" "invalid value" "${COLOR_RED:-}"
    overall_status=1
  elif [[ "$git_email" =~ ^[A-Za-z0-9._%+-]+@users\.noreply\.github\.com$ ]]; then
    masked_email="$(_mask_email "$git_email")"
    status_add \
      "Git user.email" \
      "$masked_email (GitHub private noreply address)"
  else
    masked_email="$(_mask_email "$git_email")"
    status_add \
      "Git user.email" \
      "$masked_email (public email address)"
  fi
else
  status_add "Git user.email" "unset (privacy unavailable)" "${COLOR_RED:-}"
  overall_status=1
fi

if git var GIT_AUTHOR_IDENT > /dev/null 2>&1 && git var GIT_COMMITTER_IDENT > /dev/null 2>&1; then
  status_add "Git commit identity" "usable"
else
  status_add "Git commit identity" "unavailable or invalid" "$COLOR_RED"
  overall_status=1
fi

set +e
check_git_lfs > /dev/null 2>&1
lfs_status="$?"
set -e
if [[ "$lfs_status" -eq 0 ]]; then
  status_add "Git LFS" "available"
  set +e
  check_git_lfs_configured > /dev/null 2>&1
  lfs_filters_status="$?"
  set -e
  if [[ "$lfs_filters_status" -eq 0 ]]; then
    status_add "Git LFS filters" "configured"
  else
    status_add "Git LFS filters" "missing, incorrect or overridden" "$COLOR_RED"
    overall_status=1
  fi
else
  status_add "Git LFS" "unavailable" "$COLOR_RED"
  overall_status=1
fi

if [[ "$(git config --bool --get commit.gpgsign || true)" == "true" ]]; then
  set +e
  run_command "$TIMEOUT_BIN" --signal=TERM --kill-after=1s 15s \
    python3 "$SCRIPT_DIR/../../../../python/git-signing-check.py" < /dev/null > /dev/null
  signing_status="$?"
  set -e
  if [[ "$signing_status" -eq 0 ]]; then
    status_add "Git commit signing" "temporary commit signed and verified"
  else
    status_add "Git commit signing" "unable to sign and verify noninteractively (key, agent or policy)" "$COLOR_RED"
    overall_status=1
  fi
else
  status_add "Git commit signing" "disabled"
fi

blame_ignore_file="$(git config --local --get blame.ignoreRevsFile || true)"
effective_blame_ignore_file="$(git config --get blame.ignoreRevsFile || true)"
if [[ "$blame_ignore_file" == ".git-blame-ignore-revs" ]] \
  && [[ "$effective_blame_ignore_file" == "$blame_ignore_file" ]] \
  && [[ -f "$blame_ignore_file" && -r "$blame_ignore_file" ]]; then
  status_add "Git blame ignore file" "$blame_ignore_file"
else
  blame_ignore_status="not configured or incorrect (expected .git-blame-ignore-revs)"
  if [[ "$blame_ignore_file" == ".git-blame-ignore-revs" ]]; then
    blame_ignore_status="$blame_ignore_file (missing, unreadable or overridden)"
  fi
  status_add \
    "Git blame ignore file" \
    "$blame_ignore_status" \
    "${COLOR_RED:-}"
  overall_status=1
fi

commit_template="$(git config --local --get commit.template || true)"
effective_commit_template="$(git config --get commit.template || true)"
if [[ "$commit_template" == ".gitmessage" ]] \
  && [[ "$effective_commit_template" == "$commit_template" ]] \
  && [[ -f "$commit_template" && -r "$commit_template" ]]; then
  status_add "Git commit template" "$commit_template"
else
  commit_template_status="not configured or incorrect (expected .gitmessage)"
  if [[ "$commit_template" == ".gitmessage" ]]; then
    commit_template_status="$commit_template (missing, unreadable or overridden)"
  fi
  status_add \
    "Git commit template" \
    "$commit_template_status" \
    "${COLOR_RED:-}"
  overall_status=1
fi

# Let attributes control conversion rather than inherited host auto-CRLF policy
autocrlf="$(git config --local --bool-or-str --get-all core.autocrlf || true)"
effective_autocrlf="$(git config --bool-or-str --get core.autocrlf || true)"
if [[ "$autocrlf" == false && "$effective_autocrlf" == false \
  && -f .gitattributes && -r .gitattributes ]]; then
  status_add "Git line endings" "controlled by .gitattributes (core.autocrlf=false)"
else
  status_add "Git line endings" "not configured or overridden (expected core.autocrlf=false and readable .gitattributes)" "$COLOR_RED"
  overall_status=1
fi

# Reuse recorded resolutions without automatically staging them
rerere_enabled="$(git config --local --bool --get-all rerere.enabled || true)"
effective_rerere_enabled="$(git config --bool --get rerere.enabled || true)"
rerere_autoupdate="$(git config --local --bool --get-all rerere.autoupdate || true)"
effective_rerere_autoupdate="$(git config --bool --get rerere.autoupdate || true)"
if [[ "$rerere_enabled" == true && "$effective_rerere_enabled" == true \
  && "$rerere_autoupdate" == false && "$effective_rerere_autoupdate" == false ]]; then
  status_add "Git conflict resolution" "reuse enabled, manual staging"
else
  status_add "Git conflict resolution" "not configured or overridden (expected rerere.enabled=true, rerere.autoupdate=false)" "$COLOR_RED"
  overall_status=1
fi

hooks_path="$(git config --local --get core.hooksPath || true)"
effective_hooks_path="$(git config --get core.hooksPath || true)"
husky_hooks=()
husky_broken_hooks=()

if [[ -d .husky ]]; then
  shopt -s nullglob
  for hook_path in .husky/*; do
    [[ -f "$hook_path" ]] || continue
    # Husky may also contain documentation and configuration, not just Git hooks
    case "${hook_path##*/}" in
      applypatch-msg | pre-applypatch | post-applypatch | pre-commit | pre-merge-commit | prepare-commit-msg | commit-msg | post-commit | pre-rebase | post-checkout | post-merge | pre-push | pre-auto-gc | post-rewrite | sendemail-validate | fsmonitor-watchman | reference-transaction | proc-receive | post-index-change | pre-receive | update | post-receive | post-update | push-to-checkout)
        ;;
      *) continue ;;
    esac
    husky_hooks+=("$hook_path")
  done
  shopt -u nullglob
fi

if [[ "$hooks_path" != ".husky/_" ]]; then
  status_add \
    "Git hooks" \
    "not configured or incorrect (expected .husky/_)" \
    "${COLOR_RED:-}"
  overall_status=1
elif [[ "$effective_hooks_path" != "$hooks_path" ]]; then
  status_add "Git hooks" "repository hook path is overridden" "$COLOR_RED"
  overall_status=1
elif [[ ! -d .husky/_ ]]; then
  status_add "Git hooks" ".husky/_ is missing" "${COLOR_RED:-}"
  overall_status=1
elif [[ ! -f .husky/_/h || ! -r .husky/_/h || ! -s .husky/_/h || "${HUSKY:-}" == 0 ]]; then
  status_add "Git hooks" "Husky runner missing, empty, unreadable, or disabled" "${COLOR_RED:-}"
  overall_status=1
elif [[ "${#husky_hooks[@]}" -eq 0 ]]; then
  status_add "Git hooks" "no repository hooks found" "${COLOR_RED:-}"
  overall_status=1
else
  for hook_path in "${husky_hooks[@]}"; do
    hook_name="${hook_path##*/}"
    if [[ ! -r "$hook_path" || ! -x "$hook_path" ||
      ! -f ".husky/_/$hook_name" || ! -r ".husky/_/$hook_name" || ! -x ".husky/_/$hook_name" ]]; then
      husky_broken_hooks+=("$hook_name")
    fi
  done

  if [[ "${#husky_broken_hooks[@]}" -eq 0 ]]; then
    hook_label="$(plural_label "${#husky_hooks[@]}" "hook" "hooks")"
    status_add \
      "Git hooks" \
      "${#husky_hooks[@]} repository $hook_label active via .husky/_"
  else
    status_add \
      "Git hooks" \
      "inactive or non-executable: ${husky_broken_hooks[*]}" \
      "${COLOR_RED:-}"
    overall_status=1
  fi
fi

# --------------------------
# Git repository
# --------------------------

if [[ -z "$current_branch" ]]; then
  detached_commit="$(git rev-parse --short HEAD 2> /dev/null || true)"
  status_add "Git checkout" "detached at ${detached_commit:-unknown commit}"
fi

if git remote get-url origin > /dev/null 2>&1; then
  origin_url="$(git remote get-url origin)"
  masked_origin_url="$(_mask_remote_url "$origin_url")"
  status_add "Git origin remote" "$masked_origin_url"
else
  status_add "Git origin remote" "not configured"
fi

# --------------------------
# Remote freshness
# --------------------------

reported_branch_ref=""
reported_upstream_ref=""

if git remote get-url origin > /dev/null 2>&1; then
  if [[ "${_REPOSITORY_GIT_REFRESH_STATUS:-}" =~ ^[012]$ ]]; then
    refresh_status="$_REPOSITORY_GIT_REFRESH_STATUS"
  else
    set +e
    git_refresh_upstream origin 2> /dev/null
    refresh_status="$?"
    set -e
  fi

  if [[ "$refresh_status" -eq 0 ]]; then
    set +e
    default_branch_ref="$(git_remote_default_branch origin)"
    set -e

    if [[ -z "$default_branch_ref" ]]; then
      status_add \
        "Git remote freshness" \
        "unable to determine the default branch advertised by origin"
    else
      default_remote_ref="origin/$default_branch_ref"
    fi

    if [[ -n "$default_branch_ref" ]] \
      && git show-ref --verify --quiet "refs/remotes/$default_remote_ref" \
      && git show-ref --verify --quiet "refs/heads/$default_branch_ref"; then
      _add_branch_status "refs/heads/$default_branch_ref" "refs/remotes/$default_remote_ref" "$default_branch_ref"
      reported_branch_ref="$default_branch_ref"
      reported_upstream_ref="refs/remotes/$default_remote_ref"
    elif [[ -n "$default_branch_ref" ]]; then
      status_add \
        "Git remote freshness" \
        "unable to compare local default branch with $default_remote_ref"
    fi
  else
    status_add \
      "Git remote freshness" \
      "unable to connect to origin"
  fi
else
  status_add "Git remote freshness" "no origin remote configured"
fi

if [[ -n "$current_branch" ]]; then
  if [[ -n "$upstream_ref" && "$current_branch" == "$reported_branch_ref" && "$upstream_ref" == "$reported_upstream_ref" ]]; then
    :
  elif [[ -n "$upstream_ref" ]]; then
    set +e
    upstream_remote="$(git_upstream_remote 2> /dev/null)"
    set -e
    upstream_refresh_status=1
    if [[ -n "$upstream_remote" && "$upstream_remote" == "${_REPOSITORY_GIT_UPSTREAM_REMOTE:-}" &&
      "${_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS:-}" =~ ^[012]$ ]]; then
      upstream_refresh_status="$_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS"
    elif [[ "$upstream_remote" == origin ]]; then
      upstream_refresh_status="${refresh_status:-1}"
    elif [[ -n "$upstream_remote" ]]; then
      set +e
      git_refresh_upstream "$upstream_remote" 2> /dev/null
      upstream_refresh_status="$?"
      set -e
    fi

    if [[ "$upstream_refresh_status" -eq 0 ]]; then
      _add_branch_status "HEAD" "$upstream_ref" "$current_branch"
    else
      status_add "Git branch $current_branch" "unable to verify freshness of $upstream_ref"
    fi
  else
    status_add "Git branch $current_branch" "no upstream branch"
  fi
fi

status_print
exit "$overall_status"
