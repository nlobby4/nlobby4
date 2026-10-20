# Disposable SSH server for the optional Git integration test.
# The test supplies the digest-pinned base from .devcontainer/Dockerfile.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}

# The SSH daemon needs root to switch authenticated sessions to git-test.
# hadolint ignore=DL3002
USER 0
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
# This optional fixture tests SSH behavior, not package reproducibility.
# hadolint ignore=DL3008
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-server \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --shell /bin/sh git-test \
  && echo 'git-test:disposable-test-password' | chpasswd \
  && git config --system --add safe.directory /fixture/remote.git

COPY git-ssh-sshd.conf /etc/ssh/sshd_config
CMD ["sh", "-c", "mkdir -p /run/sshd && exec /usr/sbin/sshd -D -e"]
