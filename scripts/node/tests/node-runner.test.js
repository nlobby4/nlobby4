/**
 * Verify generic Bash Node-script execution in disposable directories.
 *
 * @file Node runner utility tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(
  new URL("../../linux/utils/functions/node.sh", import.meta.url),
);
const environment = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH}`,
  COLOR_MODE: "never",
  ASCII_ONLY: "1",
  MISE_AUTO_INSTALL: "true",
  MISE_NOT_FOUND_AUTO_INSTALL: "true",
};

function run(code, args = [], options = {}) {
  const result = spawnSync(
    "bash",
    [
      "-euo",
      "pipefail",
      "-c",
      'source "$1"; shift; ' + code,
      "test",
      helper,
      ...args,
    ],
    { encoding: "utf8", env: environment, timeout: 10000, ...options },
  );
  assert.ifError(result.error);
  return result;
}

test("Node bin location is independent of the caller directory", () => {
  const bin = fileURLToPath(new URL("../bin/", import.meta.url));
  const result = run('[[ "$NODE_BIN_DIR" -ef "$1" ]]', [bin], {
    cwd: os.tmpdir(),
  });
  assert.equal(result.status, 0, result.stderr);
});

test("runner validates required file and runtime", () => {
  for (const args of [
    [],
    ["--auto-install"],
    ["--"],
    ["--auto-install", "--"],
    ["/does-not-exist.mjs"],
    [path.dirname(helper)],
  ]) {
    const result = run('run_node_script "$@"', args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /missing required argument|not a regular file/u,
    );
  }
  const missingNode = run('command(){ return 1; }; run_node_script "$1"', [
    helper,
  ]);
  assert.equal(missingNode.status, 1);
  assert.match(missingNode.stderr, /node is required/u);
});

test("runner preserves arguments, streams, exit status and parent environment", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "node-runner-"));
  try {
    const filenames = ["script with spaces.mjs", "-script.mjs"];
    for (const filename of filenames) {
      fs.writeFileSync(
        path.join(directory, filename),
        `
import fs from "node:fs";
console.log(JSON.stringify({
  args: process.argv.slice(2),
  input: fs.readFileSync(0, "utf8"),
  autoInstall: process.env.MISE_AUTO_INSTALL,
  missingInstall: process.env.MISE_NOT_FOUND_AUTO_INSTALL,
}));
console.error("script diagnostic");
process.exitCode = 7;
`,
      );
      const args = ["space and $literal; text", "", "--flag", "日本"];
      const result = run(
        'result=0; run_node_script "$@" || result=$?; [[ $MISE_AUTO_INSTALL == true && $MISE_NOT_FOUND_AUTO_INSTALL == true ]] || exit 9; exit "$result"',
        [filename, ...args],
        { cwd: directory, input: "stdin content\n" },
      );
      assert.equal(result.status, 7, result.stderr);
      assert.equal(result.stderr, "script diagnostic\n");
      assert.deepEqual(JSON.parse(result.stdout), {
        args,
        input: "stdin content\n",
        autoInstall: "false",
        missingInstall: "false",
      });
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("runner propagates a runtime startup failure", () => {
  const result = run('node(){ return 23; }; run_node_script "$1"', [helper]);
  assert.equal(result.status, 23);
  assert.equal(result.stdout, "");
});

test("mise auto-install is explicit and remains scoped to the Node invocation", () => {
  for (const [options, expected] of [
    [[], "false"],
    [["--auto-install"], "true"],
    [["--auto-install", "--"], "true"],
  ]) {
    const result = run(
      'node(){ printf "%s|%s\\n" "$MISE_AUTO_INSTALL" "$MISE_NOT_FOUND_AUTO_INSTALL"; }; run_node_script "$@"; [[ $MISE_AUTO_INSTALL == false && $MISE_NOT_FOUND_AUTO_INSTALL == false ]]',
      [...options, helper],
      {
        env: {
          ...environment,
          MISE_AUTO_INSTALL: "false",
          MISE_NOT_FOUND_AUTO_INSTALL: "false",
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `${expected}|${expected}\n`);
  }
});

test("option terminator supports script names matching helper options", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "node-runner-options-"),
  );
  try {
    for (const filename of ["--auto-install", "--"]) {
      fs.writeFileSync(path.join(directory, filename), "unused fixture");
      for (const options of [["--"], ["--auto-install", "--"]]) {
        const result = run(
          'node(){ printf "%s\\n" "$@"; }; run_node_script "$@"',
          [...options, filename, "--auto-install", "", "--"],
          { cwd: directory },
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, `--\n${filename}\n--auto-install\n\n--\n`);
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
