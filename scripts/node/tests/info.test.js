/**
 * Verify summary execution, failure rendering and cleanup in isolated
 * repositories.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../../", import.meta.url));
const relative = "scripts/linux/commands/repository/info.sh";
const red = "\u001b[0;31m";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "info-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const script = path.join(root, relative);
  fs.mkdirSync(path.dirname(script), { recursive: true });
  fs.copyFileSync(path.join(source, relative), script);
  fs.cpSync(
    path.join(source, "scripts/linux/utils"),
    path.join(root, "scripts/linux/utils"),
    { recursive: true },
  );
  fs.symlinkSync(
    path.join(source, "scripts/node"),
    path.join(root, "scripts/node"),
    "dir",
  );
  const checks = path.join(path.dirname(script), "validation");
  const temporary = path.join(root, "temporary");
  fs.mkdirSync(checks);
  fs.mkdirSync(temporary);
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    COLOR_MODE: "always",
    NO_COLOR: "",
    TERM: "xterm",
    TMPDIR: temporary,
    NODE_DISABLE_COMPILE_CACHE: "1",
  };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_CONFIG_COUNT",
    "_REPOSITORY_GIT_REFRESH_STATUS",
    "_REPOSITORY_GIT_UPSTREAM_REMOTE",
    "_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS",
  ])
    delete env[name];
  const initialized = spawnSync("git", ["init", "--quiet"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
  assert.equal(initialized.status, 0, initialized.stderr);
  function check(name, body) {
    fs.writeFileSync(
      path.join(checks, name),
      `#!/usr/bin/env bash\nset -euo pipefail\n${body}\n`,
    );
  }
  function run() {
    const result = spawnSync("bash", [script], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 10000,
      killSignal: "SIGKILL",
    });
    assert.ifError(result.error);
    assert.deepEqual(fs.readdirSync(temporary), [], "captures must be cleaned");
    return result;
  }
  return { root, script, checks, temporary, env, check, run };
}

test("info starts checks in parallel and renders in filename order", (t) => {
  const f = fixture(t);
  f.check("b-second.sh", 'touch second-started; printf "second output\\n"');
  f.check(
    "a-first.sh",
    'for ((attempt=0; attempt<100; attempt++)); do [[ ! -f second-started ]] || break; sleep 0.01; done; [[ -f second-started ]]; printf "first output\\n"',
  );
  fs.writeFileSync(path.join(f.checks, "ignored.txt"), "not a check");
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(
    result.stdout.indexOf("first output")
      < result.stdout.indexOf("second output"),
  );
});

test("info retains stdout, stderr and authentic content colors on failure", (t) => {
  const f = fixture(t);
  f.check(
    "failure.sh",
    'printf "plain output\\n"; printf "\\033[32mauthentic green\\033[0m\\n"; printf "stderr diagnostic\\n" >&2; exit 7',
  );
  const result = f.run();
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes(red));
  assert.ok(result.stdout.includes("\u001b[32mauthentic green\u001b[0m"));
  assert.match(result.stdout, /plain output/u);
  assert.match(result.stdout, /stderr diagnostic/u);
  assert.doesNotMatch(result.stdout, /reported issues|reporting errors/u);
});

test("info reports failure even when a check prints nothing", (t) => {
  const f = fixture(t);
  f.check("silent.sh", "exit 3");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes(red));
  assert.match(result.stdout, /silent/u);
  assert.match(result.stdout, /exited with status 3 without output/u);
});

test("info closes stdin for every parallel check", (t) => {
  const f = fixture(t);
  f.check(
    "stdin.sh",
    'if read -r input; then exit 9; fi; printf "stdin closed\\n"',
  );
  const result = spawnSync("bash", [f.script], {
    cwd: f.root,
    env: f.env,
    input: "must not reach checks\n",
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stdin closed/u);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
});

test("info rejects successful checks without validation output", (t) => {
  const f = fixture(t);
  f.check("silent-success.sh", "exit 0");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes(red));
  assert.match(result.stdout, /completed without validation output/u);
});

test("info does not misidentify an explicit status 137 as a timeout", (t) => {
  const f = fixture(t);
  f.check("explicit-failure.sh", 'printf "explicit failure\\n"; exit 137');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes(red));
  assert.match(result.stdout, /explicit failure/u);
  assert.match(result.stdout, /killed or exited with status 137/u);
  assert.doesNotMatch(result.stdout, /exceeded its deadline/u);
});

test("info rejects an empty validation directory", (t) => {
  const result = fixture(t).run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no scripts found/u);
});

test("info preserves captured output if rendering fails", (t) => {
  const f = fixture(t);
  const box = path.join(f.root, "scripts/linux/utils/logging/box.sh");
  fs.appendFileSync(box, "\nprint_box() { return 7; }\n");
  f.check(
    "fallback.sh",
    'printf "fallback output\\n"; printf "fallback stderr\\n" >&2',
  );
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /fallback output/u);
  assert.match(result.stdout, /fallback stderr/u);
});

test("info kills a TERM-resistant check at its deadline and cleans captures", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    f.script,
    fs.readFileSync(f.script, "utf8").replace("2s 60s bash", "0.1s 0.1s bash"),
  );
  f.check("hung.sh", "trap '' TERM; exec sleep 20");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /killed or exited with status 137/u);
  assert.ok(result.stdout.includes(red));
});

test("info identifies the timeout command's deadline status", (t) => {
  const f = fixture(t);
  fs.writeFileSync(
    f.script,
    fs.readFileSync(f.script, "utf8").replace("2s 60s bash", "0.1s 0.1s bash"),
  );
  f.check("deadline.sh", "exec sleep 20");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes(red));
  assert.match(result.stdout, /exceeded its deadline/u);
});

test("info interruption terminates outstanding checks and removes captures", async (t) => {
  const f = fixture(t);
  f.check(
    "running.sh",
    'printf "%s\\n" "$$" > child.pid; trap "exit 0" TERM; while :; do sleep 0.05; done',
  );
  const child = spawn("bash", [f.script], {
    cwd: f.root,
    env: f.env,
    stdio: "ignore",
  });
  const exited = new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });
  const watchdog = globalThis.setTimeout(() => child.kill("SIGKILL"), 10000);
  t.after(() => globalThis.clearTimeout(watchdog));
  for (const attempt of Array.from({ length: 100 }, (_, index) => index)) {
    if (fs.existsSync(path.join(f.root, "child.pid"))) break;
    assert.ok(attempt < 99, "check did not start");
    await delay(20);
  }
  const pid = Number(fs.readFileSync(path.join(f.root, "child.pid"), "utf8"));
  child.kill("SIGTERM");
  assert.equal(await exited, 143);
  assert.deepEqual(fs.readdirSync(f.temporary), []);
  assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
});
