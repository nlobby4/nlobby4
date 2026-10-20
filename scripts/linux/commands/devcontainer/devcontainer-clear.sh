#!/usr/bin/env bash

# --------------------------------------------------
# Development container cache cleanup script.
#
# Removes only the current workspace's development container, its image and
# pnpm cache volume, and repository-local caches. Nested Docker/containerd data
# is preserved unless --include-docker-data is explicitly requested. Other
# attached volumes are never removed. Preview is the default; --apply deletes.
#
# Usage:
# mise run devcontainer:clear
# pnpm run devcontainer:clear
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
check_command docker

apply=false
include_docker_data=false
for argument in "$@"; do
  case "$argument" in
    --apply) apply=true ;;
    --include-docker-data) include_docker_data=true ;;
    --help)
      printf '%s\n' 'Usage: devcontainer-clear.sh [--apply] [--include-docker-data]'
      exit 0
      ;;
    *)
      log_error "unknown option: $argument"
      exit 2
      ;;
  esac
done

if [[ -f /.dockerenv ]] || [[ -f /run/.containerenv ]]; then
  log_error "run Dev Container cleanup directly on the Docker host"
  exit 1
fi

docker info > /dev/null

workspace="$PWD"
workspace_name="$(basename -- "$workspace")"
cache_directory="$workspace/.cache"

if [[ -L "$cache_directory" ]]; then
  log_error "refusing to clear a symlinked cache directory: $cache_directory"
  exit 1
fi

case "$cache_directory" in
  "$workspace/.cache") ;;
  *)
    log_error "refusing to clear unexpected cache path: $cache_directory"
    exit 1
    ;;
esac

# --------------------------
# Resolve workspace resources
# --------------------------

container_output="$(
  docker ps --all --quiet \
    --filter "label=devcontainer.local_folder=$workspace"
)"
mapfile -t container_ids <<< "$container_output"

declare -A volume_ids=()
declare -A image_ids=()

for container_id in "${container_ids[@]}"; do
  [[ -n "$container_id" ]] || continue

  image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
  image_ids["$image_id"]=1

  volume_output="$(
    docker inspect \
      --format '{{range .Mounts}}{{if eq .Type "volume"}}{{printf "%s\t%s\n" .Name .Destination}}{{end}}{{end}}' \
      "$container_id"
  )"
  while IFS=$'\t' read -r volume_id destination; do
    [[ -n "$volume_id" ]] || continue
    case "$destination" in
      /home/nlobby4/.local/share/pnpm/store)
        if [[ "$volume_id" == "$workspace_name-pnpm-v10-store-"* ]]; then
          volume_ids["$volume_id"]=1
        fi
        ;;
      /var/lib/docker | /var/lib/containerd)
        if [[ "$include_docker_data" == true && "$volume_id" == dind-* ]]; then
          volume_ids["$volume_id"]=1
        fi
        ;;
      *) log_info "Preserving unrelated volume: $volume_id ($destination)" ;;
    esac
  done <<< "$volume_output"
done

# --------------------------
# Remove workspace resources
# --------------------------

log_info "Cleanup selection for $workspace_name:"
for container_id in "${container_ids[@]}"; do
  [[ -n "$container_id" ]] && log_info "Container: $container_id"
done
for volume_id in "${!volume_ids[@]}"; do log_info "Volume: $volume_id"; done
for image_id in "${!image_ids[@]}"; do log_info "Image: $image_id (only if unused)"; done
log_info "Cache contents: $cache_directory"
if [[ "$apply" != true ]]; then
  log_info "Preview only. Use --apply to remove the listed resources. Deleted volumes cannot be recovered."
  exit 0
fi

for container_id in "${container_ids[@]}"; do
  [[ -n "$container_id" ]] || continue
  docker rm --force "$container_id" > /dev/null
  log_ok "Removed development container $container_id"
done

for volume_id in "${!volume_ids[@]}"; do
  docker volume rm "$volume_id" > /dev/null
  log_ok "Removed development container volume $volume_id"
done

for image_id in "${!image_ids[@]}"; do
  if docker image rm "$image_id" > /dev/null; then
    log_ok "Removed development container image $image_id"
  else
    log_warning "Image remains in use and was not removed: $image_id"
  fi
done

if [[ -d "$cache_directory" ]]; then
  find "$cache_directory" -mindepth 1 -delete
fi
mkdir -p \
  "$cache_directory/knip" \
  "$cache_directory/prettier" \
  "$cache_directory/commitizen" \
  "$cache_directory/python" \
  "$cache_directory/trivy"
log_ok "Cleared and recreated repository cache directories"

log_ok "Development container caches cleared"
