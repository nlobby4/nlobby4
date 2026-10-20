#!/usr/bin/env python3
"""Sign and verify a disposable commit without changing repository objects or refs.

Uses the caller's configured signing key/agent. OpenPGP and X.509 pinentry is
disabled; SSH askpass is forced to fail rather than opening a prompt. SSH
verification uses the configured allowed-signers policy, not a fabricated trust
entry. Disabled signing is handled by git-status.sh before calling this helper.
"""

import os
import signal
import subprocess
import sys
import tempfile
from pathlib import Path


def run(args, environment, timeout=5):
    return subprocess.run(args, env=environment, stdin=subprocess.DEVNULL,
                          capture_output=True, text=True, check=True, timeout=timeout).stdout.strip()


def verify():
    environment = dict(os.environ, GIT_TERMINAL_PROMPT="0", GIT_ASKPASS="/bin/false",
                       SSH_ASKPASS="/bin/false", SSH_ASKPASS_REQUIRE="force")
    format_name = subprocess.run(["git", "config", "--get", "gpg.format"],
                                 capture_output=True, text=True, timeout=5).stdout.strip() or "openpgp"
    if format_name not in ("openpgp", "ssh", "x509"):
        raise ValueError("unsupported signing format")
    program_key = {"openpgp": "gpg.openpgp.program", "ssh": "gpg.ssh.program", "x509": "gpg.x509.program"}[format_name]
    program = subprocess.run(["git", "config", "--get", program_key],
                             capture_output=True, text=True, timeout=5).stdout.strip()
    if not program and format_name == "openpgp":
        program = subprocess.run(["git", "config", "--get", "gpg.program"],
                                 capture_output=True, text=True, timeout=5).stdout.strip()
    program = program or {"openpgp": "gpg", "ssh": "ssh-keygen", "x509": "gpgsm"}[format_name]
    with tempfile.TemporaryDirectory(prefix="git-signing-readiness-") as temporary:
        objects = Path(temporary) / "objects"
        objects.mkdir()
        environment["GIT_OBJECT_DIRECTORY"] = str(objects)
        environment.pop("GIT_ALTERNATE_OBJECT_DIRECTORIES", None)
        options = []
        if format_name != "ssh":
            wrapper = Path(temporary) / "signer"
            # Pass the executable through the environment, never interpolate shell code.
            wrapper.write_text('#!/bin/sh\nexec "$READINESS_SIGNER" --batch --no-tty --pinentry-mode error "$@"\n')
            wrapper.chmod(0o700)
            environment["READINESS_SIGNER"] = program
            options = ["-c", f"{program_key}={wrapper}"]
        tree = run(["git", "hash-object", "-w", "-t", "tree", "--stdin"], environment)
        commit = run(["git", *options, "commit-tree", "-S", "-m", "Disposable repository readiness signature", tree], environment, 8)
        run(["git", *options, "verify-commit", commit], environment, 8)


if __name__ == "__main__":
    def interrupted(_signal, _frame):
        raise InterruptedError("signing interrupted")

    signal.signal(signal.SIGTERM, interrupted)
    try:
        verify()
        print("temporary commit signed and verified without prompts")
    except (OSError, ValueError, subprocess.SubprocessError):
        # Do not expose key details or agent diagnostics in the summary.
        print("unable to sign and verify noninteractively; check key, agent and verification policy")
        sys.exit(1)
