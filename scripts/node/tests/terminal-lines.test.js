/**
 * Regression tests for terminal formatting and Bash utility edge cases.
 *
 * @file Terminal utility tests.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  stripTerminalAnsi,
  terminalWidth,
  wrapTerminalLine,
} from "../lib/terminal-lines.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const cli = path.join(root, "scripts/node/bin/terminal-text.js");

function bash(code, { cwd = root, env = {}, args = [] } = {}) {
  return spawnSync("bash", ["-euo", "pipefail", "-c", code, "test", ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", UTILS_TEST_ROOT: root, ...env },
  });
}

test("relative utility sourcing is independent of CDPATH", () => {
  for (const file of [
    "logging/label.sh",
    "functions/node.sh",
    "filters/filters.sh",
    "filters/core.sh",
    "functions/git.sh",
    "functions/validation.sh",
    "functions/core.sh",
    "logging/terminal.sh",
    "logging/ansi.sh",
    "logging/log.sh",
    "logging/logging.sh",
    "logging/core.sh",
    "logging/status.sh",
    "logging/box.sh",
    "functions/functions.sh",
    "utils.sh",
  ]) {
    const result = bash('source "scripts/linux/utils/$1"', {
      args: [file],
      env: { CDPATH: root },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  }
});

test("awk reads relative filenames containing equals", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "utils-awk-"));
  try {
    fs.writeFileSync(path.join(directory, "a=b"), "VALUE=one=two\n");
    const result = bash(
      'source "$UTILS_TEST_ROOT/scripts/linux/utils/filters/filters.sh"; run_filter awk env-value a=b -v variable_name=VALUE',
      { cwd: directory },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "one=two\n");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("Bash visible_width rejects multiline arguments without partial output", () => {
  for (const value of ["a\nb", "a\rb"]) {
    const result = bash(
      'source scripts/linux/utils/logging/logging.sh; visible_width valid "$1"',
      { args: [value] },
    );
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /must be a single line/u);
  }
});

test("width CLI rejects multiline input before emitting results", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "visible-width", "valid", "a\nb"],
    {
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 64);
  assert.equal(result.stdout, "");
});

test("width and wrapping use two spaces per tab", () => {
  assert.equal(terminalWidth("a\tb"), 4);
  assert.equal(terminalWidth("\t\t"), 4);
  assert.equal(terminalWidth("日本\tx"), 7);
  assert.equal(terminalWidth("\u001B[31ma\tb\u001B[0m"), 4);
  assert.deepEqual(wrapTerminalLine("a\tb", 8), ["a  b"]);
  for (const line of wrapTerminalLine("a\tb\tc", 4)) {
    assert.ok(!line.includes("\t"));
    assert.ok(terminalWidth(line) <= 4);
  }
});

test("ANSI stripping does not alter tabs", () => {
  assert.equal(stripTerminalAnsi("\u001B[31ma\tb\u001B[0m"), "a\tb");
});

test("status output expands tabs even when the renderer fails", () => {
  for (const setup of ["", "node(){ return 1; };"]) {
    const result = bash(
      `source scripts/linux/utils/logging/logging.sh; ${setup} status_add $'A\\tB' $'one\\ttwo'; status_print`,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "A  B: one  two\n");
  }
});

test("box titles and content use matching tab spacing", () => {
  const result = bash(
    "source scripts/linux/utils/logging/logging.sh; terminal_width(){ printf '24\\n'; }; printf 'a\\tb\\n' | print_box $'A\\tB' -",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.stdout.includes("\t"));
  const lines = result.stdout.trimEnd().split("\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes("A  B"));
  assert.ok(lines[1].includes("a  b"));
  for (const line of lines) {
    assert.equal(terminalWidth(line), 24);
  }
});
