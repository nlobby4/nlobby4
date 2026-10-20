/**
 * Exercise Bash validation contracts without changing the working repository.
 *
 * @file Validation utility regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const script = path.join(root, "scripts/linux/utils/functions/validation.sh");
const environment = {
  ...process.env,
  VALIDATION_TEST_SCRIPT: script,
  COLOR_MODE: "never",
  ASCII_ONLY: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_COUNT: "0",
};
for (const name of [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_PREFIX",
]) {
  delete environment[name];
}

function execute(code, { cwd = root, args = [], env = {} } = {}) {
  const result = spawnSync(
    "bash",
    [
      "-euo",
      "pipefail",
      "-c",
      'source "$VALIDATION_TEST_SCRIPT"; ' + code,
      "test",
      ...args,
    ],
    { cwd, encoding: "utf8", env: { ...environment, ...env }, timeout: 10000 },
  );
  assert.ifError(result.error);
  return result;
}

function check(name, args, expected, options = {}) {
  const result = execute('"$@"', { ...options, args: [name, ...args] });
  assert.equal(result.status, expected, result.stderr);
  assert.equal(result.stdout, "");
  if (expected === 0) assert.equal(result.stderr, "");
  else assert.match(result.stderr, /\[ERROR\]:/u);
}

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "validation-utils-"));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("generic utilities do not expose Git helpers", () => {
  const result = execute(
    'source "${VALIDATION_TEST_SCRIPT%/*}/../logging/label.sh"; source "${VALIDATION_TEST_SCRIPT%/*}/../filters/filters.sh"; ! declare -F check_git_repo; ! declare -F git_refresh_upstream; [[ -z ${_GIT_LOADED:-} ]]',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("guards reject execution and allow repeated strict sourcing", () => {
  const direct = spawnSync("bash", [script], { encoding: "utf8" });
  assert.equal(direct.status, 1);
  assert.match(direct.stderr, /meant to be sourced/u);
  const result = execute(
    'before=$(set +o); before_dir=$PWD; source "$VALIDATION_TEST_SCRIPT"; [[ $(set +o) == "$before" && $PWD == "$before_dir" ]]',
  );
  assert.equal(result.status, 0, result.stderr);
});

test("dependency failure does not mark initialization complete and can be retried", () => {
  fixture((directory) => {
    fs.cpSync(path.join(root, "scripts/linux/utils"), directory, {
      recursive: true,
    });
    const logging = path.join(directory, "logging/log.sh");
    fs.renameSync(logging, `${logging}.off`);
    const result = spawnSync(
      "bash",
      [
        "-euo",
        "pipefail",
        "-c",
        'if source "$1/functions/validation.sh"; then exit 3; fi; [[ -z ${_VALIDATION_LOADED:-} ]]; mv "$1/logging/log.sh.off" "$1/logging/log.sh"; source "$1/functions/validation.sh"; check_command bash',
        "test",
        directory,
      ],
      { encoding: "utf8", env: environment },
    );
    assert.equal(result.status, 0, result.stderr);
  });
});

for (const [name, expected] of [
  ["bash", 0],
  ["printf", 0],
  ["", 1],
  ["__missing_validation_command__", 1],
  ["--help", 1],
]) {
  test(`check_command ${JSON.stringify(name)}`, () =>
    check("check_command", [name], expected));
}
test("check_command accepts shell functions", () => {
  const result = execute("available(){ :; }; check_command available");
  assert.equal(result.status, 0, result.stderr);
});
for (const [value, expected] of [
  ["", 1],
  ["0", 0],
  [" ", 0],
  ["value", 0],
]) {
  test(`check_argument ${JSON.stringify(value)}`, () =>
    check("check_argument", [value, "test value"], expected));
}

for (const [value, expected] of [
  ["0", 0],
  ["1", 0],
  ["9223372036854775807", 0],
  ["9223372036854775808", 1],
  ["", 1],
  ["00", 1],
  ["08", 1],
  ["-1", 1],
  ["+1", 1],
  ["1.0", 1],
  ["1e3", 1],
  [" 1", 1],
  ["1\n", 1],
]) {
  test(`default integer interval ${JSON.stringify(value)}`, () =>
    check("check_unsigned_integer", [value], expected));
}
for (const [value, minimum, maximum, expected] of [
  ["3", "3", "4", 0],
  ["4", "3", "4", 0],
  ["2", "3", "4", 1],
  ["5", "3", "4", 1],
  ["1", "2", "1", 1],
  ["1", "00", "10", 1],
  ["1", "0", "bad", 1],
]) {
  test(`custom integer interval ${value}/${minimum}/${maximum}`, () =>
    check(
      "check_unsigned_integer",
      [value, "count", minimum, maximum],
      expected,
    ));
}
test("integer intervals match BigInt comparisons without overflow", () => {
  const cases = Array.from({ length: 100 }, (_, index) => {
    const minimum = 10n ** BigInt(index % 35);
    const maximum = minimum + 123n;
    const value = minimum + BigInt((index * 37) % 200) - 1n;
    return [
      value.toString(),
      minimum.toString(),
      maximum.toString(),
      value >= minimum && value <= maximum ? 0 : 1,
    ];
  });
  const result = execute(
    'while (( $# )); do status=0; check_unsigned_integer "$1" value "$2" "$3" 2>/dev/null || status=$?; [[ $status == "$4" ]] || exit 3; shift 4; done',
    { args: cases.flat().map(String) },
  );
  assert.equal(result.status, 0, result.stderr);
});

for (const [value, expected] of [
  ["text", 0],
  [" ", 0],
  ["a\tb", 0],
  ["", 1],
  ["a\nb", 1],
  ["a\rb", 1],
]) {
  test(`single-line argument ${JSON.stringify(value)}`, () =>
    check("check_single_line_argument", [value], expected));
}

for (const name of [
  "check_file",
  "check_directory",
  "check_path",
  "check_symlink",
  "check_resolved_symlink",
]) {
  test(`${name} rejects omitted and missing paths`, () => {
    check(name, [], 1);
    fixture((directory) => check(name, [path.join(directory, "absent")], 1));
  });
}
test("filesystem checks distinguish files, directories, links and special files", () => {
  fixture((directory) => {
    for (const name of [
      "file",
      "space name",
      "-leading",
      "a=b",
      "trailing\n",
    ]) {
      fs.writeFileSync(path.join(directory, name), "content");
      check("check_file", [path.join(directory, name)], 0);
      check("check_directory", [path.join(directory, name)], 1);
    }
    const folder = path.join(directory, "folder");
    fs.mkdirSync(folder);
    fs.symlinkSync("file", path.join(directory, "link"));
    fs.symlinkSync("folder", path.join(directory, "folder-link"));
    fs.symlinkSync("absent", path.join(directory, "broken"));
    fs.symlinkSync("loop", path.join(directory, "loop"));
    check("check_file", [folder], 1);
    check("check_directory", [folder], 0);
    check("check_file", [path.join(directory, "link")], 0);
    check("check_directory", [path.join(directory, "folder-link")], 0);
    for (const name of ["broken", "loop"]) {
      check("check_symlink", [path.join(directory, name)], 0);
      check("check_resolved_symlink", [path.join(directory, name)], 1);
      check("check_path", [path.join(directory, name)], 1);
    }
    check("check_resolved_symlink", [path.join(directory, "link")], 0);
    check("check_path", ["/dev/null"], 0);
    check("check_file", ["/dev/null"], 1);
    fs.chmodSync(path.join(directory, "file"), 0);
    check("check_file", [path.join(directory, "file")], 0);
  });
});
