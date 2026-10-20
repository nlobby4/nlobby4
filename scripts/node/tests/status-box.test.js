/**
 * Verify status storage, aligned output and narrow box rendering.
 *
 * @file Status and box regression tests.
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

test("JSON status imports preserve escaped text and color only unhealthy rows", () => {
  const result = execute(
    'status_import_json "$JSON_ROWS" && result=0 || result=$?; status_print; exit "$result"',
    {
      COLOR_MODE: "always",
      JSON_ROWS: JSON.stringify([
        { label: "Path", value: "C:\\cache\\new\\file 100% \\c", ok: true },
        { label: "Tab", value: "a\tb", ok: false },
      ]),
    },
  );
  assert.equal(result.status, 1, result.stderr);
  assert.equal(
    result.stdout,
    "Path: C:\\cache\\new\\file 100% \\c\nTab : \u001b[0;31ma  b\u001b[0m\n",
  );
});

for (const payload of [
  "null",
  "[]",
  "invalid",
  '[{"label":"A","value":"B","ok":"true"}]',
  ...["\n", "\r", "\u0000"].map((character) =>
    JSON.stringify([
      { label: "Valid", value: "value", ok: true },
      { label: "Invalid", value: `value${character}suffix`, ok: true },
    ]),
  ),
])
  test(`invalid JSON status imports are atomic: ${payload}`, () => {
    const result = execute(
      'status_add Existing retained; status_import_json "$JSON_ROWS" && result=0 || result=$?; status_print; exit "$result"',
      { JSON_ROWS: payload },
    );
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "Existing: retained\n");
  });

function execute(
  code,
  env = {},
  script = "scripts/linux/utils/logging/logging.sh",
) {
  const result = spawnSync(
    "bash",
    ["-euo", "pipefail", "-c", `source "$1"; ${code}`, "test", script],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
        COLOR_MODE: "never",
        ASCII_ONLY: "",
        NO_COLOR: "",
        TERM: "xterm",
        CI: "",
        GITHUB_ACTIONS: "",
        ...env,
      },
    },
  );
  assert.ifError(result.error);
  return result;
}

test("status alignment, Unicode widths and repeated prints remain unchanged", () => {
  for (const [rows, expected] of [
    ["", ""],
    ["status_add A one; status_add Longer two;", "A     : one\nLonger: two\n"],
    ["status_add 日本 one; status_add ABC two;", "日本: one\nABC : two\n"],
    [
      "status_add Same first; status_add Same second;",
      "Same: first\nSame: second\n",
    ],
  ]) {
    const result = execute(`${rows} status_print; status_print`);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected.repeat(2));
  }
});

test("reset clears every row field and invalid additions leave no partial row", () => {
  const result = execute(
    "status_add Old bad \"$COLOR_RED\"; status_reset; if status_add State ready $'two\\nlines'; then exit 3; fi; status_add State ready; status_print",
    { COLOR_MODE: "always" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "State: ready\n");
  assert.match(result.stderr, /status color must be a single line/u);
});

test("status measures labels in one batch and retains unaligned fallback", () => {
  for (const [measure, expected] of [
    [
      'visible_width(){ [[ $# == 2 ]] || return 1; printf "%s\\n" 1 6; };',
      "A     : one\nLonger: two\n",
    ],
    ["node(){ return 1; };", "A: one\nLonger: two\n"],
  ]) {
    const result = execute(
      `${measure} status_add A one; status_add Longer two; status_print`,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});

test("wrapping removes excessive label padding but leaves fitting rows untouched", () => {
  const row = `OS${" ".repeat(45)}: Debian`;
  assert.deepEqual(wrapTerminalLine(row, 80), [row]);
  assert.deepEqual(wrapTerminalLine(row, 46), ["OS: Debian"]);
  const value = "this value uses hanging indentation when wrapped";
  assert.deepEqual(
    wrapTerminalLine(`Short label${" ".repeat(40)}: ${value}`, 32),
    wrapTerminalLine(`Short label: ${value}`, 32),
  );
  assert.deepEqual(wrapTerminalLine("A     : a long value for wrapping", 24), [
    "A     : a long value for",
    "        wrapping",
  ]);
});

test("padding removal preserves ANSI label and value coloring", () => {
  const label = "\u001b[36m日本\u001b[0m";
  const value = "\u001b[31munavailable\u001b[0m";
  const lines = wrapTerminalLine(`${label}${" ".repeat(40)}: ${value}`, 30);
  assert.deepEqual(lines, [`${label}: ${value}`]);
  assert.equal(stripTerminalAnsi(lines[0]), "日本: unavailable");
});

test("genuine long labels still wrap normally and ordinary text keeps its spacing", () => {
  assert.deepEqual(
    wrapTerminalLine("A very long descriptive label: value", 24),
    ["A very long descriptive", "label: value"],
  );
  for (const line of [
    "plain  text",
    "https://example.com",
    "12:30 local time",
  ]) {
    assert.deepEqual(wrapTerminalLine(line, 80), [line]);
  }
});

test("status boxes remain full width with short and long labels", () => {
  for (const width of [24, 50, 80]) {
    for (const ascii of ["", "1"]) {
      const result = execute(
        `terminal_width(){ printf '${width}\\n'; }; status_add OS Debian; status_add 'A very long descriptive status label for storage' available; status_print | print_box Demo -`,
        { ASCII_ONLY: ascii },
      );
      assert.equal(result.status, 0, result.stderr);
      const lines = result.stdout.trimEnd().split("\n");
      for (const line of lines) {
        assert.equal(terminalWidth(line), width);
      }
      assert.match(result.stdout, width < 80 ? /OS: Debian/u : /OS +: Debian/u);
    }
  }
});

test("box rendering uses the shared Node bin location without private script aliases", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "box-module-"));
  try {
    fs.cpSync(path.join(root, "scripts/linux/utils"), directory, {
      recursive: true,
    });
    const result = execute(
      '[[ -z ${_TERMINAL_TEXT_SCRIPT+set} && -z ${_BOX_TEXT_SCRIPT+set} ]]; terminal_width(){ printf "24\\n"; }; run_node_script(){ [[ $1 == "$NODE_BIN_DIR/terminal-text.js" ]] || return 9; shift; case "$1" in visible-width) printf "4\\n" ;; format-lines) printf "%-20s\\n" ready ;; *) return 9 ;; esac; }; printf "ready\\n" | print_box Demo -',
      {},
      path.join(directory, "logging/box.sh"),
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /│ ready +│/u);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
