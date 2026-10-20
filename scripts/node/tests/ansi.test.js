/**
 * Exercise ANSI helper output and validation in disposable directories.
 *
 * @file ANSI shell utility tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(
  new URL("../../linux/utils/logging/ansi.sh", import.meta.url),
);
const environment = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  TERM: "xterm",
  COLOR_MODE: "never",
  ASCII_ONLY: "",
  NO_COLOR: "",
  CI: "",
  GITHUB_ACTIONS: "",
};

function execute(code, args, options = {}) {
  const result = spawnSync(
    "bash",
    [
      "-euo",
      "pipefail",
      "-c",
      'source "$1"; shift; ' + code,
      "test",
      script,
      ...args,
    ],
    { encoding: "utf8", env: environment, timeout: 10000, ...options },
  );
  assert.ifError(result.error);
  return result;
}

test("ANSI stripping preserves content, tabs and missing final newline", () => {
  const result = execute("strip_ansi", [], {
    input: "\u001b[31m日本\u001b[0m\ttext",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "日本\ttext");
});

test("ASCII transliteration removes ANSI but preserves ASCII and line endings", () => {
  for (const [input, expected] of [
    ["", ""],
    [
      "plain\tASCII\r\nwithout final newline",
      "plain\tASCII\r\nwithout final newline",
    ],
    ["\u001b[31mCafé — naïve Straße\u001b[0m", "Cafe - naive Strasse"],
    ["Ελληνικά 日本 👩‍💻 ╭─╮", "Ellinika RiBen :woman::computer: +-+"],
    ["e\u0301\n", "e\n"],
    ["\u001b]8;;https://example.com\u0007日本\u001b]8;;\u0007", "RiBen"],
  ]) {
    const result = execute("to_ascii", [], { input });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
    assert.ok(
      [...result.stdout].every((character) => character.codePointAt(0) <= 127),
    );
  }
  const failure = execute("node(){ return 7; }; to_ascii", [], {
    input: "Café",
  });
  assert.equal(failure.status, 7);
});

test("ANSI assets preserve authentic color or strip it according to output policy", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ansi-assets-"));
  const asset = path.join(directory, "-asset.ansi");
  const content = "\u001b[31m日本\u001b[0m\ttext\n";
  try {
    fs.writeFileSync(asset, content);
    for (const [mode, ascii, fallback, expected] of [
      ["always", "", [], content],
      ["never", "", [], "日本\ttext\n"],
      ["always", "1", [], "RiBen\ttext\n"],
      ["always", "1", ["ASCII asset"], "ASCII asset\n"],
    ]) {
      const result = execute(
        'print_ansi_file "$@"',
        ["-asset.ansi", ...fallback],
        {
          cwd: directory,
          env: { ...environment, COLOR_MODE: mode, ASCII_ONLY: ascii },
        },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, expected);
    }
    const withoutNode = execute(
      'node(){ return 7; }; print_ansi_file "$1"',
      [asset],
      { env: { ...environment, COLOR_MODE: "always" } },
    );
    assert.equal(withoutNode.status, 0, withoutNode.stderr);
    assert.equal(withoutNode.stdout, content);
    const failed = execute('node(){ return 7; }; print_ansi_file "$1"', [
      asset,
    ]);
    assert.equal(failed.status, 7);
    const invalid = execute('print_ansi_file "$1" "$2"', [asset, "two\nlines"]);
    assert.equal(invalid.status, 1);
    assert.equal(invalid.stdout, "");
    assert.match(invalid.stderr, /must be a single line/u);
    const wrongExtension = path.join(directory, "asset.txt");
    fs.writeFileSync(wrongExtension, content);
    for (const args of [
      [],
      [path.join(directory, "missing.ansi")],
      [wrongExtension],
    ]) {
      const result = execute('print_ansi_file "$@"', args);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /missing required argument|not a regular file|\.ansi extension/u,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
