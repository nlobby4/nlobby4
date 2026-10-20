/** Non-mutating fixtures verify exact-target restart and refusal paths. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const script = path.join(
  root,
  "scripts/linux/commands/devcontainer/devcontainer-recover.sh",
);
const identifier = "a".repeat(64);

function run(t, arguments_, overrides = {}) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "container-recovery-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const log = path.join(directory, "calls.jsonl");
  for (const command of ["docker", "devcontainer"]) {
    fs.writeFileSync(
      path.join(directory, command),
      `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({command:${JSON.stringify(command)}, args}) + "\\n");
if (args[0] === "ps") process.stdout.write(process.env.CONTAINER_IDS + "\\n");
if (args[0] === "inspect") process.stdout.write(args[2].includes("local_folder") ? process.env.WORKSPACE_LABEL : args[2].includes("config_file") ? process.env.CONFIGURATION_LABEL : JSON.stringify([{Type:"bind",Source:process.env.WORKSPACE_LABEL,Destination:"/workspace"}]));
if (${JSON.stringify(command)} === "devcontainer" && process.env.READINESS_FAIL === "1") process.exit(1);
`,
      { mode: 0o755 },
    );
  }
  const result = spawnSync("bash", [script, ...arguments_], {
    cwd: root,
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      CALL_LOG: log,
      CONTAINER_IDS: identifier,
      WORKSPACE_LABEL: root,
      CONFIGURATION_LABEL: path.join(root, ".devcontainer/devcontainer.json"),
      ...overrides,
    },
  });
  assert.ifError(result.error);
  const calls =
    fs.existsSync(log) ?
      fs
        .readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  return { result, calls };
}

test("preview never mutates Docker state", (t) => {
  const { result, calls } = run(t, []);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls.map((call) => call.args[0]),
    ["ps"],
  );
});

for (const containers of [
  "",
  `${identifier}\n${"b".repeat(64)}`,
  "not-an-id",
]) {
  test(`refuses ambiguous or invalid target ${JSON.stringify(containers)}`, (t) => {
    const { result, calls } = run(t, ["--restart"], {
      CONTAINER_IDS: containers,
    });
    assert.equal(result.status, 1);
    assert.ok(calls.every((call) => call.args[0] === "ps"));
  });
}

test("rechecks exact labels before any restart", (t) => {
  const { result, calls } = run(t, ["--restart"], {
    WORKSPACE_LABEL: "/unrelated",
  });
  assert.equal(result.status, 1);
  assert.ok(!calls.some((call) => call.args[0] === "restart"));
});

test("restarts only the resolved ID and runs bounded existing-container validation", (t) => {
  const { result, calls } = run(t, ["--restart"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.find((call) => call.args[0] === "restart").args, [
    "restart",
    "--timeout",
    "30",
    identifier,
  ]);
  const up = calls.find((call) => call.command === "devcontainer");
  assert.ok(up.args.includes("--expect-existing-container"));
  assert.ok(up.args.includes("--frozen-lockfile"));
  assert.ok(
    calls.every((call) => !["rm", "prune", "volume"].includes(call.args[0])),
  );
});

test("readiness failure is propagated without a destructive retry", (t) => {
  const { result, calls } = run(t, ["--restart"], { READINESS_FAIL: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Data was preserved/u);
  assert.equal(calls.filter((call) => call.args[0] === "restart").length, 1);
});
