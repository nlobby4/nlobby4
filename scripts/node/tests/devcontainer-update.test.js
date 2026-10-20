/**
 * Real read-only maintenance checks against deliberately drifted isolated
 * inputs.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createHash } from "node:crypto";
const source = fileURLToPath(new URL("../../../", import.meta.url));
const script = path.join(
  source,
  "scripts/linux/commands/devcontainer/devcontainer-update.sh",
);

function inputs(directory) {
  const result = {};
  const visit = (name) => {
    const filename = path.join(directory, name);
    if (fs.statSync(filename).isDirectory()) {
      for (const child of fs.readdirSync(filename).sort())
        visit(path.join(name, child));
    } else
      result[name] = createHash("sha256")
        .update(fs.readFileSync(filename))
        .digest("hex");
  };
  for (const name of [
    ".devcontainer",
    ".mise",
    "mise.toml",
    "mise.lock",
    "package.json",
  ])
    visit(name);
  return result;
}

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "update-drift-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const name of [
    ".devcontainer",
    ".github/actions",
    "schemas",
    "scripts",
    "mise.toml",
    "mise.lock",
    ".mise",
    "package.json",
  ])
    fs.cpSync(path.join(source, name), path.join(directory, name), {
      recursive: true,
    });
  fs.symlinkSync(
    path.join(source, "node_modules"),
    path.join(directory, "node_modules"),
    "dir",
  );
  const init = spawnSync("git", ["init", "--quiet", directory], {
    encoding: "utf8",
  });
  assert.equal(init.status, 0, init.stderr);
  return {
    directory,
    env: {
      ...process.env,
      MISE_TRUSTED_CONFIG_PATHS: directory,
      MISE_AUTO_INSTALL: "false",
      MISE_NOT_FOUND_AUTO_INSTALL: "false",
    },
  };
}

for (const [name, filename, change, expected] of [
  ["healthy frozen inputs", "mise.toml", (text) => text, 0],
  [
    "tool pin drift",
    "mise.toml",
    (text) => text.replace('node = "24.15.0"', 'node = "24.15.1"'),
    1,
  ],
  [
    "unchanged version missing ARM artifact",
    "mise.lock",
    (text) =>
      text.replace(
        '[tools.node."platforms.linux-arm64"]',
        '[tools.node."platforms.missing"]',
      ),
    1,
  ],
  [
    "unchanged version missing checksum",
    "mise.lock",
    (text) =>
      text.replace('checksum = "sha256:', 'missing_checksum = "sha256:'),
    1,
  ],
  [
    "pnpm declaration drift",
    "package.json",
    (text) => text.replace("pnpm@10.20.0", "pnpm@99.0.0"),
    1,
  ],
])
  test(`--check detects ${name} without changing inputs`, (t) => {
    const { directory, env } = fixture(t);
    const target = path.join(directory, filename);
    fs.writeFileSync(target, change(fs.readFileSync(target, "utf8")));
    const before = inputs(directory);
    const result = spawnSync("bash", [script, "--check"], {
      cwd: directory,
      env,
      encoding: "utf8",
      timeout: 60000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, expected, result.stderr);
    assert.deepEqual(inputs(directory), before);
    if (name === "unchanged version missing checksum") {
      const preview = spawnSync(
        "mise",
        ["lock", "--dry-run", "--json", "--platform", "linux-x64,linux-arm64"],
        {
          cwd: directory,
          env: { ...env, MISE_SAFE: "1" },
          encoding: "utf8",
          timeout: 60000,
        },
      );
      assert.ifError(preview.error);
      assert.equal(preview.status, 0, preview.stderr);
      assert.deepEqual(JSON.parse(preview.stdout), []);
      assert.deepEqual(inputs(directory), before);
    }
  });
