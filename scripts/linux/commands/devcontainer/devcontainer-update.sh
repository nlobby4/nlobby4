#!/usr/bin/env bash

# --------------------------------------------------
# Dev Container dependency update script.
#
# Refreshes locks for explicitly declared versions, never silently bumps pins.
# Default: Feature lock. --locks: Feature, both Linux mise platforms and pnpm.
# --check: validate coupled inputs without updating them.
# --mise VERSION: update the bootstrap, both Linux hashes and CI version together.
# --refresh: synchronize a bot-edited bootstrap, resolve a recent Debian snapshot,
# regenerate all locks, then verify drift. Run in a trusted disposable workspace.
# Review the diff and rebuild after updating. Snapshot/base digests are separate.
#
# Usage:
# mise run devcontainer:update
# pnpm run devcontainer:update
# bash scripts/linux/commands/devcontainer/devcontainer-update.sh --mise VERSION
# --------------------------------------------------

# Exit immediately if a command exits with a non-zero status
# Treat unset variables as an error and exit immediately
# Prevent errors in a pipeline from being masked
set -euo pipefail

# --------------------------
# Setup
# --------------------------

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command node
check_command python3
check_file .devcontainer/devcontainer.json
check_file scripts/node/bin/validate-devcontainer-inputs.js

# --------------------------
# Update and validate
# --------------------------

mode="${1:---features}"
if [[ "$mode" == --mise && "$#" -ne 2 ]] || [[ "$mode" != --mise && "$#" -gt 1 ]]; then
  log_error "Usage: devcontainer-update.sh [--features|--locks|--check|--refresh|--mise VERSION]"
  exit 2
fi
case "$mode" in
  --refresh)
    for command in git curl sha256sum python3 docker pnpm minisign; do check_command "$command"; done
    # Use the already available runtime to align coupled bootstrap files before
    # mise parses a candidate whose minimum version may have changed.
    pnpm install --frozen-lockfile --ignore-scripts --ignore-pnpmfile
    python3 scripts/python/sync-toolchain.py
    selected_version="$(awk -F= '$1 == "MISE_VERSION" { print $2 }' .devcontainer/versions.env)"
    node scripts/node/bin/update-mise-bootstrap.js "$selected_version"
    update_directory="$(mktemp -d)"
    trap 'rm -rf -- "$update_directory"' EXIT
    case "$(uname -m)" in
      x86_64) mise_arch=x64 ;;
      aarch64 | arm64) mise_arch=arm64 ;;
      *)
        log_error "Refresh requires a Linux amd64/arm64 maintenance environment"
        exit 1
        ;;
    esac
    host_system="$(uname -s)"
    [[ "$host_system" == Linux ]] || {
      log_error "Run refresh in the Linux devcontainer"
      exit 1
    }
    asset="mise-v${selected_version}-linux-${mise_arch}"
    curl --fail --location --show-error --silent --retry 3 --connect-timeout 15 --max-time 120 \
      "https://github.com/jdx/mise/releases/download/v${selected_version}/${asset}" -o "$update_directory/mise"
    expected_hash="$(awk -v asset="$asset" '$2 == asset { print $1 }' .devcontainer/checksums.sha256)"
    [[ "$expected_hash" =~ ^[a-f0-9]{64}$ ]] || {
      log_error "Missing verified bootstrap hash"
      exit 1
    }
    printf '%s  %s\n' "$expected_hash" "$update_directory/mise" | sha256sum --check --strict -
    chmod 0755 "$update_directory/mise"
    export PATH="$update_directory:$PATH" UV_PYTHON_DOWNLOADS=never
    set_mise_auto_install false
    mise trust mise.toml
    # Native Python graph generation needs the candidate uv, not an older runner copy.
    mise lock uv --platform linux-x64,linux-arm64
    mise install --locked uv
    # Refresh native npm/Python transitives too; exact top-level pins stay fixed.
    mise lock --bump --platform linux-x64,linux-arm64
    mise install --locked node npm:pnpm npm:@devcontainers/cli
    mise exec -- devcontainer upgrade --workspace-folder .
    mise exec -- pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile
    node scripts/node/bin/update-debian-snapshot.js --recent
    ;;
  --mise)
    check_command git
    check_file scripts/node/bin/update-mise-bootstrap.js
    node scripts/node/bin/update-mise-bootstrap.js "$2"
    log_info "Review the bootstrap diff and run test:devcontainer before rebuilding."
    exit 0
    ;;
  --features | --locks)
    check_command devcontainer
    log_info "Refreshing the Feature lock for declared versions..."
    devcontainer upgrade --workspace-folder .
    if [[ "$mode" == --locks ]]; then
      check_command mise
      check_command pnpm
      mise lock --platform linux-x64,linux-arm64
      pnpm install --lockfile-only --ignore-scripts --ignore-pnpmfile
    fi
    ;;
  --check) ;;
  *)
    log_error "Usage: devcontainer-update.sh [--features|--locks|--check|--refresh|--mise VERSION]"
    exit 2
    ;;
esac

check_file .devcontainer/devcontainer-lock.json
node scripts/node/bin/validate-devcontainer-inputs.js
python3 scripts/python/devcontainer-state.py validate-tool-locks
# JSON reports version-entry drift, not all checksum/URL changes. The static
# validator separately verifies native graph digests and coupled bootstrap pins.
# Check both supported architectures without rewriting the committed locks.
check_command mise
check_command jq
lock_drift="$(MISE_SAFE=1 run_command \
  mise lock --dry-run --json --platform linux-x64,linux-arm64)"
if ! jq --exit-status 'type == "array" and length == 0' <<< "$lock_drift" > /dev/null; then
  log_error "mise.lock version entries drifted; run devcontainer-update.sh --locks and review the generated locks"
  printf '%s\n' "$lock_drift" >&2
  exit 1
fi
log_ok "Dev Container inputs validated"
if [[ "$mode" != --check ]]; then
  log_info "Review devcontainer-lock.json, mise.lock, .mise/locks and pnpm-lock.yaml; run test:devcontainer before rebuilding your workspace."
fi
