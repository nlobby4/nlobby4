/**
 * Exercise focused Bash helpers in disposable directories.
 *
 * @file Function module regression tests.
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

function bash(code, args = []) {
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

test("mise policy setter defaults to disabled and exports both switches", () => {
  const result = bash(
    'source "$1/functions/core.sh"; set_mise_auto_install; bash -c \'printf "%s|%s\\n" "$MISE_AUTO_INSTALL" "$MISE_NOT_FOUND_AUTO_INSTALL"\'; set_mise_auto_install true; bash -c \'printf "%s|%s\\n" "$MISE_AUTO_INSTALL" "$MISE_NOT_FOUND_AUTO_INSTALL"\'; set_mise_auto_install false',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "false|false\ntrue|true\n");
});

for (const args of [[""], ["yes"], ["false", "extra"]]) {
  test(`mise policy setter rejects invalid arguments without changing the policy: ${JSON.stringify(args)}`, () => {
    const result = bash(
      'source "$1/functions/core.sh"; shift; set_mise_auto_install true; result=0; set_mise_auto_install "$@" || result=$?; [[ $MISE_AUTO_INSTALL == true && $MISE_NOT_FOUND_AUTO_INSTALL == true ]] || exit 9; exit "$result"',
      [utils, ...args],
    );
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
  });
}

for (const enabled of ["true", "false"]) {
  test(`scoped mise policy preserves arguments, streams, status and unset parent variables: ${enabled}`, () => {
    const result = bash(
      'source "$1/functions/core.sh"; unset MISE_AUTO_INSTALL MISE_NOT_FOUND_AUTO_INSTALL; probe(){ printf "%s|%s\\n" "$MISE_AUTO_INSTALL" "$MISE_NOT_FOUND_AUTO_INSTALL"; printf "<%s>\\n" "$@"; read -r input; printf "%s\\n" "$input"; printf "diagnostic\\n" >&2; return 23; }; options=(); [[ "$2" != true ]] || options+=(--auto-install); result=0; run_command "${options[@]}" probe "space and literal" "" --flag <<< "input content" || result=$?; [[ ! -v MISE_AUTO_INSTALL && ! -v MISE_NOT_FOUND_AUTO_INSTALL ]] || exit 9; exit "$result"',
      [utils, enabled],
    );
    assert.equal(result.status, 23, result.stderr);
    assert.equal(result.stderr, "diagnostic\n");
    assert.equal(
      result.stdout,
      `${enabled}|${enabled}\n<space and literal>\n<>\n<--flag>\ninput content\n`,
    );
  });
}

test("run_command accepts option terminators and preserves an enabled parent policy", () => {
  const result = bash(
    'source "$1/functions/core.sh"; set_mise_auto_install true; run_command -- bash -c \'printf "%s|%s\\n" "$MISE_AUTO_INSTALL" "$MISE_NOT_FOUND_AUTO_INSTALL"\'; run_command --auto-install -- bash -c \'printf "%s|%s\\n" "$MISE_AUTO_INSTALL" "$MISE_NOT_FOUND_AUTO_INSTALL"\'; [[ $MISE_AUTO_INSTALL == true && $MISE_NOT_FOUND_AUTO_INSTALL == true ]]',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "false|false\ntrue|true\n");
});

test("run_command preserves the shell's missing-command failure", () => {
  const result = bash(
    'source "$1/functions/core.sh"; run_command __workflow_missing_command__',
    [utils],
  );
  assert.equal(result.status, 127);
  assert.match(result.stderr, /command not found/u);
});

for (const args of [
  [],
  [""],
  ["--auto-install"],
  ["--"],
  ["--invalid", "printf"],
  ["--auto-install", "--invalid", "printf"],
]) {
  test(`run_command refuses invalid calls: ${JSON.stringify(args)}`, () => {
    const result = bash(
      'source "$1/functions/core.sh"; shift; run_command "$@"',
      [utils, ...args],
    );
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
  });
}

for (const [module, marker, api] of [
  ["functions/core", "_FUNCTIONS_CORE_LOADED", "check_command"],
  ["logging/label", "_LABEL_LOADED", "plural_label"],
  ["functions/node", "_NODE_LOADED", "run_node_script"],
  ["filters/core", "_FILTER_CORE_LOADED", "run_filter"],
  ["logging/core", "_CORE_LOADED", "supports_color"],
  ["logging/terminal", "_TERMINAL_LOADED", "visible_width"],
  ["logging/ansi", "_ANSI_LOADED", "strip_ansi"],
  ["logging/status", "_STATUS_LOADED", "status_add"],
  ["logging/box", "_BOX_LOADED", "print_box"],
]) {
  test(`${module} guards and repeated sourcing`, () => {
    const script = path.join(utils, `${module}.sh`);
    const direct = spawnSync("bash", [script], { encoding: "utf8" });
    assert.equal(direct.status, 1);
    assert.match(direct.stderr, /meant to be sourced/u);
    const result = bash(
      'before=$(set +o); directory=$PWD; source "$1"; source "$1"; [[ $(set +o) == "$before" && $PWD == "$directory" && ${!2} == 1 ]]; declare -F "$3" >/dev/null; ! declare -F check_git_repo',
      [script, marker, api],
    );
    assert.equal(result.status, 0, result.stderr);
  });

  test(
    `${module} retries failed dependency loading`,
    { skip: module === "logging/core" },
    () => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), "function-modules-"),
      );
      try {
        fs.cpSync(utils, directory, { recursive: true });
        const dependencyName =
          module === "functions/core" ? "logging/log.sh" : (
            "functions/validation.sh"
          );
        const dependency = path.join(directory, dependencyName);
        fs.renameSync(dependency, `${dependency}.off`);
        const result = bash(
          'if source "$1/$2.sh"; then exit 3; fi; [[ -z ${!3:-} ]]; mv "$1/$4.off" "$1/$4"; source "$1/$2.sh"; [[ ${!3} == 1 ]]',
          [directory, module, marker, dependencyName],
        );
        assert.equal(result.status, 0, result.stderr);
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    },
  );
}

test("function core provides shared checks without loading higher-level modules", () => {
  const result = bash(
    'git(){ return 99; }; node(){ return 99; }; jq(){ return 99; }; awk(){ return 99; }; source "$1/functions/core.sh"; [[ $_FUNCTIONS_CORE_LOADED == 1 && $_CORE_LOADED == 1 && -z ${_VALIDATION_LOADED:-} && -z ${_NODE_LOADED:-} && -z ${_GIT_LOADED:-} ]]; check_command bash; check_argument "0"; check_single_line_argument $\'one\\tline\'; ! declare -F check_file; ! declare -F check_unsigned_integer; ! declare -F run_node_script; ! declare -F git_refresh_upstream; ! declare -F plural_label',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("core selects GNU timeout without depending on Git or installing tools", () => {
  for (const [code, expectedStatus, expectedOutput] of [
    [
      "timeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; };",
      0,
      "timeout\n",
    ],
    [
      "timeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture' >&2; [[ $MISE_AUTO_INSTALL == false && $MISE_NOT_FOUND_AUTO_INSTALL == false ]]; }; gtimeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; };",
      0,
      "timeout\n",
    ],
    [
      "timeout(){ printf '%s\\n' 'timeout (uutils coreutils) fixture'; }; gtimeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; };",
      0,
      "gtimeout\n",
    ],
    [
      "timeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; return 7; }; command(){ [[ $3 == timeout || $3 == gnutimeout ]]; }; gnutimeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; };",
      0,
      "gnutimeout\n",
    ],
    ["command(){ return 1; };", 2, ""],
    [
      "command(){ [[ $3 == timeout ]]; }; timeout(){ printf '%s\\n' 'incompatible timeout'; };",
      2,
      "",
    ],
  ]) {
    const result = bash(
      'source "$1/functions/core.sh"; ' + code + " find_timeout",
      [utils],
    );
    assert.equal(result.status, expectedStatus, result.stderr);
    assert.equal(result.stdout, expectedOutput);
    if (expectedStatus === 0) assert.equal(result.stderr, "");
    else
      assert.match(
        result.stderr,
        /no matching command available.*GNU coreutils/u,
      );
  }
});

test("generic command selection supports availability, custom probes and literal matching", () => {
  for (const [code, expected] of [
    [
      "plain(){ printf unwanted; return 9; }; find_command __missing_candidate__ plain bash",
      "plain\n",
    ],
    [
      "tool(){ [[ $1 == -V ]] || return 9; printf 'Tool [v*?] 1.0\\n' >&2; }; find_command --version-arg -V --version-contains '[v*?]' tool",
      "tool\n",
    ],
    [
      "tool(){ [[ $1 == version && $MISE_AUTO_INSTALL == false && $MISE_NOT_FOUND_AUTO_INSTALL == false ]]; }; find_command --version-arg version tool",
      "tool\n",
    ],
    [
      "wrong(){ printf 'Tool vZZ 1.0\\n'; }; exact(){ printf 'Tool v*? 1.0\\n'; }; find_command --version-contains 'v*?' wrong exact",
      "exact\n",
    ],
  ]) {
    const result = bash('source "$1/functions/core.sh"; ' + code, [utils]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
    assert.equal(result.stderr, "");
  }
});

test("generic command selection validates all arguments before probing", () => {
  for (const args of [
    [],
    ["--unknown", "bash"],
    ["--version-contains"],
    ["--version-contains", "", "bash"],
    ["--version-arg"],
    ["--version-arg", "", "bash"],
    ["--"],
    ["bash", ""],
    ["bash", "line\nbreak"],
    ["bash", "carriage\rreturn"],
  ]) {
    const result = bash(
      'source "$1/functions/core.sh"; shift; find_command "$@"',
      [utils, ...args],
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /missing required argument|unsupported find_command option|must be a single line/u,
    );
  }
});

test("command selection supports executable paths with spaces and preserves the parent environment", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "find-command-"));
  try {
    const commandPath = path.join(directory, "a tool");
    fs.writeFileSync(
      commandPath,
      '#!/usr/bin/env bash\n[[ $1 == -V && $MISE_AUTO_INSTALL == false && $MISE_NOT_FOUND_AUTO_INSTALL == false ]] || exit 9\nprintf "Tool 1.0\\n"\n',
      { mode: 0o755 },
    );
    const result = bash(
      'source "$1/functions/core.sh"; export MISE_AUTO_INSTALL=true MISE_NOT_FOUND_AUTO_INSTALL=true; find_command --version-arg -V --version-contains "Tool 1.0" -- "$2"; [[ $MISE_AUTO_INSTALL == true && $MISE_NOT_FOUND_AUTO_INSTALL == true ]]',
      [utils, commandPath],
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, `${commandPath}\n`);
    assert.equal(result.stderr, "");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("init uses shared timeout selection after bootstrap recovery", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "init-timeout-"));
  try {
    const repositoryScripts = path.join(
      directory,
      "scripts/linux/commands/repository",
    );
    const devcontainerScripts = path.join(
      directory,
      "scripts/linux/commands/devcontainer",
    );
    fs.mkdirSync(repositoryScripts, { recursive: true });
    fs.mkdirSync(devcontainerScripts, { recursive: true });
    fs.cpSync(utils, path.join(directory, "scripts/linux/utils"), {
      recursive: true,
    });
    fs.copyFileSync(
      path.join(utils, "../commands/devcontainer/init.sh"),
      path.join(devcontainerScripts, "init.sh"),
    );
    fs.writeFileSync(
      path.join(devcontainerScripts, "recover-bootstrap.sh"),
      'printf "recovered\\n" >> "$CALL_LOG"\n',
    );
    fs.writeFileSync(
      path.join(repositoryScripts, "health.sh"),
      '[[ $MISE_AUTO_INSTALL == false && $MISE_NOT_FOUND_AUTO_INSTALL == false ]] || exit 9\nprintf "health\\n" >> "$CALL_LOG"\n',
    );
    const binaries = path.join(directory, "bin");
    fs.mkdirSync(binaries);
    fs.writeFileSync(
      path.join(binaries, "timeout"),
      '#!/usr/bin/env bash\nprintf "incompatible timeout\\n"\nexit 1\n',
      { mode: 0o755 },
    );
    fs.writeFileSync(
      path.join(binaries, "gtimeout"),
      '#!/usr/bin/env bash\nif [[ $1 == --version ]]; then printf "timeout (GNU coreutils) fixture\\n"; exit 0; fi\nprintf "%s\\n" "$3" >> "$CALL_LOG"\nshift 3\nexec "$@"\n',
      { mode: 0o755 },
    );
    fs.writeFileSync(
      path.join(binaries, "docker"),
      '#!/usr/bin/env bash\nprintf "docker-ready\\n" >> "$CALL_LOG"\n',
      { mode: 0o755 },
    );
    const log = path.join(directory, "calls.log");
    const result = spawnSync(
      "bash",
      [path.join(devcontainerScripts, "init.sh")],
      {
        env: {
          ...environment,
          PATH: `${binaries}:${process.env.PATH}`,
          CALL_LOG: log,
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(log, "utf8"),
      "recovered\n30s\ndocker-ready\n300s\nhealth\n",
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("plural labels preserve singular, plural and invalid-count contracts", () => {
  const result = bash(
    'source "$1/logging/label.sh"; [[ $(plural_label 0) == items && $(plural_label 1) == item && $(plural_label 2 person people) == people ]]; if plural_label 01; then exit 3; fi; ! declare -F run_filter',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /plural count must be an integer/u);
});

test("repeated status sourcing preserves accumulated rows", () => {
  const result = bash(
    'source "$1/logging/status.sh"; status_add State ready; source "$1/logging/status.sh"; status_print',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "State: ready\n");
});

test("filter runners resolve their assets and preserve stdin and options", () => {
  const result = bash(
    'source "$1/filters/filters.sh"; printf "%s\\n" "VALUE=a=b" | run_filter awk env-value - -v variable_name=VALUE; printf "%s\\n" \'[{"label":"Tool","value":"ready","ok":true}]\' | run_filter jq json-table - --raw-output --argjson columns \'[{"field":"label","type":"string"},{"field":"value","type":"string"},{"field":"ok","type":"boolean"}]\'; ! declare -F plural_label',
    [utils],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "a=b\nTool\tready\ttrue\n");
});

test("filter core and barrel expose readonly asset paths without changing callers", () => {
  for (const module of ["core", "filters"]) {
    const result = bash(
      'source "$1/filters/$2.sh"; cd /; [[ $JQ_FILTER_DIR == "$1/filters/jq" && $AWK_FILTER_DIR == "$1/filters/awk" ]]; [[ $(declare -p JQ_FILTER_DIR) == "declare -r "* && $(declare -p AWK_FILTER_DIR) == "declare -r "* ]]; printf "%s\\n" "VALUE=a=b" | awk -v variable_name=VALUE -f "$AWK_FILTER_DIR/env-value.awk"; printf "%s\\n" \'[{"label":"Tool","value":"ready","ok":true}]\' | jq --raw-output --argjson columns \'[{"field":"label","type":"string"},{"field":"value","type":"string"},{"field":"ok","type":"boolean"}]\' --from-file "$JQ_FILTER_DIR/json-table.jq"; source "$1/filters/core.sh"; source "$1/filters/filters.sh"; [[ $_FILTER_CORE_LOADED == 1 && $_FILTERS_LOADED == 1 ]]',
      [utils.replace(/\/$/u, ""), module],
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "a=b\nTool\tready\ttrue\n");
  }
});

test("filter runners reject traversal and missing assets", () => {
  for (const engine of ["awk", "jq"]) {
    for (const name of ["../json-table", "does-not-exist"]) {
      const result = bash(
        'source "$1/filters/filters.sh"; run_filter "$2" "$3" -',
        [utils, engine, name],
      );
      assert.equal(result.status, 2);
      assert.match(result.stderr, /invalid filter name|not a regular file/u);
    }
  }
});

test("generic filter interface rejects invalid engines and missing arguments", () => {
  for (const args of [[], ["bash"], ["../jq"], ["jq"], ["awk", "env-value"]]) {
    const result = bash(
      'source "$1/filters/filters.sh"; shift; run_filter "$@"',
      [utils, ...args],
    );
    assert.equal(result.status, 2);
    assert.match(
      result.stderr,
      /missing required argument|unsupported filter engine/u,
    );
  }
});

test("generic filter interface propagates tool failure and missing-tool diagnostics", () => {
  for (const [engine, name] of [
    ["jq", "json-table"],
    ["awk", "env-value"],
  ]) {
    const failure = bash(
      'source "$1/filters/filters.sh"; jq(){ return 7; }; awk(){ return 7; }; run_filter "$2" "$3" -',
      [utils, engine, name],
    );
    assert.equal(failure.status, 7);
    const missing = bash(
      'source "$1/filters/filters.sh"; command(){ return 1; }; run_filter "$2" "$3" -',
      [utils, engine, name],
    );
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /required but is not available/u);
  }
});

test("both engines handle assignment-like and option-like relative filenames", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "filter-inputs-"));
  try {
    for (const [engine, name, content, expected] of [
      ["awk", "env-value", "VALUE=a=b\n", "a=b\n"],
      [
        "jq",
        "json-table",
        '[{"label":"Tool","value":"ready","ok":true}]',
        "Tool\tready\ttrue\n",
      ],
    ]) {
      for (const filename of ["a=b", "-input"]) {
        fs.writeFileSync(path.join(directory, filename), content);
        const result = bash(
          'source "$1/filters/filters.sh"; cd -- "$2"; if [[ $3 == awk ]]; then run_filter "$3" "$4" "$5" -v variable_name=VALUE; else run_filter "$3" "$4" "$5" --raw-output --argjson columns \'[{"field":"label","type":"string"},{"field":"value","type":"string"},{"field":"ok","type":"boolean"}]\'; fi',
          [utils, directory, engine, name, filename],
        );
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stdout, expected);
      }
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
