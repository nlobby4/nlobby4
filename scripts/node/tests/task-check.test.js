/** Verify the aggregate quality command without running real tools or audits. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../../", import.meta.url));
const tasks = ["format:check", "lint", "test", "deps:unused", "audit"];

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "task-check-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, "scripts/linux/commands/tasks/check.sh");
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.copyFileSync(
    path.join(source, "scripts/linux/commands/tasks/check.sh"),
    script,
  );
  fs.cpSync(
    path.join(source, "scripts/linux/utils"),
    path.join(root, "scripts/linux/utils"),
    { recursive: true },
  );
  fs.writeFileSync(path.join(root, "package.json"), "{}\n");
  const initialized = spawnSync("git", ["init", "--quiet", root], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, "pnpm"),
    `#!/usr/bin/env bash
set -euo pipefail
[[ $MISE_AUTO_INSTALL == false && $MISE_NOT_FOUND_AUTO_INSTALL == false ]] || exit 99
[[ $# == 2 && $1 == run ]] || exit 98
printf '%s\\n' "$2" >> "$TASK_CALL_LOG"
if [[ $2 == \${TASK_FAIL:-} ]]; then
  printf 'fixture diagnostic for %s\\n' "$2" >&2
  exit "\${TASK_FAIL_STATUS:-7}"
fi
`,
    { mode: 0o755 },
  );
  const log = path.join(root, "calls.log");
  return {
    root,
    script,
    log,
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      COLOR_MODE: "never",
      MISE_AUTO_INSTALL: "true",
      MISE_NOT_FOUND_AUTO_INSTALL: "true",
      TASK_CALL_LOG: log,
      TASK_FAIL: "",
    },
  };
}

function run(f, args = [], options = {}) {
  const result = spawnSync("bash", [f.script, ...args], {
    cwd: f.root,
    env: f.env,
    encoding: "utf8",
    timeout: 10000,
    ...options,
  });
  assert.ifError(result.error);
  const calls =
    fs.existsSync(f.log) ?
      fs.readFileSync(f.log, "utf8").trim().split("\n")
    : [];
  return { result, calls };
}

test("quality checks run once, in order, without tool arguments or implicit installs", (t) => {
  const f = fixture(t);
  const { result, calls } = run(f);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls, tasks);
  assert.match(result.stdout, /All repository quality checks passed/u);
});

for (const [index, task] of tasks.entries()) {
  test(`failure in ${task} stops later gates and preserves the exact exit status`, (t) => {
    const f = fixture(t);
    const { result, calls } = run(f, [], {
      env: { ...f.env, TASK_FAIL: task, TASK_FAIL_STATUS: "23" },
    });
    assert.equal(result.status, 23);
    assert.deepEqual(calls, tasks.slice(0, index + 1));
    assert.match(result.stderr, new RegExp(`fixture diagnostic for ${task}`));
    assert.match(result.stderr, /failed \(exit status 23\)/u);
    assert.doesNotMatch(result.stdout, /All repository quality checks passed/u);
  });
}

for (const args of [["--fix"], ["--"], ["lint"], ["--help", "extra"]]) {
  test(`unsupported arguments ${JSON.stringify(args)} run no checks`, (t) => {
    const f = fixture(t);
    const { result, calls } = run(f, args);
    assert.equal(result.status, 2);
    assert.deepEqual(calls, []);
    assert.match(result.stderr, /does not accept arguments/u);
  });
}

test("help works outside a Git worktree without running checks", (t) => {
  const f = fixture(t);
  for (const flag of ["-h", "--help"]) {
    const { result, calls } = run(f, [flag], { cwd: os.tmpdir() });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(calls, []);
    assert.match(
      result.stdout,
      /Usage:\nbash scripts\/linux\/commands\/tasks\/check.sh/u,
    );
  }
});

test("subdirectories, non-repositories and unrelated Git roots run no checks", (t) => {
  const f = fixture(t);
  const unrelated = path.join(f.root, "other-repository");
  fs.mkdirSync(unrelated);
  const initialized = spawnSync("git", ["init", "--quiet", unrelated], {
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  for (const cwd of [path.dirname(f.script), os.tmpdir(), unrelated]) {
    const { result, calls } = run(f, [], { cwd });
    assert.equal(result.status, 1);
    assert.deepEqual(calls, []);
    assert.match(
      result.stderr,
      /repository root|git worktree|repository containing/u,
    );
  }
});

test("a missing pnpm command produces an understandable error before any checks", (t) => {
  const f = fixture(t);
  const result = spawnSync(
    "bash",
    [
      "-c",
      'command(){ if [[ $1 == -v && ${*: -1} == pnpm ]]; then return 1; fi; builtin command "$@"; }; export -f command; exec bash "$1"',
      "test",
      f.script,
    ],
    { cwd: f.root, env: f.env, encoding: "utf8", timeout: 10000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /pnpm is required but is not available/u);
  assert.equal(fs.existsSync(f.log), false);
});
