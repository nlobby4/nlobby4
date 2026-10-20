/** Verify readiness commands in disposable repositories with controlled tools. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../../", import.meta.url));
const commands = "scripts/linux/commands/repository/validation";
const names = ["docker", "git", "mise", "node", "workspace"];
const red = "\u001b[0;31m";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readiness-status-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(
    path.join(source, "scripts/linux/utils"),
    path.join(root, "scripts/linux/utils"),
    { recursive: true },
  );
  fs.cpSync(path.join(source, commands), path.join(root, commands), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(source, "scripts/linux/commands/repository/info.sh"),
    path.join(root, "scripts/linux/commands/repository/info.sh"),
  );
  fs.symlinkSync(
    path.join(source, "scripts/node"),
    path.join(root, "scripts/node"),
    "dir",
  );
  fs.mkdirSync(path.join(root, ".devcontainer"));
  fs.copyFileSync(
    path.join(source, ".devcontainer/devcontainer.json"),
    path.join(root, ".devcontainer/devcontainer.json"),
  );
  fs.copyFileSync(
    path.join(source, ".devcontainer/versions.env"),
    path.join(root, ".devcontainer/versions.env"),
  );
  for (const name of [
    "package.json",
    "mise.lock",
    ".gitmessage",
    ".git-blame-ignore-revs",
  ])
    fs.writeFileSync(path.join(root, name), "{}\n");
  fs.copyFileSync(
    path.join(source, ".gitattributes"),
    path.join(root, ".gitattributes"),
  );
  fs.copyFileSync(path.join(source, "mise.toml"), path.join(root, "mise.toml"));
  fs.mkdirSync(path.join(root, "scripts/python"), { recursive: true });
  fs.copyFileSync(
    path.join(source, "scripts/python/mise-tool-commands.py"),
    path.join(root, "scripts/python/mise-tool-commands.py"),
  );
  for (const cache of ["knip", "prettier", "commitizen", "python", "trivy"])
    fs.mkdirSync(path.join(root, ".cache", cache), { recursive: true });
  fs.mkdirSync(path.join(root, ".husky/_"), { recursive: true });
  for (const hook of [".husky/pre-commit", ".husky/_/pre-commit", ".husky/_/h"])
    fs.writeFileSync(path.join(root, hook), "#!/bin/sh\nexit 0\n", {
      mode: 0o755,
    });
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  function executable(name, body) {
    fs.writeFileSync(
      path.join(bin, name),
      `#!/usr/bin/env bash\nset -euo pipefail\n[[ \${MISE_AUTO_INSTALL:-} == false && \${MISE_NOT_FOUND_AUTO_INSTALL:-} == false ]] || exit 99\n${body}\n`,
      { mode: 0o755 },
    );
  }
  executable(
    "node",
    `[[ \${1:-} != -- ]] || shift\nif [[ \${1##*/} == node-status.js ]]; then if [[ \${FIXTURE_NODE_HANG:-0} == 1 ]]; then trap '' TERM; exec sleep 20; fi; printf '%s\\n' "$FIXTURE_NODE_JSON"; exit "\${FIXTURE_NODE_EXIT:-0}"; fi\nexec ${JSON.stringify(process.execPath)} "$@"`,
  );
  executable(
    "python3",
    `case "\${1##*/}" in\n -c) [[ \${FIXTURE_OS_EXIT:-0} == 0 ]] || exit "$FIXTURE_OS_EXIT"; exec /usr/bin/python3 "$@" ;;\n git-signing-check.py) exit "\${FIXTURE_SIGNING_EXIT:-0}" ;;\n devcontainer-workload.py) exit "\${FIXTURE_WORKLOAD_EXIT:-0}" ;;\n mise-tool-commands.py) if [[ -v FIXTURE_COMMANDS_OUTPUT ]]; then printf '%s\\n' "$FIXTURE_COMMANDS_OUTPUT"; else exec /usr/bin/python3 "$@"; fi ;;\n devcontainer-capacity.py) if [[ \${FIXTURE_CAPACITY_HANG:-0} == 1 ]]; then trap '' TERM; exec sleep 20; fi; printf '%s\\n' "$FIXTURE_CAPACITY_JSON"; exit "\${FIXTURE_CAPACITY_EXIT:-0}" ;;\n devcontainer-state.py) [[ \${FIXTURE_GRAPH_EXIT:-0} == 0 ]] || exit "$FIXTURE_GRAPH_EXIT"; printf '%s\\n' "\${FIXTURE_CONTRACT_OUTPUT:-verified}" ;;\n *) exit 98 ;;\nesac`,
  );
  const toolVersions = fs
    .readFileSync(path.join(source, "mise.toml"), "utf8")
    .match(/\d+(?:\.\d+)+/gu)
    .join(" ");
  executable(
    "tool",
    `printf '%s\\n' "\${FIXTURE_TOOL_VERSION:-${toolVersions}}"; exit "\${FIXTURE_TOOL_EXIT:-0}"`,
  );
  executable(
    "git-lfs",
    '[[ ${FIXTURE_LFS_EXIT:-0} == 0 ]] || exit "$FIXTURE_LFS_EXIT"; printf "git-lfs/3.3.0\\n"',
  );
  executable(
    "mise",
    `case "$1" in\n --version) printf '%s linux-x64 (fixture)\\n' "\${FIXTURE_MISE_VERSION:-2026.9.18}" ;;\n config) if [[ \${2:-} == get ]]; then printf '%s\\n' "\${FIXTURE_MINIMUM_VERSION:-2026.9.18}"; else printf '[{"path":"%s/mise.toml"}]\\n' "$PWD"; fi ;;\n trust) printf '%s: %s\\n' "$PWD" "\${FIXTURE_TRUST:-trusted}" ;;\n ls) printf '%s\\n' "\${FIXTURE_MISSING_JSON:-'{}'}" ;;\n which) if [[ \${FIXTURE_WHICH_HANG:-0} == 1 ]]; then exec sleep 20; fi; printf '%s/bin/tool\\n' "$PWD" ;;\n lock) printf '%s\\n' "$FIXTURE_LOCK_JSON" ;;\n *) exit 98 ;;\nesac`,
  );
  executable(
    "docker",
    `case "$1 $2" in\n 'version --format') printf '%s|%s|%s|%s\\n' "$FIXTURE_DOCKER_VERSION" "$FIXTURE_DOCKER_VERSION" "\${FIXTURE_SERVER_OS:-linux}" "\${FIXTURE_SERVER_ARCH:-amd64}"; exit "\${FIXTURE_DOCKER_EXIT:-0}" ;;\n 'context show') printf '%s\\n' "\${FIXTURE_CONTEXT:-default}"; exit "\${FIXTURE_CONTEXT_EXIT:-0}" ;;\n 'context inspect') printf '%s\\n' "\${FIXTURE_ENDPOINT:-unix:///var/run/docker.sock}"; exit "\${FIXTURE_ENDPOINT_EXIT:-0}" ;;\n 'buildx version') printf 'github.com/docker/buildx v%s fixture\\n' "$FIXTURE_BUILDX_VERSION"; exit "\${FIXTURE_BUILDX_EXIT:-0}" ;;\n 'buildx ls') printf '%s\\n' "$FIXTURE_BUILDER_JSON" ;;\n 'compose version') printf '%s\\n' "$FIXTURE_COMPOSE_VERSION"; exit "\${FIXTURE_COMPOSE_EXIT:-0}" ;;\n *) exit 98 ;;\nesac`,
  );
  // Only process-namespace detection is replaced; all CLI and filter logic is real.
  const dockerScript = path.join(root, commands, "docker-status.sh");
  const dockerCode = fs.readFileSync(dockerScript, "utf8");
  assert.match(dockerCode, /_has_local_docker_daemon\(\) \{[^]*?\n\}/u);
  fs.writeFileSync(
    dockerScript,
    dockerCode.replace(
      /_has_local_docker_daemon\(\) \{[^]*?\n\}/u,
      '_has_local_docker_daemon() { return "${FIXTURE_DAEMON_EXIT:-0}"; }',
    ),
  );
  // Model an image-provided mise without depending on the test host's installation.
  const miseScript = path.join(root, commands, "mise-status.sh");
  fs.writeFileSync(
    miseScript,
    fs
      .readFileSync(miseScript, "utf8")
      .replaceAll("/usr/local/bin/mise", path.join(bin, "mise")),
  );
  const config = JSON.parse(
    fs.readFileSync(path.join(root, ".devcontainer/devcontainer.json"), "utf8"),
  );
  const feature = Object.entries(config.features).find(([key]) =>
    key.startsWith("ghcr.io/devcontainers/features/docker-in-docker:"),
  )[1];
  const env = {
    ...process.env,
    PATH: `${bin}:${path.dirname(process.execPath)}:${process.env.PATH}`,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    COLOR_MODE: "always",
    NO_COLOR: "",
    TERM: "xterm",
    DEVCONTAINER: "true",
    MISE_AUTO_INSTALL: "true",
    MISE_NOT_FOUND_AUTO_INSTALL: "true",
    CDPATH: root,
    FIXTURE_NODE_JSON: JSON.stringify([
      { label: "Node.js dependencies", value: "installed", ok: true },
    ]),
    FIXTURE_CAPACITY_JSON: JSON.stringify([
      { label: "Storage capacity", value: "sufficient", ok: true },
    ]),
    FIXTURE_LOCK_JSON: "[]",
    FIXTURE_MISSING_JSON: "{}",
    FIXTURE_DOCKER_VERSION: feature.version,
    FIXTURE_SERVER_ARCH: process.arch === "arm64" ? "arm64" : "amd64",
    FIXTURE_BUILDX_VERSION: feature.mobyBuildxVersion,
    FIXTURE_COMPOSE_VERSION: feature.dockerDashComposeVersion,
    FIXTURE_BUILDER_JSON: JSON.stringify({
      Name: "default",
      Current: true,
      Nodes: [{ Status: "running" }],
    }),
  };
  for (const key of [
    "GIT_AUTHOR_NAME",
    "GIT_AUTHOR_EMAIL",
    "GIT_COMMITTER_NAME",
    "GIT_COMMITTER_EMAIL",
    "GIT_CONFIG_COUNT",
    "GIT_DIR",
    "GIT_WORK_TREE",
    "DOCKER_HOST",
    "DOCKER_CONTEXT",
    "TMPDIR",
    "NPM_CONFIG_STORE_DIR",
    "HUSKY",
    "CODESPACES",
    "REMOTE_CONTAINERS",
    "_REPOSITORY_GIT_REFRESH_STATUS",
    "_REPOSITORY_GIT_UPSTREAM_REMOTE",
    "_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS",
  ])
    delete env[key];
  function git(...args) {
    const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  git("init", "--quiet");
  for (const [key, value] of Object.entries({
    "user.name": "Fixture",
    "user.email": "fixture@example.invalid",
    "blame.ignoreRevsFile": ".git-blame-ignore-revs",
    "commit.template": ".gitmessage",
    "core.autocrlf": "false",
    "rerere.enabled": "true",
    "rerere.autoupdate": "false",
    "core.hooksPath": ".husky/_",
    "filter.lfs.clean": "git-lfs clean -- %f",
    "filter.lfs.smudge": "git-lfs smudge -- %f",
    "filter.lfs.process": "git-lfs filter-process",
    "filter.lfs.required": "true",
  }))
    git("config", "--local", key, value);
  return { root, env, git };
}

function run(f, name, env = {}) {
  const script =
    name === "info" ?
      "scripts/linux/commands/repository/info.sh"
    : `${commands}/${name}-status.sh`;
  const result = spawnSync("bash", [script], {
    cwd: f.root,
    env: { ...f.env, ...env },
    encoding: "utf8",
    timeout: 15000,
  });
  assert.ifError(result.error);
  return result;
}

test("node readiness bounds the complete helper even when it ignores TERM", (t) => {
  const f = fixture(t);
  const script = path.join(f.root, commands, "node-status.sh");
  fs.writeFileSync(
    script,
    fs
      .readFileSync(script, "utf8")
      .replace("NODE_STATUS_TIMEOUT=35s", "NODE_STATUS_TIMEOUT=0.1s"),
  );
  const started = Date.now();
  const result = run(f, "node", { FIXTURE_NODE_HANG: "1" });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /inspection timed out/u);
  assert.ok(result.stdout.includes(red), result.stdout);
  assert.ok(Date.now() - started < 5000);
});

for (const name of names)
  test(`${name} readiness succeeds with complete setup and no auto-install`, (t) => {
    const result = run(fixture(t), name);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(result.stdout.includes(red), false, result.stdout);
  });

for (const [name, env, row] of [
  ["docker", { FIXTURE_BUILDX_EXIT: "7" }, "Docker Buildx"],
  ["docker", { FIXTURE_COMPOSE_EXIT: "7" }, "Docker Compose"],
  ["docker", { FIXTURE_CONTEXT_EXIT: "7" }, "Docker context"],
  ["docker", { FIXTURE_ENDPOINT_EXIT: "7" }, "Docker endpoint"],
  ["docker", { FIXTURE_DOCKER_EXIT: "7" }, "Docker daemon"],
  ["docker", { FIXTURE_DAEMON_EXIT: "1" }, "Local dockerd process"],
  [
    "docker",
    { FIXTURE_ENDPOINT: "tcp://remote.invalid:2375" },
    "Docker endpoint",
  ],
  ["docker", { FIXTURE_BUILDER_JSON: "{}" }, "Docker builder"],
  ["docker", { FIXTURE_DOCKER_VERSION: "0.0.0" }, "Docker client"],
  ["docker", { FIXTURE_WORKLOAD_EXIT: "7" }, "Docker workloads"],
  ["docker", { FIXTURE_SERVER_OS: "windows" }, "Docker daemon"],
  ["docker", { FIXTURE_SERVER_ARCH: "unsupported" }, "Docker daemon"],
  ["docker", { FIXTURE_CONTEXT: "default\nextra" }, "Docker context"],
  ["docker", { FIXTURE_COMPOSE_VERSION: "2.40.3\nextra" }, "Docker Compose"],
  [
    "docker",
    { FIXTURE_ENDPOINT: "unix:///var/run/docker.sock\nextra" },
    "Docker endpoint",
  ],
  [
    "docker",
    {
      FIXTURE_BUILDER_JSON:
        '{"Name":"bad\\nname","Current":true,"Nodes":[{"Status":"running"}]}',
    },
    "Docker builder",
  ],
  ["git", { FIXTURE_LFS_EXIT: "1" }, "Git LFS"],
  ["git", { GIT_AUTHOR_NAME: "" }, "Git commit identity"],
  ["node", { FIXTURE_NODE_EXIT: "7" }, "Node.js dependencies"],
  ["node", { FIXTURE_NODE_JSON: "[]" }, "Node.js dependencies"],
  [
    "node",
    {
      FIXTURE_NODE_JSON:
        '[{"label":"Node.js dependencies","value":"missing","ok":false}]',
    },
    "Node.js dependencies",
  ],
  [
    "workspace",
    { TMPDIR: "/missing-readiness-directory" },
    "Temporary directory",
  ],
  ["workspace", { FIXTURE_CAPACITY_EXIT: "1" }, "Storage capacity"],
  ["workspace", { FIXTURE_OS_EXIT: "1" }, "Workspace operating system"],
  ["workspace", { FIXTURE_CAPACITY_JSON: "null" }, "Storage capacity"],
  [
    "workspace",
    {
      FIXTURE_CAPACITY_JSON:
        '[{"label":"Storage capacity","value":"insufficient","ok":false}]',
    },
    "Storage capacity",
  ],
  ["mise", { FIXTURE_MISE_VERSION: "2026.1.0" }, "mise version"],
  ["mise", { FIXTURE_TRUST: "untrusted" }, "mise trust"],
  ["mise", { FIXTURE_MISSING_JSON: '{"node":[]}' }, "mise tools"],
  ["mise", { FIXTURE_TOOL_EXIT: "1" }, "mise executables"],
  ["mise", { FIXTURE_TOOL_VERSION: "0.0.0" }, "mise executables"],
  ["mise", { FIXTURE_COMMANDS_OUTPUT: "invalid" }, "mise executables"],
  ["mise", { FIXTURE_GRAPH_EXIT: "1" }, "mise dependency graphs"],
  ["mise", { FIXTURE_LOCK_JSON: "[{}]" }, "mise lock"],
])
  test(`${name}: ${row} failure is red and exits nonzero (${JSON.stringify(env)})`, (t) => {
    const result = run(fixture(t), name, env);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    const line = result.stdout
      .split("\n")
      .find((line) => line.startsWith(`${row} `) || line.startsWith(`${row}:`));
    assert.ok(line, result.stdout);
    assert.ok(line.includes(red), line);
  });

test("Git LFS effective overrides are readiness failures", (t) => {
  const f = fixture(t);
  f.git("config", "filter.lfs.process", "incorrect");
  const result = run(f, "git");
  assert.equal(result.status, 1, result.stderr);
  assert.ok(
    result.stdout
      .split("\n")
      .some((line) => line.startsWith("Git LFS filters") && line.includes(red)),
    result.stdout,
  );
});

for (const [key, row] of [
  ["core.hooksPath", "Git hooks"],
  ["commit.template", "Git commit template"],
  ["blame.ignoreRevsFile", "Git blame ignore file"],
])
  test(`Git rejects effective overrides of ${key}`, (t) => {
    const result = run(fixture(t), "git", {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: key,
      GIT_CONFIG_VALUE_0: "other-path",
    });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(
      result.stdout
        .split("\n")
        .some((line) => line.startsWith(row) && line.includes(red)),
      result.stdout,
    );
  });

for (const [key, value] of [
  ["rerere.enabled", "false"],
  ["rerere.autoupdate", "true"],
]) {
  test(`Git rejects an unsafe effective override of ${key}`, (t) => {
    const result = run(fixture(t), "git", {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: key,
      GIT_CONFIG_VALUE_0: value,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(
      result.stdout
        .split("\n")
        .some(
          (line) =>
            line.startsWith("Git conflict resolution") && line.includes(red),
        ),
      result.stdout,
    );
  });
  test(`Git reports missing ${key}`, (t) => {
    const f = fixture(t);
    f.git("config", "--local", "--unset", key);
    const result = run(f, "git");
    assert.equal(result.status, 1, result.stderr);
    assert.ok(
      result.stdout
        .split("\n")
        .some(
          (line) =>
            line.startsWith("Git conflict resolution") && line.includes(red),
        ),
      result.stdout,
    );
  });
}

test("Git accepts normalized rerere booleans", (t) => {
  const f = fixture(t);
  f.git("config", "--local", "rerere.enabled", "yes");
  f.git("config", "--local", "rerere.autoupdate", "off");
  const result = run(f, "git");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /reuse enabled, manual staging/);
});

for (const value of ["true", "input"]) {
  test(`Git readiness rejects auto-CRLF ${value} overrides`, (t) => {
    const result = run(fixture(t), "git", {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.autocrlf",
      GIT_CONFIG_VALUE_0: value,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(
      result.stdout
        .split("\n")
        .some(
          (line) => line.startsWith("Git line endings") && line.includes(red),
        ),
      result.stdout,
    );
  });
}

test("Git readiness requires a local auto-CRLF setting and readable attributes", (t) => {
  const f = fixture(t);
  f.git("config", "--local", "--unset", "core.autocrlf");
  assert.equal(run(f, "git").status, 1);
  f.git("config", "--local", "core.autocrlf", "off");
  assert.equal(run(f, "git").status, 0);
  fs.unlinkSync(path.join(f.root, ".gitattributes"));
  const result = run(f, "git");
  assert.equal(result.status, 1);
  assert.ok(
    result.stdout
      .split("\n")
      .some(
        (line) => line.startsWith("Git line endings") && line.includes(red),
      ),
    result.stdout,
  );
});

test("missing setup caches are reported without creation", (t) => {
  const f = fixture(t);
  const cache = path.join(f.root, ".cache/commitizen");
  fs.rmdirSync(cache);
  const result = run(f, "workspace");
  assert.equal(result.status, 1, result.stderr);
  assert.ok(
    result.stdout
      .split("\n")
      .some(
        (line) => line.startsWith("Repository caches") && line.includes(red),
      ),
    result.stdout,
  );
  assert.equal(fs.existsSync(cache), false);
});

test("info contains failing values and all five checks without generic failure reports", (t) => {
  const result = run(fixture(t), "info", { FIXTURE_COMPOSE_EXIT: "7" });
  assert.equal(result.status, 1, result.stderr);
  for (const name of names)
    assert.match(result.stdout, new RegExp(`${name} status`, "u"));
  assert.ok(
    result.stdout
      .split("\n")
      .some((line) => line.includes("Docker Compose") && line.includes(red)),
    result.stdout,
  );
  assert.doesNotMatch(result.stdout, /reported issues|reporting errors/u);
});

test("mise command selection follows newly declared tools", (t) => {
  const f = fixture(t);
  const config = path.join(f.root, "mise.toml");
  fs.writeFileSync(
    config,
    fs
      .readFileSync(config, "utf8")
      .replace("[tools]", '[tools]\nnewtool = "1.2.3"'),
  );
  const result = run(f, "mise");
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /newtool/u);
});

test("mise shares a command budget instead of timing out every tool separately", (t) => {
  const f = fixture(t);
  const script = path.join(f.root, commands, "mise-status.sh");
  fs.writeFileSync(
    script,
    fs.readFileSync(script, "utf8").replace("SECONDS + 40", "SECONDS + 1"),
  );
  const started = Date.now();
  const result = run(f, "mise", { FIXTURE_WHICH_HANG: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /mise executables/u);
  assert.match(result.stdout, /mise lock/u);
  assert.ok(Date.now() - started < 5000);
});

for (const [version, expected] of [
  ["2026.9.17", 1],
  ["2026.9.18", 0],
  ["2026.10.1", 0],
  ["999999999999999999.1", 1],
]) {
  test(`host mise minimum-version policy for ${version}`, (t) => {
    const f = fixture(t);
    const script = path.join(f.root, commands, "mise-status.sh");
    fs.writeFileSync(
      script,
      fs
        .readFileSync(script, "utf8")
        .replace(
          'mise_environment="$(execution_environment)"',
          "mise_environment='Local shell'",
        )
        .replace(
          `if [[ -x ${path.join(f.root, "bin/mise")} ]]; then`,
          "if false; then",
        ),
    );
    const result = run(f, "mise", { FIXTURE_MISE_VERSION: version });
    assert.equal(result.status, expected, result.stdout + result.stderr);
    assert.match(result.stdout, /host user/u);
  });
}

test("mise prefers the image binary even when a different mise is first on PATH", (t) => {
  const f = fixture(t);
  const shadow = path.join(f.root, "shadow");
  fs.mkdirSync(shadow);
  fs.writeFileSync(path.join(shadow, "mise"), "#!/bin/sh\nexit 99\n", {
    mode: 0o755,
  });
  const result = run(f, "mise", { PATH: `${shadow}:${f.env.PATH}` });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /devcontainer system/u);
});

test("host mise reports a malformed minimum without dropping remaining checks", (t) => {
  const f = fixture(t);
  const script = path.join(f.root, commands, "mise-status.sh");
  fs.writeFileSync(
    script,
    fs
      .readFileSync(script, "utf8")
      .replace(
        'mise_environment="$(execution_environment)"',
        "mise_environment='Local shell'",
      ),
  );
  const result = run(f, "mise", {
    FIXTURE_MINIMUM_VERSION: "2026.9.18\nextra",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /minimum unavailable/u);
  assert.match(result.stdout, /mise dependency graphs/u);
});

test("Git ignores documentation in the Husky directory", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, ".husky/README.md"), "Documentation\n");
  const result = run(f, "git");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /1 repository hook active/u);
});

test("enabled Git signing failure is a red readiness failure", (t) => {
  const f = fixture(t);
  f.git("config", "commit.gpgsign", "true");
  const result = run(f, "git", { FIXTURE_SIGNING_EXIT: "1" });
  assert.equal(result.status, 1);
  const row = result.stdout
    .split("\n")
    .find((line) => line.startsWith("Git commit signing"));
  assert.ok(row.includes(red));
  assert.match(row, /unable to sign and verify/u);
});

test("enabled Git signing success reports actual verification", (t) => {
  const f = fixture(t);
  f.git("config", "commit.gpgsign", "true");
  const result = run(f, "git");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /temporary commit signed and verified/u);
});

for (const hook of ["h", "pre-commit"]) {
  test(`Git rejects a directory in place of Husky ${hook}`, (t) => {
    const f = fixture(t);
    const file = path.join(f.root, ".husky/_", hook);
    fs.rmSync(file);
    fs.mkdirSync(file);
    const result = run(f, "git");
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Git hooks/u);
  });
}

test("Git reports multiline identity without losing subsequent status rows", (t) => {
  const f = fixture(t);
  f.git("config", "user.name", "bad\nname");
  const result = run(f, "git");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unset or invalid/u);
  assert.match(result.stdout, /Git hooks/u);
});

test("workspace capacity inspection is bounded when run standalone", (t) => {
  const f = fixture(t);
  const script = path.join(f.root, commands, "workspace-status.sh");
  fs.writeFileSync(
    script,
    fs
      .readFileSync(script, "utf8")
      .replace("--kill-after=1s 10s", "--kill-after=0.1s 0.1s"),
  );
  const result = run(f, "workspace", { FIXTURE_CAPACITY_HANG: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Storage capacity.*unable to inspect/u);
  assert.match(result.stdout, /Workspace architecture/u);
});
