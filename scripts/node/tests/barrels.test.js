/**
 * Verify utility source barrels and recovery from partial initialization.
 *
 * @file Bash source barrel regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const utils = fileURLToPath(new URL("../../linux/utils/", import.meta.url));
const environment = { ...process.env, COLOR_MODE: "never", ASCII_ONLY: "1" };
const barrels = [
  ["filters/filters.sh", "_FILTERS_LOADED", "filters/core.sh", ["run_filter"]],
  [
    "utils.sh",
    "_UTILS_LOADED",
    "functions/functions.sh",
    [
      "log_info",
      "print_box",
      "plural_label",
      "run_filter",
      "run_node_script",
      "check_git_repo",
    ],
  ],
  [
    "functions/functions.sh",
    "_FUNCTIONS_LOADED",
    "functions/git.sh",
    ["check_command", "run_node_script", "check_git_repo"],
  ],
  [
    "logging/logging.sh",
    "_LOGGING_LOADED",
    "logging/box.sh",
    [
      "supports_color",
      "terminal_width",
      "log_info",
      "plural_label",
      "strip_ansi",
      "to_ascii",
      "print_ansi_file",
      "print_box",
    ],
  ],
];

function bash(code, args) {
  const result = spawnSync(
    "bash",
    ["-euo", "pipefail", "-c", code, "test", ...args],
    {
      env: environment,
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.ifError(result.error);
  return result;
}

for (const [file, marker, dependency, api] of barrels) {
  test(`${file} rejects direct execution`, () => {
    const result = spawnSync("bash", [path.join(utils, file)], {
      encoding: "utf8",
      env: environment,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /meant to be sourced/u);
  });

  test(`${file} loads its API without executing external tools`, () => {
    const result = bash(
      'git(){ return 99; }; node(){ return 99; }; jq(){ return 99; }; awk(){ return 99; }; timeout(){ printf "unexpected probe"; return 99; }; gtimeout(){ printf "unexpected probe"; return 99; }; gnutimeout(){ printf "unexpected probe"; return 99; }; before=$(set +o); directory=$PWD; source "$1"; source "$1"; [[ $(set +o) == "$before" && $PWD == "$directory" && ${!2} == 1 ]]; shift 2; for function in "$@"; do declare -F "$function" >/dev/null; done',
      [path.join(utils, file), marker, ...api],
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  });

  test(`${file} retries a partially completed load`, () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), "utility-barrels-"),
    );
    try {
      fs.cpSync(utils, directory, { recursive: true });
      const missing = path.join(directory, dependency);
      fs.renameSync(missing, `${missing}.off`);
      const result = bash(
        'if source "$1/$2"; then exit 3; fi; [[ -z ${!3:-} ]]; mv "$1/$4.off" "$1/$4"; source "$1/$2"; [[ ${!3} == 1 ]]',
        [directory, file, marker, dependency],
      );
      assert.equal(result.status, 0, result.stderr);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
}

test("label helpers belong to the logging barrel rather than the functions barrel", () => {
  const result = bash(
    'source "$1/functions/functions.sh"; ! declare -F plural_label; source "$1/logging/logging.sh"; [[ $_LABEL_LOADED == 1 && $(plural_label 2 file files) == files ]]',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
});

test("barrels and individual modules work in either source order", () => {
  for (const order of [
    [
      "logging/status.sh",
      "logging/box.sh",
      "logging/log.sh",
      "logging/terminal.sh",
      "logging/core.sh",
      "utils.sh",
    ],
    ["functions/functions.sh", "logging/logging.sh", "utils.sh"],
    ["filters/core.sh", "filters/filters.sh", "utils.sh"],
    ["filters/filters.sh", "filters/core.sh", "utils.sh"],
    ["logging/label.sh", "logging/logging.sh", "utils.sh"],
    [
      "functions/core.sh",
      "functions/git.sh",
      "functions/validation.sh",
      "utils.sh",
    ],
    ["utils.sh", "functions/core.sh", "functions/git.sh"],
    [
      "logging/log.sh",
      "logging/logging.sh",
      "functions/functions.sh",
      "utils.sh",
    ],
    [
      "utils.sh",
      "functions/functions.sh",
      "logging/logging.sh",
      "logging/log.sh",
    ],
  ]) {
    const result = bash(
      'directory=$1; shift; for module in "$@"; do source "$directory/$module"; done; [[ $_UTILS_LOADED == 1 && $_FUNCTIONS_LOADED == 1 && $_LOGGING_LOADED == 1 && $_LOG_LOADED == 1 ]]',
      [utils, ...order],
    );
    assert.equal(result.status, 0, result.stderr);
  }
});
