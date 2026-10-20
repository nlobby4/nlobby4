#!/usr/bin/env bash

# Preview or restart only this workspace's existing Dev Container.
# Persistent Docker and pnpm volumes are never removed or reset.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/../../utils/functions/validation.sh"
. "$SCRIPT_DIR/../../utils/functions/git.sh" || exit 1
check_repository_root
check_command docker
TIMEOUT_BIN="$(find_timeout)" || exit 1
readonly TIMEOUT_BIN

mode="${1:---preview}"
if [[ "$#" -gt 1 || ! "$mode" =~ ^(--preview|--restart)$ ]]; then
  log_error "Usage: devcontainer-recover.sh [--preview|--restart]"
  exit 2
fi
if [[ -f /.dockerenv || -f /run/.containerenv ]]; then
  log_error "Run container recovery on the Docker host, not inside the container"
  exit 1
fi
set_mise_auto_install false
workspace="$(pwd -P)"
configuration="$workspace/.devcontainer/devcontainer.json"
check_file "$configuration"
container_output="$("$TIMEOUT_BIN" --signal=TERM --kill-after=2s 15s docker ps --all --quiet --no-trunc \
  --filter "label=devcontainer.local_folder=$workspace" \
  --filter "label=devcontainer.config_file=$configuration")"
containers=()
while IFS= read -r container; do
  [[ -n "$container" ]] && containers+=("$container")
done <<< "$container_output"
if [[ "${#containers[@]}" -ne 1 ]]; then
  log_error "Expected exactly one existing workspace container, found ${#containers[@]}. Open it in VS Code or resolve duplicate containers first."
  exit 1
fi
container="${containers[0]}"
[[ "$container" =~ ^[a-f0-9]{64}$ ]] || {
  log_error "Docker returned an invalid container ID"
  exit 1
}
log_info "Recovery target: $container"
log_info "Restart and rerun lifecycle validation. All volumes and nested Docker data remain intact."
[[ "$mode" == --restart ]] || exit 0
check_command devcontainer
check_command jq
# Recheck identity immediately before mutation rather than trusting listing alone.
selected_workspace="$("$TIMEOUT_BIN" --signal=TERM --kill-after=2s 15s docker inspect --format '{{index .Config.Labels "devcontainer.local_folder"}}' "$container")"
selected_configuration="$("$TIMEOUT_BIN" --signal=TERM --kill-after=2s 15s docker inspect --format '{{index .Config.Labels "devcontainer.config_file"}}' "$container")"
[[ "$selected_workspace" == "$workspace" && "$selected_configuration" == "$configuration" ]] || {
  log_error "Container labels changed. Recovery refused."
  exit 1
}
mounts="$("$TIMEOUT_BIN" --signal=TERM --kill-after=2s 15s docker inspect --format '{{json .Mounts}}' "$container")"
remote_workspace="$(jq --exit-status --raw-output --arg source "$workspace" \
  'map(select(.Type == "bind" and .Source == $source)) | if length == 1 then .[0].Destination else error("workspace mount is ambiguous or missing") end' <<< "$mounts")"
remote_user="$(jq --exit-status --raw-output '.remoteUser | select(type == "string" and length > 0 and . != "root" and . != "0")' "$configuration")"
"$TIMEOUT_BIN" --signal=TERM --kill-after=2s 60s docker restart --timeout 30 "$container" > /dev/null
# Repair an interrupted bootstrap before the host CLI/mise reads that config.
"$TIMEOUT_BIN" --signal=TERM --kill-after=2s 30s docker exec --user "$remote_user" \
  --workdir "$remote_workspace" "$container" \
  bash scripts/linux/commands/devcontainer/recover-bootstrap.sh
if ! "$TIMEOUT_BIN" --signal=TERM --kill-after=2s 360s devcontainer up \
  --workspace-folder "$workspace" --config "$configuration" \
  --expect-existing-container --frozen-lockfile; then
  log_error "Recovery did not pass readiness. Data was preserved. Inspect container logs before considering any reset."
  exit 1
fi
log_ok "Existing container restarted and lifecycle validation passed"
