#!/usr/bin/env python3
"""Exercise Buildx, Docker and Compose offline using a disposable local image.

The scratch image contains only /usr/bin/true and its shared libraries. Runs
are non-root, read-only, networkless and capability-free, without host mounts.
Only this invocation's exact containers and image tag are removed. BuildKit may
retain its small build cache; this check never prunes unrelated resources.
"""

import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path


def check():
    token = "readiness-" + uuid.uuid4().hex
    image = token + ":probe"
    names = [token + "-docker", token + "-compose"]
    deadline = time.monotonic() + 20
    cleanup_errors = []

    def run(args, timeout=8):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("workload deadline exceeded")
        return subprocess.run(args, stdin=subprocess.DEVNULL, capture_output=True,
                              text=True, check=True, timeout=min(timeout, remaining)).stdout

    try:
        with tempfile.TemporaryDirectory(prefix="docker-readiness-") as temporary:
            context = Path(temporary)
            binary = Path("/usr/bin/true")
            libraries = run(["ldd", str(binary)])
            paths = {str(binary), *re.findall(r"(/[\w/+.\-]+)", libraries)}
            for name in paths:
                source = Path(name)
                if not source.is_file():
                    raise ValueError("workload dependency is not a regular file")
                destination = context / "rootfs" / source.relative_to("/")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination, follow_symlinks=True)
            (context / "Dockerfile").write_text('FROM scratch\nCOPY rootfs/ /\nENTRYPOINT ["/usr/bin/true"]\n')
            run(["docker", "buildx", "build", "--network", "none", "--pull=false", "--load", "--tag", image, str(context)], 12)
            run(["docker", "run", "--rm", "--pull", "never", "--name", names[0], "--network", "none",
                 "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
                 "--user", "65534:65534", image])
            compose = context / "compose.yaml"
            compose.write_text(f"services:\n  probe:\n    image: {image}\n    network_mode: none\n"
                               "    read_only: true\n    user: '65534:65534'\n    cap_drop: [ALL]\n"
                               "    security_opt: ['no-new-privileges:true']\n")
            run(["docker", "compose", "--project-name", token, "--file", str(compose),
                 "run", "--rm", "--no-deps", "--pull", "never", "--name", names[1], "probe"])
    finally:
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        cleanup_deadline = time.monotonic() + 6

        def cleanup_run(args):
            remaining = cleanup_deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("cleanup deadline exceeded")
            return subprocess.run(args, capture_output=True, timeout=min(1, remaining))

        # rm --force targets only UUID-scoped resources created by this probe.
        for name in names:
            try:
                removed = cleanup_run(["docker", "rm", "--force", name])
                if removed.returncode:
                    listed = cleanup_run(["docker", "container", "ls", "--all", "--quiet", "--filter", f"name=^{name}$"])
                    if listed.returncode or listed.stdout.strip():
                        cleanup_errors.append(name)
            except (OSError, subprocess.SubprocessError):
                cleanup_errors.append(name)
        try:
            removed = cleanup_run(["docker", "image", "rm", image])
            if removed.returncode:
                listed = cleanup_run(["docker", "image", "ls", "--quiet", "--filter", f"reference={image}"])
                if listed.returncode or listed.stdout.strip():
                    cleanup_errors.append(image)
        except (OSError, subprocess.SubprocessError):
            cleanup_errors.append(image)
        if cleanup_errors:
            raise RuntimeError("disposable workload cleanup failed: " + ", ".join(cleanup_errors))


def interrupted(_signal, _frame):
    raise InterruptedError("workload interrupted")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, interrupted)
    try:
        check()
        print("Buildx build, Docker run and Compose run passed; disposable resources removed")
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"workload or cleanup failed ({type(error).__name__}); inspect Docker daemon and builder")
        if isinstance(error, RuntimeError):
            print(str(error))
        sys.exit(1)
