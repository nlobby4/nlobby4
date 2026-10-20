/**
 * Verify cache cleanup against disposable workspaces with a fake Docker client.
 * Real containers, volumes and workspace caches are never touched.
 *
 * @file Development container cache-layout regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const script = "scripts/linux/commands/devcontainer/devcontainer-clear.sh";
const caches = ["commitizen", "knip", "prettier", "python", "trivy"];

function fixture(t) {
  if (fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv")) {
    t.skip("Cleanup deliberately requires a Docker host environment");
    return undefined;
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "cache-cleanup-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, "workspace");
  for (const file of [script, "scripts/linux/utils"]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.cpSync(path.join(repository, file), path.join(root, file), {
      recursive: true,
    });
  }
  const bin = path.join(temporary, "bin");
  const log = path.join(temporary, "docker-calls.jsonl");
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, "docker"),
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.DOCKER_CALL_LOG, JSON.stringify(args) + "\\n");
if (!["info", "ps"].includes(args[0])) process.exit(99);
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    COLOR_MODE: "never",
    ASCII_ONLY: "1",
    DOCKER_CALL_LOG: log,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "0",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_CONFIG",
  ])
    delete env[key];
  assert.equal(
    spawnSync("git", ["init", "--quiet"], { cwd: root, env }).status,
    0,
  );
  const run = (...args) =>
    spawnSync("bash", [script, ...args], {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 10000,
    });
  const calls = () =>
    fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  return { root, temporary, run, calls };
}

test("cache cleanup agrees with doctor and readiness tool directory names", () => {
  const cleanup = fs.readFileSync(path.join(repository, script), "utf8");
  const paths = [...cleanup.matchAll(/"\$cache_directory\/([^"\n]+)"/gu)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(paths, caches);
  for (const file of [
    "scripts/linux/commands/repository/doctor.sh",
    "scripts/linux/commands/repository/validation/workspace-status.sh",
  ]) {
    const source = fs.readFileSync(path.join(repository, file), "utf8");
    assert.deepEqual(
      [
        ...new Set(
          [...source.matchAll(/\.cache\/([a-z-]+)/gu)].map((match) => match[1]),
        ),
      ].sort(),
      caches,
    );
  }
});

test("cleanup preview preserves legacy cache contents", (t) => {
  const f = fixture(t);
  if (!f) return;
  const cache = path.join(f.root, ".cache/general/prettier");
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, "data"), "preserved");
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(path.join(cache, "data"), "utf8"), "preserved");
  assert.deepEqual(fs.readdirSync(path.join(f.root, ".cache")), ["general"]);
  assert.ok(f.calls().every((args) => ["info", "ps"].includes(args[0])));
});

test("explicit cleanup recreates only direct tool cache directories", (t) => {
  const f = fixture(t);
  if (!f) return;
  fs.mkdirSync(path.join(f.root, ".cache/general/prettier"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(f.root, ".cache/general/prettier/data"),
    "fixture cache",
  );
  const result = f.run("--apply");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(fs.readdirSync(path.join(f.root, ".cache")).sort(), caches);
  assert.ok(
    caches.every(
      (cache) =>
        fs.readdirSync(path.join(f.root, ".cache", cache)).length === 0,
    ),
  );
  assert.ok(f.calls().every((args) => ["info", "ps"].includes(args[0])));
});

test("cleanup refuses a symlinked cache without altering the target", (t) => {
  const f = fixture(t);
  if (!f) return;
  const outside = path.join(f.temporary, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "data"), "preserved");
  fs.symlinkSync(outside, path.join(f.root, ".cache"), "dir");
  const result = f.run("--apply");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /symlinked cache/);
  assert.equal(
    fs.readFileSync(path.join(outside, "data"), "utf8"),
    "preserved",
  );
  assert.ok(fs.lstatSync(path.join(f.root, ".cache")).isSymbolicLink());
});
