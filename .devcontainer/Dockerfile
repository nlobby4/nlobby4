# syntax=docker/dockerfile:1@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

# --------------------------------------------------
# Dockerfile for the development container.
#
# Builds the tool environment shared by local development and container tests.
# Microsoft's Debian Bookworm Dev Containers image provides the base system.
# This file adds the repository's user, pinned system packages and locked tools.
# Docker-in-Docker is added separately by the Feature in devcontainer.json.
#
# The multi-architecture Dockerfile BuildKit frontend is pinned by digest while
# retaining its major tag as a human-readable update channel. Review and refresh
# the tag and digest together when updating the BuildKit frontend.
#
# Image builds install tools without changing committed locks. After creation,
# devcontainer.json runs repository setup against the mounted workspace. Each
# container start runs readiness checks to report drift and configuration errors.
# Building the image alone does not run those workspace lifecycle checks.
#
# Opening this container in VS Code requires host Docker with BuildKit/Buildx,
# VS Code and the Dev Containers extension, not host mise, Bash or Python.
# Project tools and readiness checks run inside the container. Optional
# host-side test/scan scripts require the host tools used by those scripts.
#
# Running the entire project setup directly on the host is a separate workflow.
# It requires the pinned mise bootstrap, Bash 4+, Git, GNU coreutils/timeout,
# Python 3.11+ with venv support and a `python` command, plus the direct system
# dependencies installed below (mise does not provision these packages).
# Full local readiness also requires compatible Docker/Buildx/Compose and a Git
# identity. See README.md for prerequisites and platform limitations.
# For this managed-local workflow, run from the repository root:
#
# mise trust
# mise install --locked
# mise run setup
# mise run health
#
# To invoke the underlying repository setup script directly instead of the
# mise task, after trusting/installing the tools, run:
#
# mise exec -- pnpm install --frozen-lockfile --ignore-scripts
# mise exec -- bash scripts/linux/commands/repository/setup.sh
#
# For more information, see:
# https://github.com/devcontainers/images
# https://containers.dev/supporting
# https://mise.jdx.dev/
# https://docs.docker.com/build/building/best-practices/
# https://docs.docker.com/build/ci/github-actions/reproducible-builds/
# --------------------------------------------------

# --------------------------
# Base Image
# --------------------------

# Use the Micros*ft Dev Containers Debian Bookworm image. The complete tag and
# immutable OCI index digest are owned by this FROM instruction so Docker
# tooling and Renovate can detect and update the dependency directly.
# CI supplies the source commit timestamp. Direct local builds use Unix epoch
# unless SOURCE_DATE_EPOCH is provided. This normalizes image metadata, not all
# files or generated content inside the image.
# Keep the default in global scope because the frontend resolves image timestamps
# before processing stage instructions. A stage-only default is not equivalent.
ARG SOURCE_DATE_EPOCH=0
FROM mcr.microsoft.com/devcontainers/base:bookworm@sha256:3aacff4130e6cf04709f9cab1d7a6d3e1cc4bff6202bc61611831a18d3755673

ARG TARGETARCH
ARG SOURCE_DATE_EPOCH

# The container user is provided here but named in devcontainer.json, which
# passes it as a build argument and reuses the same value for remoteUser.
ARG USER=nlobby4
ARG USER_HOME=/home/${USER}

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# User-installed tools can take precedence over the image's system tools.
# Adding shim directories does not install tools or change their pinned versions.
ENV PATH="${USER_HOME}/.local/share/mise/shims:/usr/local/share/mise/shims:${PATH}"

# versions.env owns the Debian snapshot, direct package pins and mise bootstrap.
# Copy it before installation so a change invalidates the affected build cache.
# Each RUN sources it again because shell variables do not survive between RUNs.
COPY .devcontainer/versions.env /usr/local/share/devcontainer/versions.env

# --------------------------
# Debian package sources
# --------------------------

# Remove every inherited APT source before configuring the dated Debian snapshot,
# so future base-image sources cannot remain enabled accidentally.
# Both Debian and security packages come from the same chosen snapshot date.
# Historical metadata may have expired, so its freshness deadline is disabled.
# Signature verification remains enabled through Debian's archive keyring.
RUN . /usr/local/share/devcontainer/versions.env \
  && rm -f \
  /etc/apt/sources.list \
  /etc/apt/sources.list.d/*.list \
  /etc/apt/sources.list.d/*.sources \
  && printf '%s\n' \
  'Types: deb' \
  "URIs: https://snapshot.debian.org/archive/debian/${DEBIAN_SNAPSHOT}" \
  'Suites: bookworm bookworm-updates' \
  'Components: main' \
  'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
  'Check-Valid-Until: no' \
  '' \
  'Types: deb' \
  "URIs: https://snapshot.debian.org/archive/debian-security/${DEBIAN_SNAPSHOT}" \
  'Suites: bookworm-security' \
  'Components: main' \
  'Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg' \
  'Check-Valid-Until: no' \
  > /etc/apt/sources.list.d/debian.sources

# --------------------------
# Workspace user
# --------------------------

# Reuse the UID 1000 account regardless of its login name, or create it if absent.
# An existing target account must already have UID 1000. A different UID fails
# the build rather than silently assigning the workspace to another identity.
# Keep the inherited primary group and move the home to /home/${USER} if needed.
# The Dev Container client may remap the UID later to match the host workspace.
#
# Remove this user's inherited sudo membership and named sudoers rules. Prepare
# writable user cache and pnpm directories without granting ownership of system
# tool installations. These steps stay together so a failed account change
# cannot produce a successfully built layer with only part of the setup applied.
RUN test "${USER}" != root \
  && printf '%s\n' "${USER}" | grep -Eq '^[a-z_][a-z0-9_-]*$' \
  && test "${USER_HOME}" = "/home/${USER}" \
  && inherited_user="$(getent passwd 1000 | cut -d: -f1 || true)" \
  && if getent passwd "${USER}" >/dev/null; then \
  test "$(id -u "${USER}")" = 1000 \
  && if test "$(getent passwd "${USER}" | cut -d: -f6)" != "${USER_HOME}"; then \
  usermod --home "${USER_HOME}" --move-home "${USER}"; fi; \
  elif test -n "${inherited_user}"; then \
  usermod --login "${USER}" --home "${USER_HOME}" --move-home "${inherited_user}"; \
  else useradd --create-home --user-group --uid 1000 --home-dir "${USER_HOME}" "${USER}"; fi \
  && if id -nG "${USER}" | grep -qw sudo; then gpasswd --delete "${USER}" sudo; fi \
  && rm -f "/etc/sudoers.d/${inherited_user:-${USER}}" "/etc/sudoers.d/${USER}" \
  && mkdir -p "${USER_HOME}/.cache" "${USER_HOME}/.local/share/pnpm/store" \
  && primary_group="$(id -g "${USER}")" \
  && chown -R "${USER}:${primary_group}" "${USER_HOME}/.cache" "${USER_HOME}/.local"

# --------------------------
# Debian tools
# --------------------------

# Install direct dependencies at exact versions from versions.env. APT resolves
# their transitive dependencies against the snapshot configured above.
# --no-install-recommends avoids optional packages not needed by this setup.
# Keep index refresh, installation and cleanup in one RUN so a cached index
# cannot be reused independently and temporary package data stays out of layers.
# Remove installer logs and ldconfig's auxiliary cache after a successful install.
RUN . /usr/local/share/devcontainer/versions.env \
  && DEBIAN_FRONTEND=noninteractive apt-get -o APT::Update::Error-Mode=any update \
  && apt-get -y install --no-install-recommends \
  cmark-gfm="${CMARK_GFM_VERSION}" \
  curl="${CURL_VERSION}" \
  gawk="${GAWK_VERSION}" \
  git-lfs="${GIT_LFS_VERSION}" \
  jq="${JQ_VERSION}" \
  python3-venv="${PYTHON_VENV_VERSION}" \
  yq="${YQ_VERSION}" \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /var/log/apt/history.log /var/log/apt/term.log /var/log/dpkg.log /var/cache/ldconfig/aux-cache

# --------------------------
# Install mise
#
# Install the mise executable first so it can provision the locked toolchain.
# System installations are readable by every user and separate from tools a
# developer may install in their own home directory.
#
# mise.toml owns tool selections. mise.lock and .mise/locks own their resolved
# versions, artifacts and native npm/Python dependency graphs.
#
# The bootstrap version is stored in versions.env, and checksums.sha256
# verifies the amd64 and arm64 binaries against committed hashes. This is
# integrity verification. The updater additionally verifies the publisher's
# Minisign signature before accepting replacement bootstrap hashes.
# Download, verify, install and remove the binary in one RUN so no unverified
# executable is installed and the temporary download is not retained in a layer.
# --------------------------

COPY .devcontainer/checksums.sha256 /usr/local/share/devcontainer/checksums.sha256

RUN . /usr/local/share/devcontainer/versions.env \
  && case "${TARGETARCH}" in \
  amd64) MISE_ARCH=x64 ;; \
  arm64) MISE_ARCH=arm64 ;; \
  *) echo "Unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac \
  && MISE_ASSET="mise-v${MISE_VERSION}-linux-${MISE_ARCH}" \
  && curl --fail --location --show-error --silent --retry 5 \
  --retry-all-errors --retry-max-time 300 --connect-timeout 15 --max-time 60 \
  "https://github.com/jdx/mise/releases/download/v${MISE_VERSION}/${MISE_ASSET}" \
  -o "/tmp/${MISE_ASSET}" \
  && MISE_SHA256="$(awk -v asset="${MISE_ASSET}" '$2 == asset { print $1 }' /usr/local/share/devcontainer/checksums.sha256)" \
  && test -n "${MISE_SHA256}" \
  && printf '%s  %s\n' "${MISE_SHA256}" "/tmp/${MISE_ASSET}" \
  | sha256sum --check --strict - \
  && install -m 0755 "/tmp/${MISE_ASSET}" /usr/local/bin/mise \
  && rm "/tmp/${MISE_ASSET}"

# Copy the complete locked tool configuration before installing anything it owns.
# The local Aqua registry supplies the repository's platform/signature overrides.
# mise discovers system installations under /usr/local/share/mise at runtime.
COPY mise.toml /usr/local/share/mise/mise.toml
COPY mise.lock /usr/local/share/mise/mise.lock
COPY .mise/locks /usr/local/share/mise/.mise/locks
COPY .mise/aqua.yaml /usr/local/share/mise/.mise/aqua.yaml

# Debian owns the only Python interpreter, its venv support and Python-based yq.
# mise owns uv/pipx and isolated Python tool dependencies, not another interpreter.
# Native graph installation discovers `python`. Alias Debian's `python3` for it.
# Installation disables uv's Python downloads so incompatible tools fail clearly.
RUN ln -s /usr/bin/python3 /usr/local/bin/python

# --------------------------
# Frozen tool installation
# --------------------------

# Install locked uv first because Python dependency-graph resolution needs it.
# The dry run then checks version drift for the target Linux platform. It does
# not rewrite mise.lock and is not the full artifact/native-graph validation.
# The image-contract step below validates those committed inputs separately.
# Install the remaining tools in locked mode and make their files readable by
# the non-root user without making the system tool directories writable to them.
#
# Cache mounts retain reusable downloads outside the exported image layers.
# sharing=locked serializes builds that use the same cache. These caches are an
# optimization, not required image inputs. A build must also work with empty
# caches. uv copies installed files so environments do not depend on cache mounts.
RUN --mount=type=cache,target=/root/.cache/mise,sharing=locked \
  --mount=type=cache,target=/root/.cache/pip,sharing=locked \
  --mount=type=cache,target=/root/.cache/uv,sharing=locked \
  --mount=type=cache,target=/root/.cache/node,sharing=locked \
  --mount=type=cache,target=/root/.npm,sharing=locked \
  export PIP_CACHE_DIR=/root/.cache/pip UV_CACHE_DIR=/root/.cache/uv \
  UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never NODE_COMPILE_CACHE=/root/.cache/node npm_config_cache=/root/.npm \
  && \
  case "${TARGETARCH}" in \
  amd64) MISE_PLATFORM=linux-x64 ;; \
  arm64) MISE_PLATFORM=linux-arm64 ;; \
  *) echo "Unsupported target architecture: ${TARGETARCH}" >&2; exit 1 ;; \
  esac \
  && mise trust /usr/local/share/mise/mise.toml \
  && mise --cd /usr/local/share/mise install --system --locked uv \
  && MISE_LOCK_DRIFT="$(mise --cd /usr/local/share/mise lock --dry-run --json --platform "${MISE_PLATFORM}")" \
  && if ! printf '%s' "${MISE_LOCK_DRIFT}" | jq --exit-status 'length == 0' >/dev/null; then \
  echo "mise.lock is out of sync with mise.toml:" >&2; \
  printf '%s\n' "${MISE_LOCK_DRIFT}" >&2; \
  echo "Regenerate it with 'mise lock' then commit the updated mise.lock and rebuild the container" >&2; \
  exit 1; \
  fi \
  && mise --cd /usr/local/share/mise install --system --locked \
  && chmod -R u=rwX,go=rX /usr/local/share/mise

# --------------------------
# Image contract
# --------------------------

# Record the selected build inputs and installed system versions so startup can
# compare the image with the mounted workspace and report a required rebuild.
# The TOML parser excludes mise task definitions because task orchestration is
# not a tool-installation input. Native lock references and hashes are checked.
# Copy only the allowlisted inputs, never local notes or credentials, then remove
# the temporary recording directory. The generated contract remains in the image.
COPY .devcontainer/Dockerfile .devcontainer/devcontainer.json .devcontainer/devcontainer-lock.json .devcontainer/versions.env .devcontainer/checksums.sha256 /tmp/devcontainer-inputs/.devcontainer/
COPY .dockerignore mise.toml mise.lock /tmp/devcontainer-inputs/
COPY .mise/locks /tmp/devcontainer-inputs/.mise/locks
COPY .mise/aqua.yaml /tmp/devcontainer-inputs/.mise/aqua.yaml
COPY scripts/python/devcontainer-state.py /tmp/devcontainer-inputs/scripts/python/devcontainer-state.py
RUN python3 /tmp/devcontainer-inputs/scripts/python/devcontainer-state.py record --root /tmp/devcontainer-inputs \
  && rm -rf /tmp/devcontainer-inputs

# --------------------------
# Runtime user
# --------------------------

# There is intentionally no USER instruction because Docker-in-Docker needs root
# for its daemon entrypoint. devcontainer.json selects the non-root remoteUser
# for editor sessions and lifecycle commands.
#Plain docker run still defaults to root.
