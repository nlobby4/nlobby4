/**
 * Exercise real Git SSH authentication without personal credentials.
 *
 * Optional host test requiring Docker, Bash, Git, OpenSSH and util-linux
 * script. Builds a disposable SSH server using the project's pinned container
 * base. No readiness task depends on this test. Fixture packages are
 * test-only.
 *
 * Usage: node --test scripts/node/tests/git-ssh.integration.js.
 *
 * @file Git SSH integration tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const helper = path.join(root, "scripts/linux/utils/functions/git.sh");
const state = { directory: "", image: "", container: "", port: "" };
const environment = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_COUNT: "0",
  COLOR_MODE: "never",
  ASCII_ONLY: "1",
};
for (const name of [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_PREFIX",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_SSH_VARIANT",
  "SSH_AUTH_SOCK",
])
  delete environment[name];

const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

function command(program, args, options = {}) {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    timeout: 120000,
    env: environment,
    ...options,
  });
  assert.ifError(result.error);
  assert.equal(
    result.status,
    0,
    `${program}: ${result.stderr || result.stdout}`,
  );
  return result.stdout.trim();
}

function key(name, passphrase = "") {
  const file = path.join(state.directory, name);
  command("ssh-keygen", ["-q", "-t", "ed25519", "-N", passphrase, "-f", file]);
  return file;
}

before(() => {
  command("bash", [
    "-c",
    'for tool in git ssh ssh-keygen script timeout; do command -v "$tool" >/dev/null || { printf "Missing test dependency: %s\\n" "$tool" >&2; exit 1; }; done',
  ]);
  command("docker", ["info"]);
  state.directory = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-git-ssh-"));
  state.image = `workflow-git-ssh:${path.basename(state.directory).toLowerCase()}`;
  const server = path.join(state.directory, "server");
  const checkout = path.join(state.directory, "checkout");
  fs.mkdirSync(server);
  fs.mkdirSync(checkout);
  const git = (...args) => command("git", args, { cwd: checkout });
  git("init", "-q", "-b", "trunk");
  git(
    "-c",
    "user.name=SSH Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "fixture",
  );
  git("clone", "-q", "--bare", checkout, path.join(server, "remote.git"));
  git("remote", "add", "origin", "fixture:/fixture/remote.git");
  const host = key("host_key");
  fs.copyFileSync(host, path.join(server, "host_key"));
  fs.chmodSync(path.join(server, "host_key"), 0o600);
  for (const [name, passphrase] of [
    ["valid", ""],
    ["encrypted", "fixture-passphrase"],
    ["stalled", ""],
  ])
    key(name, passphrase);
  key("different_host");
  const publicKey = (name) =>
    fs.readFileSync(path.join(state.directory, `${name}.pub`), "utf8").trim();
  fs.writeFileSync(
    path.join(server, "authorized_keys"),
    `${publicKey("valid")}\n${publicKey("encrypted")}\ncommand="sleep 60" ${publicKey("stalled")}\n`,
  );

  const base = /^FROM\s+(\S+)/mu.exec(
    fs.readFileSync(path.join(root, ".devcontainer/Dockerfile"), "utf8"),
  )?.[1];
  assert.match(base ?? "", /@sha256:[a-f0-9]{64}$/u);
  command("docker", [
    "build",
    "--quiet",
    "--tag",
    state.image,
    "--build-arg",
    `BASE_IMAGE=${base}`,
    "--file",
    path.join(root, "scripts/node/tests/fixtures/git-ssh.Dockerfile"),
    path.join(root, "scripts/node/tests/fixtures"),
  ]);
  state.container = path.basename(state.directory).toLowerCase();
  command("docker", [
    "run",
    "--detach",
    "--name",
    state.container,
    "--publish",
    "127.0.0.1::22",
    "--read-only",
    "--tmpfs",
    "/run",
    "--tmpfs",
    "/tmp",
    "--mount",
    `type=bind,source=${server},target=/fixture,readonly`,
    state.image,
  ]);
  state.port = command("docker", ["port", state.container, "22/tcp"])
    .split(":")
    .at(-1);
  assert.match(state.port, /^[0-9]+$/u);
  try {
    command(
      "docker",
      [
        "exec",
        state.container,
        "sh",
        "-c",
        "while ! test -s /run/sshd.pid; do sleep 0.1; done",
      ],
      { timeout: 10000 },
    );
  } catch (error) {
    const logs = spawnSync("docker", ["logs", state.container], {
      encoding: "utf8",
      timeout: 10000,
    });
    throw new Error(
      `SSH fixture failed to start: ${logs.stderr || logs.stdout}`,
      { cause: error },
    );
  }
});

after(() => {
  const failures = [];
  for (const args of [
    ...(state.container ? [["rm", "--force", state.container]] : []),
    ...(state.image ? [["image", "rm", state.image]] : []),
  ]) {
    const inspection = spawnSync(
      "docker",
      args[0] === "image" ?
        ["image", "inspect", state.image]
      : ["inspect", state.container],
      { encoding: "utf8", timeout: 30000 },
    );
    if (inspection.error) {
      failures.push(inspection.error.message);
      continue;
    }
    if (inspection.status !== 0) {
      if (!/No such (object|image|container)/iu.test(inspection.stderr))
        failures.push(inspection.stderr);
      continue;
    }
    const result = spawnSync("docker", args, {
      encoding: "utf8",
      timeout: 30000,
    });
    if (result.error || result.status !== 0)
      failures.push(result.error?.message ?? result.stderr);
  }
  if (state.directory)
    fs.rmSync(state.directory, { recursive: true, force: true });
  assert.deepEqual(
    failures,
    [],
    "disposable Docker resources could not be removed",
  );
});

for (const tty of [false, true]) {
  for (const scenario of [
    "valid",
    "missing",
    "encrypted",
    "unknown-host",
    "changed-host",
    "stalled",
  ]) {
    for (const operation of [
      "git_refresh_upstream",
      "git_remote_default_branch",
    ]) {
      test(
        `${operation}: ${scenario}, ${tty ? "terminal" : "pipe"}`,
        { timeout: 25000 },
        () => {
          const knownHosts = path.join(state.directory, "known_hosts");
          const host = fs
            .readFileSync(
              path.join(
                state.directory,
                scenario === "changed-host" ? "different_host.pub" : (
                  "host_key.pub"
                ),
              ),
              "utf8",
            )
            .trim();
          const known =
            scenario === "unknown-host" ? "" : (
              `[127.0.0.1]:${state.port} ${host}\n`
            );
          fs.writeFileSync(knownHosts, known);
          const identity =
            ["encrypted", "stalled", "missing"].includes(scenario) ? scenario
            : "valid";
          const configuration = path.join(state.directory, "ssh_config");
          fs.writeFileSync(
            configuration,
            `Host fixture\n  HostName 127.0.0.1\n  Port ${state.port}\n  User git-test\n  IdentityFile ${path.join(state.directory, identity)}\n  IdentitiesOnly yes\n  IdentityAgent none\n  UserKnownHostsFile ${knownHosts}\n  GlobalKnownHostsFile /dev/null\n`,
          );
          // Only routing and disposable identities are configured here. Prompt
          // suppression must come from the production helper, not the fixture.
          const shell = `bash -euo pipefail -c ${quote(`source "$1"; ${operation} origin`)} test ${quote(helper)}`;
          const started = performance.now();
          const result = spawnSync(
            tty ? "script" : "bash",
            tty ?
              ["--quiet", "--return", "--command", shell, "/dev/null"]
            : ["-c", shell],
            {
              cwd: path.join(state.directory, "checkout"),
              env: {
                ...environment,
                GIT_SSH_COMMAND: `ssh -F ${quote(configuration)}`,
              },
              encoding: "utf8",
              timeout: 22000,
              input: "",
            },
          );
          assert.ifError(result.error);
          const elapsed = performance.now() - started;
          assert.equal(
            result.status,
            scenario === "valid" ? 0
            : operation === "git_refresh_upstream" ? 2
            : 1,
            result.stderr || result.stdout,
          );
          assert.equal(
            fs.readFileSync(knownHosts, "utf8"),
            known,
            "known_hosts was modified",
          );
          assert.ok(
            elapsed < (scenario === "stalled" ? 20000 : 6000),
            `unexpected delay of ${elapsed}ms`,
          );
          if (scenario === "stalled")
            assert.ok(
              elapsed >= 14000,
              "fixture did not exercise the network timeout",
            );
          if (scenario === "valid" && operation === "git_remote_default_branch")
            assert.equal(
              result.stdout.replaceAll("\r\n", "\n").trim(),
              "trunk",
            );
          if (scenario === "valid" && operation === "git_refresh_upstream")
            command(
              "git",
              ["show-ref", "--verify", "refs/remotes/origin/trunk"],
              { cwd: path.join(state.directory, "checkout") },
            );
        },
      );
    }
  }
}
