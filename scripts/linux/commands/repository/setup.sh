#!/usr/bin/env bash

# --------------------------------------------------
# Environment setup script for the repository.
#
# This script configures git and necessary tools,
# making the environment match the repository's expected setup.
#
# The recommended entry point is the mise task, which installs locked
# dependencies before running this script:
#
# mise run setup
#
# To bypass mise task orchestration, install the tools from mise.toml and the
# pnpm dependencies first, then run this script directly:
#
# mise trust
# mise install --locked
# mise exec -- pnpm install --frozen-lockfile --ignore-scripts
# mise exec -- bash scripts/linux/commands/repository/setup.sh
#
# System prerequisites and host Docker are not provisioned by this script.
# See README.md, then run mise run health to verify readiness after setup.
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
. "$SCRIPT_DIR/../../utils/logging/logging.sh"

log_info "Setting up repository environment..."

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command git
check_file "$SCRIPT_DIR/doctor.sh"

# --------------------------
# Configuration
# --------------------------

# Repair local configuration including attributes-owned line-ending conversion
bash "$SCRIPT_DIR/doctor.sh"

# --------------------------
# Git LFS objects
# --------------------------

# Network downloads belong to explicit setup rather than local diagnosis/repair
lfs_files="$(git lfs ls-files --name-only)"
if [[ -n "$lfs_files" ]]; then
  log_info 'Downloading and checking out tracked Git LFS objects...'
  git lfs pull
  git lfs checkout
fi

# --------------------------
# Tools
# --------------------------

# Ensure the locked repository toolchain is present. Dev Container images
# preinstall it, so this is normally a fast no-op during container creation.
if [[ ! -f mise.toml ]]; then
  log_warning "No mise.toml file found"
elif ! command -v mise > /dev/null 2>&1; then
  log_warning "mise not found; tool versions must be installed manually"
else
  log_info "Installing locked tool versions via mise..."
  mise install --locked
  log_ok "Tool versions installed"
fi

# --------------------------
# Verification
# --------------------------

check_command node
check_command pnpm
check_command actionlint
check_command act
check_command cmark-gfm
check_command shellcheck
check_command trivy
check_command minisign
check_command gitleaks
check_command gum
check_command hadolint
check_command conftest

# Run verification commands separately so logging cannot hide a failed tool.
for tool in node pnpm actionlint act cmark-gfm shellcheck trivy gum hadolint conftest; do
  version_output="$("$tool" --version)"
  log_info "$tool: $version_output"
done
version_output="$(git lfs version)"
log_info "Git LFS: $version_output"
version_output="$(minisign -v)"
log_info "Minisign: $version_output"
version_output="$(gitleaks version)"
log_info "Gitleaks: $version_output"

log_ok "Environment setup complete!"
