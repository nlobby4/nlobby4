/** SIGKILL recovery and conflict/symlink tests in disposable repositories. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  bootstrapFiles,
  applyBootstrapChanges,
  recoverBootstrapUpdate,
} from "../lib/bootstrap-transaction.js";

const names = Object.values(bootstrapFiles);
const library = new URL("../lib/bootstrap-transaction.js", import.meta.url)
  .href;
const journal = ".devcontainer/.mise-bootstrap-update";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-recovery-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of names) {
    const filename = path.join(root, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, `before ${name}`, { mode: 0o640 });
  }
  return root;
}

function snapshots(root) {
  return names.map((name) => fs.readFileSync(path.join(root, name), "utf8"));
}

function crash(root, boundary) {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
import fs from "node:fs";
import path from "node:path";
import { bootstrapFiles, applyBootstrapChanges } from ${JSON.stringify(library)};
const root = ${JSON.stringify(root)};
const names = Object.values(bootstrapFiles);
const originals = new Map(names.map(name => [name, fs.readFileSync(path.join(root, name))]));
const proposed = new Map(names.map(name => [name, "after " + name]));
const rename = fs.renameSync;
const count = {value: 0};
fs.renameSync = (...args) => {
  const result = rename(...args);
  if (${boundary} === 0 && args[1].endsWith(".mise-bootstrap-update")) process.kill(process.pid, "SIGKILL");
  if (args[0].includes(".mise-update-") && ++count.value === ${boundary}) process.kill(process.pid, "SIGKILL");
  return result;
};
applyBootstrapChanges(root, originals, proposed);
`,
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.ifError(result.error);
  assert.equal(result.signal, "SIGKILL", result.stderr);
}

for (const boundary of [0, 1, 2, 3, 4]) {
  test(`recovers SIGKILL after replacement boundary ${boundary}`, (t) => {
    const root = fixture(t);
    const before = snapshots(root);
    crash(root, boundary);
    assert.equal(
      recoverBootstrapUpdate(root),
      boundary === 4 ? "completed" : "rolled back",
    );
    assert.deepEqual(
      snapshots(root),
      boundary === 4 ? names.map((name) => `after ${name}`) : before,
    );
    assert.equal(fs.existsSync(path.join(root, journal)), false);
    assert.equal(recoverBootstrapUpdate(root), "none");
    for (const name of names)
      assert.equal(fs.statSync(path.join(root, name)).mode & 0o777, 0o640);
  });
}

test("retains later edits and the entire journal without partial recovery", (t) => {
  const root = fixture(t);
  crash(root, 2);
  fs.writeFileSync(path.join(root, names[3]), "user edit after interruption");
  const before = snapshots(root);
  assert.throws(() => recoverBootstrapUpdate(root), /conflicts with edits/u);
  assert.deepEqual(snapshots(root), before);
  assert.equal(fs.existsSync(path.join(root, journal, "state.json")), true);
});

test("recovery itself survives SIGKILL and releases its operating-system lock", (t) => {
  const root = fixture(t);
  const before = snapshots(root);
  crash(root, 3);
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
import fs from "node:fs";
import { recoverBootstrapUpdate } from ${JSON.stringify(library)};
const rename = fs.renameSync;
fs.renameSync = (...args) => {
  const result = rename(...args);
  if (args[0].includes(".mise-update-")) process.kill(process.pid, "SIGKILL");
  return result;
};
recoverBootstrapUpdate(${JSON.stringify(root)});
`,
    ],
    { encoding: "utf8", timeout: 10000 },
  );
  assert.ifError(result.error);
  assert.equal(result.signal, "SIGKILL", result.stderr);
  assert.equal(recoverBootstrapUpdate(root), "rolled back");
  assert.deepEqual(snapshots(root), before);
});

test("refuses a damaged journal without changing files", (t) => {
  const root = fixture(t);
  crash(root, 1);
  const filename = path.join(root, journal, "state.json");
  const state = JSON.parse(fs.readFileSync(filename, "utf8"));
  state.entries[0].beforeHash = "0".repeat(64);
  fs.writeFileSync(filename, JSON.stringify(state));
  const before = snapshots(root);
  assert.throws(() => recoverBootstrapUpdate(root), /damaged/u);
  assert.deepEqual(snapshots(root), before);
});

test("refuses symlinked targets without changing their destination", (t) => {
  const root = fixture(t);
  crash(root, 1);
  const filename = path.join(root, names[0]);
  const outside = path.join(root, "unrelated");
  fs.writeFileSync(outside, "preserve me");
  fs.unlinkSync(filename);
  fs.symlinkSync(outside, filename);
  assert.throws(() => recoverBootstrapUpdate(root), /unsafe/u);
  assert.equal(fs.readFileSync(outside, "utf8"), "preserve me");
});

test("rejects concurrent recovery and rolls back an ordinary replacement error", (t) => {
  const root = fixture(t);
  const before = snapshots(root);
  const originals = new Map(
    names.map((name) => [name, Buffer.from(`before ${name}`)]),
  );
  const proposed = new Map(names.map((name) => [name, `after ${name}`]));
  const rename = fs.renameSync;
  fs.renameSync = (...args) => {
    if (args[0].includes(".mise-update-")) {
      assert.throws(() => recoverBootstrapUpdate(root), /still running/u);
      throw new Error("simulated replacement error");
    }
    return rename(...args);
  };
  try {
    assert.throws(
      () => applyBootstrapChanges(root, originals, proposed),
      /simulated replacement error/u,
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.deepEqual(snapshots(root), before);
  assert.equal(fs.existsSync(path.join(root, journal)), false);
});

test("cleans an empty journal left by interrupted final cleanup", (t) => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, journal));
  const before = snapshots(root);
  assert.equal(recoverBootstrapUpdate(root), "completed cleanup");
  assert.deepEqual(snapshots(root), before);
});

test("released locks allow recovery across container identities", (t) => {
  const root = fixture(t);
  crash(root, 1);
  const filename = path.join(root, journal, "state.json");
  const state = JSON.parse(fs.readFileSync(filename, "utf8"));
  state.owner.host = "another-container";
  fs.writeFileSync(filename, JSON.stringify(state));
  assert.equal(recoverBootstrapUpdate(root), "rolled back");
});

test("a previous boot cannot retain a live update owner", (t) => {
  const root = fixture(t);
  crash(root, 1);
  const filename = path.join(root, journal, "state.json");
  const state = JSON.parse(fs.readFileSync(filename, "utf8"));
  state.owner.boot = "previous-boot";
  state.owner.host = "old-container";
  fs.writeFileSync(filename, JSON.stringify(state));
  assert.equal(recoverBootstrapUpdate(root), "rolled back");
});
