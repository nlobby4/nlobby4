#!/usr/bin/env bash

# --------------------------------------------------
# End-to-end smoke test for the development container.
#
# Creates an isolated copy of the current working tree, performs a clean image
# build, runs the configured lifecycle commands, verifies the pinned tools and
# Docker access, then proves that dependencies can be restored offline from the
# persistent pnpm store volume.
#
# Run this script on the Docker host, not from inside a development container.
#
# Usage:
# mise run test:devcontainer
# pnpm run test:devcontainer
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

test_root=""
test_workspace=""
container_id=""
image_id=""
volume_names=()
test_configuration=""
smoke_image="${DEVCONTAINER_SMOKE_IMAGE:-}"

cleanup() {
  local test_status="$?"
  local cleanup_status=0
  local resources resource image_tags image_tag mounts workspace_tag

  set +e

  # Lifecycle failure can occur after creation but before up returns its ID.
  if [[ -n "$test_workspace" ]]; then
    resources="$(docker ps --all --quiet --filter "label=devcontainer.local_folder=$test_workspace")" || cleanup_status=1
    while IFS= read -r resource; do
      [[ -n "$resource" ]] || continue
      mounts="$(docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}' "$resource")" || cleanup_status=1
      while IFS= read -r volume_name; do
        [[ -n "$volume_name" ]] && volume_names+=("$volume_name")
      done <<< "$mounts"
      docker rm --force "$resource" > /dev/null 2>&1 || cleanup_status=1
    done <<< "$resources"
    container_id=""
  fi

  if [[ -n "$container_id" ]]; then
    docker rm --force "$container_id" > /dev/null 2>&1 || cleanup_status=1
  fi

  for volume_name in "${volume_names[@]}"; do
    [[ -n "$volume_name" ]] || continue
    if docker volume inspect "$volume_name" > /dev/null 2>&1; then
      docker volume rm "$volume_name" > /dev/null 2>&1 || cleanup_status=1
    fi
  done

  if [[ -n "$image_id" ]] && docker image inspect "$image_id" > /dev/null 2>&1; then
    docker image rm "$image_id" > /dev/null 2>&1 || cleanup_status=1
  fi

  # Include the pre-UID image, scoped to this random workspace basename.
  if [[ -n "$test_workspace" ]]; then
    workspace_tag="${test_workspace##*/}"
    image_tags="$(docker image ls --format '{{.Repository}}:{{.Tag}}' --filter "reference=vsc-${workspace_tag,,}*")" || cleanup_status=1
    while IFS= read -r image_tag; do
      [[ -n "$image_tag" ]] || continue
      docker image rm "$image_tag" > /dev/null 2>&1 || cleanup_status=1
    done <<< "$image_tags"
  fi

  case "$test_root" in
    "${TMPDIR:-/tmp}"/nlobby4-devcontainer-smoke.*)
      if [[ "$test_status" -eq 0 && "$cleanup_status" -eq 0 ]]; then
        rm -rf -- "$test_root" || cleanup_status=1
      else
        log_warning "Failed smoke workspace retained at $test_root"
      fi
      ;;
    "")
      ;;
    *)
      log_error "refusing to remove unexpected test path: $test_root"
      cleanup_status=1
      ;;
  esac

  if [[ "$cleanup_status" -ne 0 ]]; then
    log_warning "Some disposable smoke-test resources could not be removed"
    [[ "$test_status" -ne 0 ]] || test_status=1
  fi
  exit "$test_status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# --------------------------
# Pre-flight checks
# --------------------------

check_repository_root
check_command docker
check_command git
check_command jq
check_command mise
check_command pnpm
check_command tar

if [[ -f /.dockerenv ]] || [[ -f /run/.containerenv ]]; then
  log_error "run the devcontainer smoke test directly on the Docker host"
  exit 1
fi

docker info > /dev/null
. "$SCRIPT_DIR/../../ci/source-date-epoch.sh"

# --------------------------
# Create isolated workspace
# --------------------------

test_root="$(mktemp -d "${TMPDIR:-/tmp}/nlobby4-devcontainer-smoke.XXXXXX")"
test_workspace="$test_root"

log_info "Copying the working tree to $test_workspace"

case "${DEVCONTAINER_SMOKE_SOURCE:-working-tree}" in
  head)
    git archive HEAD | tar -xf - -C "$test_workspace"
    ;;
  working-tree)
    # Copy only trackable source, so ignored local config cannot mask a gap.
    git ls-files --cached --others --exclude-standard --deduplicate -z > "$test_root/source-list"
    while IFS= read -r -d '' source_file; do
      [[ -f "$source_file" || -L "$source_file" ]] || continue
      printf '%s\0' "$source_file"
    done < "$test_root/source-list" > "$test_root/existing-list"
    tar --null --verbatim-files-from -T "$test_root/existing-list" -cf - \
      | tar -xf - -C "$test_workspace"
    rm -- "$test_root/source-list" "$test_root/existing-list"
    ;;
  *)
    log_error "DEVCONTAINER_SMOKE_SOURCE must be working-tree or head"
    exit 1
    ;;
esac

git -C "$test_workspace" init --quiet
git -C "$test_workspace" add --all
git -C "$test_workspace" config --local user.name "Devcontainer Smoke"
git -C "$test_workspace" config --local user.email "devcontainer-smoke@example.invalid"
test_log="$(mktemp "${TMPDIR:-/tmp}/nlobby4-devcontainer-smoke-log.XXXXXX")"
log_info "Lifecycle log: $test_log"

# Candidate verification uses the original workspace contract but a separate
# launch configuration, so the image fingerprint still checks the real source.
test_configuration="$test_workspace/.devcontainer/devcontainer.json"
if [[ -n "$smoke_image" ]]; then
  if [[ ! "$smoke_image" =~ ^[^[:space:]@]+@sha256:[a-f0-9]{64}$ ]]; then
    log_error "DEVCONTAINER_SMOKE_IMAGE must identify an immutable image digest"
    exit 1
  fi
  smoke_platform="${DEVCONTAINER_SMOKE_PLATFORM:-linux/amd64}"
  case "$smoke_platform" in
    linux/amd64 | linux/arm64) ;;
    *)
      log_error "unsupported smoke platform: $smoke_platform"
      exit 1
      ;;
  esac
  mkdir -p "$test_workspace/.devcontainer/candidate"
  test_configuration="$test_workspace/.devcontainer/candidate/devcontainer.json"
  jq --arg image "$smoke_image" --arg platform "$smoke_platform" \
    'del(.build, .features, ."$schema") | .image = $image | .runArgs = ["--platform", $platform]' \
    "$test_workspace/.devcontainer/devcontainer.json" > "$test_configuration"
fi

# --------------------------
# Build and create container
# --------------------------

log_info "Building and creating the disposable development container"

mise exec -- devcontainer up \
  --workspace-folder "$test_workspace" \
  --config "$test_configuration" \
  --remove-existing-container \
  --build-no-cache \
  --frozen-lockfile 2>&1 | tee "$test_log"

container_id="$(
  docker ps --all --quiet \
    --filter "label=devcontainer.local_folder=$test_workspace" \
    | head -n 1
)"

if [[ -z "$container_id" ]]; then
  log_error "development container was not created"
  exit 1
fi

image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
# A supplied candidate belongs to the caller, not disposable test cleanup.
if [[ -n "$smoke_image" ]]; then image_id=""; fi
privileged="$(docker inspect --format '{{.HostConfig.Privileged}}' "$container_id")"
[[ "$privileged" == "true" ]]
if ! volume_mounts="$(
  docker inspect \
    --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}' \
    "$container_id"
)"; then
  log_error "could not inspect disposable container volumes"
  exit 1
fi
mapfile -t volume_names <<< "$volume_mounts"
pnpm_volume_name="$(
  docker inspect \
    --format '{{range .Mounts}}{{if eq .Destination "/home/nlobby4/.local/share/pnpm/store"}}{{println .Name}}{{end}}{{end}}' \
    "$container_id"
)"
expected_volume_prefix="${test_workspace##*/}-pnpm-v10-store-"
if [[ "$pnpm_volume_name" != "$expected_volume_prefix"* ]]; then
  log_error "unexpected pnpm volume name: $pnpm_volume_name"
  exit 1
fi

# --------------------------
# Runtime verification
# --------------------------

log_info "Verifying the container runtime and persistent pnpm store"

# shellcheck disable=SC1091
. "$test_workspace/.devcontainer/versions.env"

NODE_VERSION="$(awk -F '"' '$1 == "node = " { print $2 }' "$test_workspace/mise.toml")"
UV_VERSION="$(awk -F '"' '$1 == "uv = " { print $2 }' "$test_workspace/mise.toml")"
PNPM_VERSION="$(awk -F '"' '$2 == "npm:pnpm" { print $4 }' "$test_workspace/mise.toml")"
SHELLCHECK_VERSION="$(awk -F '"' '$1 == "shellcheck = " { print $2 }' "$test_workspace/mise.toml")"
TRIVY_VERSION="$(awk -F '"' '$1 == "trivy = " { print $2 }' "$test_workspace/mise.toml")"
ACT_VERSION="$(awk -F '"' '$1 == "act = " { print $2 }' "$test_workspace/mise.toml")"
ACTIONLINT_VERSION="$(awk -F '"' '$1 == "actionlint = " { print $2 }' "$test_workspace/mise.toml")"
ZIZMOR_VERSION="$(awk -F '"' '$1 == "zizmor = " { print $2 }' "$test_workspace/mise.toml")"
MINISIGN_VERSION="$(awk -F '"' '$1 == "minisign = " { print $2 }' "$test_workspace/mise.toml")"
GITLEAKS_VERSION="$(awk -F '"' '$1 == "gitleaks = " { print $2 }' "$test_workspace/mise.toml")"
GUM_VERSION="$(awk -F '"' '$1 == "gum = " { print $2 }' "$test_workspace/mise.toml")"
HADOLINT_VERSION="$(awk -F '"' '$1 == "hadolint = " { print $2 }' "$test_workspace/mise.toml")"
CONFTEST_VERSION="$(awk -F '"' '$1 == "conftest = " { print $2 }' "$test_workspace/mise.toml")"
TOMBI_VERSION="$(awk -F '"' '$1 == "tombi = " { print $2 }' "$test_workspace/mise.toml")"
YAMLLINT_VERSION="$(awk -F '"' '$1 ~ /^yamllint = / { print $2 }' "$test_workspace/mise.toml")"
DOCKER_VERSION="$(jq --raw-output '.features[] | .version' "$test_workspace/.devcontainer/devcontainer.json")"
DOCKER_BUILDX_VERSION="$(jq --raw-output '.features[] | .mobyBuildxVersion' "$test_workspace/.devcontainer/devcontainer.json")"

# The single-quoted script must expand only inside the development container.
# shellcheck disable=SC2016
mise exec -- devcontainer exec \
  --workspace-folder "$test_workspace" \
  --config "$test_configuration" \
  --remote-env "EXPECTED_NODE_VERSION=$NODE_VERSION" \
  --remote-env "EXPECTED_UV_VERSION=$UV_VERSION" \
  --remote-env "EXPECTED_PNPM_VERSION=$PNPM_VERSION" \
  --remote-env "EXPECTED_SHELLCHECK_VERSION=$SHELLCHECK_VERSION" \
  --remote-env "EXPECTED_TRIVY_VERSION=$TRIVY_VERSION" \
  --remote-env "EXPECTED_MINISIGN_VERSION=$MINISIGN_VERSION" \
  --remote-env "EXPECTED_GITLEAKS_VERSION=$GITLEAKS_VERSION" \
  --remote-env "EXPECTED_GUM_VERSION=$GUM_VERSION" \
  --remote-env "EXPECTED_HADOLINT_VERSION=$HADOLINT_VERSION" \
  --remote-env "EXPECTED_CONFTEST_VERSION=$CONFTEST_VERSION" \
  --remote-env "EXPECTED_TOMBI_VERSION=$TOMBI_VERSION" \
  --remote-env "EXPECTED_YAMLLINT_VERSION=$YAMLLINT_VERSION" \
  --remote-env "EXPECTED_MISE_VERSION=$MISE_VERSION" \
  --remote-env "EXPECTED_ACTIONLINT_VERSION=$ACTIONLINT_VERSION" \
  --remote-env "EXPECTED_ACT_VERSION=$ACT_VERSION" \
  --remote-env "EXPECTED_ZIZMOR_VERSION=$ZIZMOR_VERSION" \
  --remote-env "EXPECTED_DOCKER_VERSION=$DOCKER_VERSION" \
  --remote-env "EXPECTED_BUILDX_VERSION=$DOCKER_BUILDX_VERSION" \
  bash -lc '
    set -euo pipefail

    [[ "$(id --user)" -ne 0 ]]
    [[ "$(stat --format %u .)" == "$(id --user)" ]]
    [[ "$(ps --pid 1 --format comm=)" =~ ^(docker-init|tini)$ ]]
    ! sudo -n true
    [[ ! -S /var/run/docker-host.sock ]]
    [[ "$(node --version)" == "v$EXPECTED_NODE_VERSION" ]]
    [[ "$(uv --version | awk "{ print \$2 }")" == "$EXPECTED_UV_VERSION" ]]
    [[ "$(pnpm --version)" == "$EXPECTED_PNPM_VERSION" ]]
    [[ "$(shellcheck --version | awk "/^version:/ { print \$2 }")" == "$EXPECTED_SHELLCHECK_VERSION" ]]
    [[ "$(trivy --version | awk "/^Version:/ { print \$2 }")" == "$EXPECTED_TRIVY_VERSION" ]]
    [[ "$(minisign -v | awk "{ print \$2 }")" == "$EXPECTED_MINISIGN_VERSION" ]]
    [[ "$(gitleaks version)" == "$EXPECTED_GITLEAKS_VERSION" ]]
    [[ "$(gum --version | awk "{ print \$3 }" | sed "s/^v//")" == "$EXPECTED_GUM_VERSION" ]]
    [[ "$(hadolint --version | awk "{ print \$NF }")" == "$EXPECTED_HADOLINT_VERSION" ]]
    [[ "$(conftest --version | awk "/^Conftest:/ { print \$2 }")" == "$EXPECTED_CONFTEST_VERSION" ]]
    [[ "$(tombi --version | awk "{ print \$2 }")" == "$EXPECTED_TOMBI_VERSION" ]]
    [[ "$(yamllint --version | awk "{ print \$2 }")" == "$EXPECTED_YAMLLINT_VERSION" ]]
    [[ "$(mise --version | awk "{ print \$1 }")" == "$EXPECTED_MISE_VERSION" ]]
    [[ -z "${MISE_DATA_DIR:-}" ]]
    [[ "$(mise where node)" == /usr/local/share/mise/installs/node/* ]]
    [[ ":$PATH:" == *":/home/nlobby4/.local/share/mise/shims:/usr/local/share/mise/shims:"* ]]
    [[ ! -e /usr/local/share/mise/cache ]]
    [[ "$(actionlint --version | head -n 1)" == "$EXPECTED_ACTIONLINT_VERSION" ]]
    [[ "$(act --version)" == "act version $EXPECTED_ACT_VERSION" ]]
    [[ "$(zizmor --version)" == "zizmor $EXPECTED_ZIZMOR_VERSION" ]]
    [[ "$(docker --version)" == Docker\ version\ "$EXPECTED_DOCKER_VERSION"-* ]]
    [[ "$(docker buildx version)" == *"$EXPECTED_BUILDX_VERSION"* ]]
    [[ "$(pnpm store path)" == "/home/nlobby4/.local/share/pnpm/store/v10" ]]
    [[ -w "/home/nlobby4/.local/share/pnpm/store" ]]

    findmnt --mountpoint "/home/nlobby4/.local/share/pnpm/store" > /dev/null
    docker version > /dev/null
    docker compose version | tee /tmp/docker-compose-version.txt
    printf "services:\n  daemon:\n    image: hello-world\n" > /tmp/compose.yml
    docker compose --project-name devcontainer-smoke --file /tmp/compose.yml up --detach
    docker compose --project-name devcontainer-smoke --file /tmp/compose.yml down
    mise run health

    # Force capacity failures without allocating space or exhausting inodes.
    for variable in DEVCONTAINER_MIN_FREE_MIB DEVCONTAINER_MIN_FREE_INODES; do
      if env "$variable=2147483647" COLOR_MODE=always TERM=xterm NO_COLOR= \
        bash scripts/linux/commands/repository/validation/workspace-status.sh \
        > /tmp/capacity-failure.txt; then
        printf "%s\n" "capacity check incorrectly passed: $variable" >&2
        exit 1
      fi
      grep -q "capacity" /tmp/capacity-failure.txt
      grep -Fq "minimum 2147483647" /tmp/capacity-failure.txt
      grep -Fq "$(printf "\033[0;31m")" /tmp/capacity-failure.txt
    done
  '

# --------------------------
# Restart verification
# --------------------------

# Disposable installer caches must not be exported into the final image.
# shellcheck disable=SC2016
docker exec --user 0 "$container_id" bash -c '
  set -euo pipefail
  for directory in /root/.cache/mise /root/.cache/pip /root/.cache/uv /root/.cache/node /root/.npm; do
    if [[ -d "$directory" ]]; then
      [[ -z "$(find "$directory" -type f -print -quit)" ]]
    fi
  done
'

log_info "Restarting the container and re-running lifecycle health checks"

docker stop "$container_id" > /dev/null
mise exec -- devcontainer up \
  --workspace-folder "$test_workspace" \
  --config "$test_configuration" \
  --expect-existing-container \
  --frozen-lockfile > /dev/null

mise exec -- devcontainer exec \
  --workspace-folder "$test_workspace" \
  --config "$test_configuration" \
  bash -lc 'docker version > /dev/null && mise run health > /dev/null'

# --------------------------
# Abrupt termination recovery
# --------------------------

log_info "Killing the disposable container and verifying data-preserving recovery"
recovery_command_path="$(mise exec -- printenv PATH)"
bootstrap_before_recovery="$(sha256sum "$test_workspace/mise.toml" "$test_workspace/.devcontainer/versions.env" "$test_workspace/.devcontainer/checksums.sha256" "$test_workspace/.github/actions/setup-node-deps/action.yml")"
set +e
mise exec -- devcontainer exec --workspace-folder "$test_workspace" \
  --config "$test_configuration" node scripts/node/tests/fixtures/crash-bootstrap-update.js
recovery_fixture_status="$?"
set -e
[[ "$recovery_fixture_status" -ne 0 ]]
[[ -f "$test_workspace/.devcontainer/.mise-bootstrap-update/state.json" ]]
grep -q '^min_version = "3000.1.0"' "$test_workspace/mise.toml"
mounts_before_recovery="$(docker inspect --format '{{json .Mounts}}' "$container_id" | jq --sort-keys 'sort_by(.Destination, .Type, .Source)')"
docker kill --signal KILL "$container_id" > /dev/null
(
  cd -- "$test_workspace"
  PATH="$recovery_command_path" bash scripts/linux/commands/devcontainer/devcontainer-recover.sh --preview
  PATH="$recovery_command_path" bash scripts/linux/commands/devcontainer/devcontainer-recover.sh --restart
)
bootstrap_after_recovery="$(sha256sum "$test_workspace/mise.toml" "$test_workspace/.devcontainer/versions.env" "$test_workspace/.devcontainer/checksums.sha256" "$test_workspace/.github/actions/setup-node-deps/action.yml")"
[[ "$bootstrap_after_recovery" == "$bootstrap_before_recovery" ]] || {
  log_error "Bootstrap files differ after recovery"
  exit 1
}
[[ ! -e "$test_workspace/.devcontainer/.mise-bootstrap-update" ]] || {
  log_error "Bootstrap journal remains after recovery"
  exit 1
}
mounts_after_recovery="$(docker inspect --format '{{json .Mounts}}' "$container_id" | jq --sort-keys 'sort_by(.Destination, .Type, .Source)')"
[[ "$mounts_after_recovery" == "$mounts_before_recovery" ]] || {
  log_error "Persistent mounts differ after recovery"
  exit 1
}
mise exec -- devcontainer exec --workspace-folder "$test_workspace" \
  --config "$test_configuration" bash -lc 'docker image inspect hello-world > /dev/null'

# --------------------------
# Offline store verification
# --------------------------

log_info "Reinstalling dependencies offline from the persistent pnpm store"

rm -rf -- "$test_workspace/node_modules" "$test_workspace/scripts/node/node_modules"

mise exec -- devcontainer exec \
  --workspace-folder "$test_workspace" \
  --config "$test_configuration" \
  bash -lc \
  'pnpm install --offline --frozen-lockfile --ignore-scripts --silent'

if [[ ! -d "$test_workspace/node_modules" || ! -d "$test_workspace/scripts/node/node_modules" ]]; then
  log_error "offline dependency installation did not create node_modules"
  exit 1
fi

log_ok "Development container smoke test passed"
