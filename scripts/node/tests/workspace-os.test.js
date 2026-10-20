/** Verify OS reporting with isolated Linux metadata and simulated kernel names. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../../../", import.meta.url));
const script = fs.readFileSync(
  path.join(
    source,
    "scripts/linux/commands/repository/validation/workspace-status.sh",
  ),
  "utf8",
);
const helper = script.match(/_detect_os_name\(\) \{[^]*?\n\}/u)?.[0];
assert.ok(helper);

function run(t, { kernel = "Linux", etc, vendor, setup = "" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-os-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const candidates = [
    path.join(root, "etc-os-release"),
    path.join(root, "vendor-os-release"),
  ];
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, "python3"),
    '#!/usr/bin/env bash\nexec /usr/bin/python3 -c "$TEST_PYTHON_SETUP"$\'\\n\'"$2"\n',
    { mode: 0o755 },
  );
  if (etc !== undefined) fs.writeFileSync(candidates[0], etc);
  if (vendor !== undefined) fs.writeFileSync(candidates[1], vendor);
  const pythonSetup = `import platform\nplatform._os_release_candidates = ${JSON.stringify(candidates)}\n${setup}\n`;
  const result = spawnSync(
    "bash",
    [
      "-euo",
      "pipefail",
      "-c",
      `
source "$1/scripts/linux/utils/functions/core.sh"
TIMEOUT_BIN="$(find_timeout)"
uname() { printf '%s\\n' "$TEST_KERNEL"; }
${helper}
_detect_os_name
`,
      "test",
      source,
    ],
    {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TEST_KERNEL: kernel,
        TEST_PYTHON_SETUP: pythonSetup,
      },
      encoding: "utf8",
      timeout: 8000,
    },
  );
  assert.ifError(result.error);
  return result;
}

for (const [name, options, expected] of [
  [
    "etc precedence",
    { etc: 'PRETTY_NAME="Primary = Linux"\n', vendor: 'PRETTY_NAME="Other"\n' },
    "Primary = Linux",
  ],
  [
    "vendor fallback",
    { vendor: "PRETTY_NAME='Vendor Linux'\n" },
    "Vendor Linux",
  ],
  ["absent metadata", {}, "Linux"],
  ["standard default", { etc: "NAME=Example\n" }, "Linux"],
  ["empty name", { etc: 'PRETTY_NAME=""\n' }, "Linux"],
  ["last assignment", { etc: "PRETTY_NAME=First\nPRETTY_NAME=Last\n" }, "Last"],
  ["CRLF and Unicode", { etc: 'PRETTY_NAME="旧 Linux"\r\n' }, "旧 Linux"],
  [
    "literal shell syntax",
    { etc: "PRETTY_NAME='$(false) $HOME'\n" },
    "$(false) $HOME",
  ],
]) {
  test(`Linux OS detection: ${name}`, (t) => {
    const result = run(t, options);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  });
}

for (const kernel of [
  "Darwin",
  "FreeBSD",
  "MINGW64_NT-10.0",
  "MSYS_NT-10.0",
  "CYGWIN_NT-10.0",
]) {
  test(`OS detection preserves ${kernel} without reading Linux metadata`, (t) => {
    const result = run(t, {
      kernel,
      setup: "raise RuntimeError('must not read Linux metadata')",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout,
      /^(MINGW|MSYS|CYGWIN)/u.test(kernel) ? "Windows" : kernel,
    );
  });
}

test("OS detection propagates metadata reader errors", (t) => {
  const result = run(t, { setup: "raise PermissionError('fixture failure')" });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /PermissionError/u);
});
