#!/usr/bin/env bash

# Recover interrupted bootstrap updates before evaluating the workspace mise config.
set -euo pipefail

[[ -e .devcontainer/.mise-bootstrap-update || -L .devcontainer/.mise-bootstrap-update ]] || exit 0
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

# Resolve Node from the image's config, not a possibly half-updated workspace.
node_binary="$(MISE_AUTO_INSTALL=false MISE_NOT_FOUND_AUTO_INSTALL=false \
  MISE_TRUSTED_CONFIG_PATHS=/usr/local/share/mise \
  /usr/local/bin/mise --cd /usr/local/share/mise which node)"
[[ -f "$node_binary" && -x "$node_binary" ]] || {
  printf 'Bootstrap recovery requires the image-provided Node runtime\n' >&2
  exit 1
}
exec "$node_binary" "$SCRIPT_DIR/../../../node/bin/recover-bootstrap.js"
