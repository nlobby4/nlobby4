#!/usr/bin/env bash

# --------------------------------------------------
# High-fidelity GitHub Markdown preview.
#
# Uses gh-markdown-preview, which renders GFM through GitHub's Markdown API and
# serves it locally with live reload and GitHub-derived styling.
# --------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
. "$SCRIPT_DIR/../../utils/logging/logging.sh"

check_repository_root
check_command gh

if ! gh extension list | grep -q 'yusukebe/gh-markdown-preview'; then
  log_error "gh-markdown-preview is required"
  log_info "Install it with: gh extension install yusukebe/gh-markdown-preview"
  exit 1
fi

if [[ "$#" -eq 0 ]]; then
  set -- README.md
fi

gh markdown-preview "$@"
