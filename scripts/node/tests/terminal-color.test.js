/**
 * Verify stream-aware color policy and captured readiness reports.
 *
 * @file Terminal color regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const ansi = "\u001B[";
const environment = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  TERM: "xterm",
  COLOR_MODE: "auto",
  NO_COLOR: "",
  CI: "",
  GITHUB_ACTIONS: "",
  ASCII_ONLY: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
};

function execute(code, { env = {}, tty = false, cwd = root } = {}) {
  const result = spawnSync(
    tty ? "script" : "bash",
    tty ?
      ["-qec", `bash -c '${code.replaceAll("'", "'\\''")}'`, "/dev/null"]
    : ["-euo", "pipefail", "-c", code],
    {
      cwd,
      encoding: "utf8",
      env: { ...environment, ...env },
      timeout: 15000,
    },
  );
  assert.ifError(result.error);
  return { ...result, stdout: result.stdout.replaceAll("\r\n", "\n") };
}

for (const [name, env, tty, descriptor, expected] of [
  ["auto pipe", {}, false, "1", 1],
  ["auto terminal", {}, true, "1", 0],
  ["never terminal", { COLOR_MODE: "never" }, true, "1", 1],
  ["always pipe", { COLOR_MODE: "always" }, false, "1", 0],
  ["unknown mode", { COLOR_MODE: "invalid" }, true, "1", 1],
  [
    "NO_COLOR beats always",
    { COLOR_MODE: "always", NO_COLOR: "1" },
    false,
    "1",
    1,
  ],
  ["dumb beats always", { COLOR_MODE: "always", TERM: "dumb" }, false, "1", 1],
  ["monochrome terminal", { TERM: "vt100" }, true, "1", 1],
  ["unknown terminal", { TERM: "nonexistent-terminal-type" }, true, "1", 1],
  ["CI auto", { CI: "true" }, true, "1", 1],
  ["GitHub auto", { CI: "true", GITHUB_ACTIONS: "true" }, false, "1", 0],
  [
    "GitHub never",
    { COLOR_MODE: "never", GITHUB_ACTIONS: "true" },
    false,
    "1",
    1,
  ],
  ["invalid descriptor", { COLOR_MODE: "always" }, false, "bad", 1],
  ["closed descriptor", { COLOR_MODE: "always" }, false, "9999", 1],
]) {
  test(`supports_color: ${name}`, () => {
    const result = execute(
      `source scripts/linux/utils/logging/core.sh; supports_color '${descriptor}'`,
      { env, tty },
    );
    assert.equal(result.status, expected, result.stderr);
    assert.equal(result.stdout, "");
  });
}

test("terminal width ignores exported and readonly dimensions", () => {
  const result = execute(
    "source scripts/linux/utils/logging/terminal.sh; stty cols 93; export COLUMNS=120 LINES=100; readonly COLUMNS LINES; [[ $(terminal_width) == 93 ]]",
    { tty: true },
  );
  assert.equal(result.status, 0, result.stderr);
});

test("logging follows mode changes after sourcing", () => {
  const result = execute(
    "source scripts/linux/utils/logging/log.sh; COLOR_MODE=always log_info first; COLOR_MODE=never log_info second",
  );
  assert.equal(result.status, 0, result.stderr);
  const [first, second] = result.stdout.trimEnd().split("\n");
  assert.ok(first.includes(ansi));
  assert.ok(!second.includes(ansi));
});

test("logging follows per-call stdout and stderr redirection", () => {
  const result = execute(
    "source scripts/linux/utils/logging/log.sh; log_info visible; capture=$(log_info captured); [[ $capture != *$'\\033['* ]] || exit 1; error=$(log_error captured-error 2>&1); [[ $error != *$'\\033['* ]] || exit 1",
    { tty: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(ansi));
});

test("status coloring is resolved when printed, without mutating entries", () => {
  const result = execute(
    'source scripts/linux/utils/logging/logging.sh; COLOR_MODE=never status_add State bad "$COLOR_RED"; COLOR_MODE=always status_print; COLOR_MODE=never status_print',
  );
  assert.equal(result.status, 0, result.stderr);
  const [colored, plain] = result.stdout.trimEnd().split("\n");
  assert.ok(colored.includes(ansi));
  assert.equal(plain, "State: bad");
});

test("status fallback retains output-time color policy", () => {
  const result = execute(
    'source scripts/linux/utils/logging/logging.sh; node(){ return 1; }; status_add State bad "$COLOR_RED"; COLOR_MODE=always status_print',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(ansi));
});

function reportFixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "info-color-"));
  try {
    for (const name of [
      "scripts/linux/utils",
      "scripts/linux/commands/repository/info.sh",
      "scripts/node/bin/terminal-text.js",
      "scripts/node/lib/terminal-lines.js",
    ]) {
      const target = path.join(directory, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(path.join(root, name), target, { recursive: true });
    }
    fs.writeFileSync(
      path.join(directory, "package.json"),
      '{"type":"module"}\n',
    );
    fs.symlinkSync(
      path.join(root, "scripts/node/node_modules"),
      path.join(directory, "scripts/node/node_modules"),
      "dir",
    );
    const initialized = execute("git init -q", { cwd: directory });
    assert.equal(initialized.status, 0, initialized.stderr);
    const checks = path.join(
      directory,
      "scripts/linux/commands/repository/validation",
    );
    fs.mkdirSync(checks);
    const setup =
      'set -euo pipefail\nsource "$(dirname "$0")/../../../utils/logging/logging.sh"\n';
    fs.writeFileSync(
      path.join(checks, "a-pass.sh"),
      `${setup}status_add Passed yes\nstatus_add "Child mode" "$COLOR_MODE"\nstatus_print\n`,
    );
    fs.writeFileSync(
      path.join(checks, "b-fail.sh"),
      `${setup}status_add Failed bad "$COLOR_RED"\nstatus_print\nlog_error authentic-diagnostic\nexit 1\n`,
    );
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

for (const [name, env, tty, color] of [
  ["ordinary pipe", {}, false, false],
  ["terminal", {}, true, true],
  ["explicit always pipe", { COLOR_MODE: "always" }, false, true],
  ["explicit never terminal", { COLOR_MODE: "never" }, true, false],
  ["NO_COLOR", { COLOR_MODE: "always", NO_COLOR: "1" }, true, false],
  ["CI", { CI: "true" }, true, false],
  ["GitHub logs", { CI: "true", GITHUB_ACTIONS: "true" }, false, true],
  ["unknown terminal", { TERM: "nonexistent-terminal-type" }, true, false],
]) {
  test(`info capture: ${name}`, () => {
    reportFixture((cwd) => {
      const result = execute("bash scripts/linux/commands/repository/info.sh", {
        cwd,
        env,
        tty,
      });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /Passed\s*: yes/u);
      assert.match(result.stdout, /Child mode\s*: (always|never)/u);
      assert.match(result.stdout, /authentic-diagnostic/u);
      assert.ok(
        result.stdout.indexOf("a pass") < result.stdout.indexOf("b fail"),
      );
      if (color) {
        assert.ok(result.stdout.includes(ansi));
        assert.ok(result.stdout.includes("\u001B[0;31mbad\u001B[0m"));
        assert.ok(result.stdout.includes("\u001B[0;31m[ERROR]:\u001B[0m"));
      } else {
        assert.ok(!result.stdout.includes(ansi));
      }
    });
  });
}

test("info stdout redirection wins over a terminal stderr", () => {
  reportFixture((cwd) => {
    const result = execute(
      "bash scripts/linux/commands/repository/info.sh > report.txt; status=$?; cat report.txt; exit $status",
      { cwd, tty: true },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /authentic-diagnostic/u);
    assert.ok(!result.stdout.includes(ansi));
    assert.match(result.stdout, /Child mode\s*: never/u);
  });
});
