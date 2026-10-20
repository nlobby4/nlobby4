/** Verify config-derived mise readiness commands without running mise tasks. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(
  new URL("../../python/mise-tool-commands.py", import.meta.url),
);

function inspect(t, contents) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mise-commands-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "mise.toml"), contents);
  const result = spawnSync("python3", [helper], {
    cwd: root,
    encoding: "utf8",
    timeout: 5000,
    killSignal: "SIGKILL",
  });
  assert.ifError(result.error);
  return result;
}

test("mise command manifest follows config, backend aliases and flag exceptions", (t) => {
  const result = inspect(
    t,
    '[tools]\nnode = "24.15.0"\n"npm:pnpm" = "10.20.0"\n"npm:@devcontainers/cli" = "0.88.0"\nminisign = "0.12"\ngitleaks = "8.30.1"\nyamllint = {version = "1.38.0", uvx = true}\n[tasks.test]\nrun = "must not execute"\n',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    "node\t--version\t24.15.0\npnpm\t--version\t10.20.0\ndevcontainer\t--version\t0.88.0\nminisign\t-v\t0.12\ngitleaks\tversion\t8.30.1\nyamllint\t--version\t1.38.0\n",
  );
});

for (const config of [
  "[tools]\n",
  '[tools]\nnode = "latest"\n',
  '[tools]\nnode = "24.15.0"\n"bad name" = "1.2.3"\n',
  "[tools]\nnode = 24\n",
  "[tools]\nnode = {uvx = true}\n",
  '[tools]\nnode = "unfinished',
]) {
  test(`mise command manifest rejects invalid configuration atomically: ${config}`, (t) => {
    const result = inspect(t, config);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /unable to enumerate mise commands/u);
  });
}
