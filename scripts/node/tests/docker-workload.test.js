/** Verify disposable workload execution and exact-resource cleanup on failures. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(
  new URL("../../python/devcontainer-workload.py", import.meta.url),
);

for (const failure of ["none", "build", "docker", "compose", "cleanup"]) {
  test(`offline workload ${failure}: exact resources are cleaned or reported`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "workload-test-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const bin = path.join(root, "bin");
    const temporary = path.join(root, "temporary");
    const log = path.join(root, "commands.jsonl");
    fs.mkdirSync(bin);
    fs.mkdirSync(temporary);
    fs.writeFileSync(
      path.join(bin, "docker"),
      `#!${process.execPath}
import fs from 'node:fs';
const a = process.argv.slice(2);
fs.appendFileSync(process.env.PROBE_LOG, JSON.stringify(a) + '\\n');
const f = process.env.PROBE_FAIL;
if ((f === 'build' && a[0] === 'buildx') || (f === 'docker' && a[0] === 'run') || (f === 'compose' && a[0] === 'compose')) process.exit(7);
if (f === 'cleanup' && (a[0] === 'rm' || a[1] === 'rm')) process.exit(7);
if (f === 'cleanup' && a.includes('ls')) console.log('owned-resource-still-present');
`,
      { mode: 0o755 },
    );
    const result = spawnSync("python3", [helper], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: temporary,
        PROBE_LOG: log,
        PROBE_FAIL: failure,
      },
      encoding: "utf8",
      timeout: 12000,
    });
    assert.ifError(result.error);
    assert.equal(
      result.status,
      failure === "none" ? 0 : 1,
      result.stdout + result.stderr,
    );
    assert.deepEqual(fs.readdirSync(temporary), []);
    const commands = fs
      .readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    const build = commands.find((a) => a[0] === "buildx");
    assert.ok(build.includes("--pull=false"));
    assert.equal(build[build.indexOf("--network") + 1], "none");
    const image = build[build.indexOf("--tag") + 1];
    assert.match(image, /^readiness-[a-f0-9]{32}:probe$/u);
    const token = image.split(":")[0];
    const removals = commands.filter((a) => a[0] === "rm");
    assert.deepEqual(removals, [
      ["rm", "--force", `${token}-docker`],
      ["rm", "--force", `${token}-compose`],
    ]);
    assert.ok(
      commands.some(
        (a) => JSON.stringify(a) === JSON.stringify(["image", "rm", image]),
      ),
    );
    assert.ok(
      commands.every((a) => !a.includes("prune") && !a.includes("pull")),
    );
    if (failure === "cleanup")
      assert.match(result.stdout, /disposable workload cleanup failed/u);
    const run = commands.find((a) => a[0] === "run");
    if (run) {
      assert.ok(run.includes("--read-only"));
      assert.ok(run.includes("no-new-privileges:true"));
      assert.equal(run[run.indexOf("--user") + 1], "65534:65534");
    }
  });
}
