/** Isolated regression tests for timestamp selection and CI build arguments. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const helper = path.join(root, "scripts/linux/ci/source-date-epoch.sh");

function fixture(run) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "devcontainer-build-"),
  );
  try {
    const bin = path.join(directory, "bin");
    fs.mkdirSync(bin);
    const log = path.join(directory, "calls.jsonl");
    for (const command of ["devcontainer", "docker"]) {
      fs.writeFileSync(
        path.join(bin, command),
        `#!${process.execPath}
const fs = require("node:fs");
fs.appendFileSync(process.env.CALL_LOG, JSON.stringify({command: ${JSON.stringify(command)}, args: process.argv.slice(2), epoch: process.env.SOURCE_DATE_EPOCH}) + "\\n");
if (process.argv.includes("imagetools")) process.stdout.write("sha256:" + "a".repeat(64));
`,
        { mode: 0o755 },
      );
    }
    run({
      directory,
      log,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        CALL_LOG: log,
      },
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function execute(args, options) {
  const result = spawnSync("bash", args, {
    encoding: "utf8",
    timeout: 10000,
    ...options,
  });
  assert.ifError(result.error);
  return result;
}

test("timestamp defaults to the source commit, not current time", () => {
  const env = { ...process.env };
  delete env.SOURCE_DATE_EPOCH;
  const result = execute(
    ["-c", '. "$1"; printf "%s" "$SOURCE_DATE_EPOCH"', "bash", helper],
    { cwd: root, env },
  );
  assert.equal(result.status, 0, result.stderr);
  const expected = spawnSync("git", ["log", "-1", "--format=%ct"], {
    cwd: root,
    encoding: "utf8",
  }).stdout.trim();
  assert.equal(result.stdout, expected);
});

for (const value of [
  "0",
  "1720000000",
  "",
  "-1",
  "now",
  "1\n2",
  "01",
  "999999999999",
]) {
  test(`explicit timestamp validation: ${JSON.stringify(value)}`, () => {
    const result = execute(["-c", '. "$1"', "bash", helper], {
      cwd: root,
      env: { ...process.env, SOURCE_DATE_EPOCH: value },
    });
    assert.equal(
      result.status,
      ["0", "1720000000"].includes(value) ? 0 : 1,
      result.stderr,
    );
  });
}

test("source build receives timestamp and filesystem timestamp rewriting", () =>
  fixture(({ directory, log, env }) => {
    const result = execute(
      [path.join(root, "scripts/linux/ci/build-source-image.sh")],
      {
        cwd: directory,
        env: { ...env, IMAGE: "example:test", SOURCE_DATE_EPOCH: "123" },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const calls = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(calls[0].epoch, "123");
    assert.ok(calls[0].args.includes("type=docker,rewrite-timestamp=true"));
    assert.ok(calls[0].args.includes("--no-cache"));
    assert.equal(calls.length, 1);
  }));
