/** Verify the private workspace boundary and dependency resolution. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const rootManifest = JSON.parse(
  fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
);

test("scripts are a private ESM workspace with one authoritative lockfile", () => {
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert(rootManifest.workspaces.includes("scripts/node"));
  assert(fs.existsSync(path.join(repositoryRoot, "pnpm-lock.yaml")));
  for (const name of ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"]) {
    assert.equal(fs.existsSync(path.join(packageRoot, name)), false);
  }
  assert.equal(manifest.scripts.test, "node --test tests/*.test.js");
  assert(!manifest.scripts.test.includes("integration"));
});

test("script dependencies resolve from their own package and are not duplicated at root", () => {
  const require = createRequire(new URL("../package.json", import.meta.url));
  for (const [name, version] of Object.entries({
    ...manifest.dependencies,
    ...manifest.devDependencies,
  })) {
    assert.match(version, /^\d+\.\d+\.\d+$/u);
    assert.equal(rootManifest.dependencies?.[name], undefined);
    assert.equal(rootManifest.devDependencies?.[name], undefined);
    assert.doesNotThrow(() => require.resolve(name));
  }
});

test("terminal entry point resolves its package dependencies from an unrelated cwd", (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scripts-package-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(
    process.execPath,
    [path.join(packageRoot, "bin/terminal-text.js"), "visible-width", "Hello"],
    { cwd, encoding: "utf8", timeout: 5000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "5");
});

test("bootstrap recovery runs before npm dependencies exist", (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-package-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  for (const name of [
    "package.json",
    "bin/recover-bootstrap.js",
    "lib/bootstrap-transaction.js",
  ]) {
    const destination = path.join(cwd, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(packageRoot, name), destination);
  }
  const result = spawnSync(
    process.execPath,
    [path.join(cwd, "bin/recover-bootstrap.js")],
    { cwd, encoding: "utf8", timeout: 5000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});
