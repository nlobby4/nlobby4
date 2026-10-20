/** Exercise the real Node readiness helper in disposable workspaces. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(new URL("../bin/node-status.js", import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "node-status-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  const temporary = path.join(root, "temporary");
  fs.mkdirSync(bin);
  fs.mkdirSync(temporary);
  function write(name, value) {
    const destination = path.join(root, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, value);
  }
  function json(name, value) {
    write(name, `${JSON.stringify(value)}\n`);
  }
  function executable(name, body) {
    fs.writeFileSync(
      path.join(bin, name),
      `#!${process.execPath}\nif (process.env.MISE_AUTO_INSTALL !== 'false' || process.env.MISE_NOT_FOUND_AUTO_INSTALL !== 'false') process.exit(99);\nfor (const name of ['COREPACK_ENABLE_NETWORK', 'COREPACK_ENABLE_DOWNLOAD_PROMPT', 'COREPACK_ENABLE_AUTO_PIN']) if (process.env[name] !== '0') process.exit(98);\n${body}\n`,
      { mode: 0o755 },
    );
  }
  json("package.json", { name: "fixture", packageManager: "pnpm@10.20.0" });
  write("mise.toml", `[tools]\nnode = "${process.versions.node}"\n`);
  write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  write("pnpm-lock.yaml", "lockfileVersion: '9.0'\nimporters:\n  .: {}\n");
  write(
    "node_modules/.pnpm/lock.yaml",
    fs.readFileSync(path.join(root, "pnpm-lock.yaml")),
  );
  executable(
    "mise",
    `const args = process.argv.slice(2); if (args[0] === 'config') { if (process.env.CONFIG_FAIL) process.exit(1); console.log(process.env.NODE_VERSION ?? ${JSON.stringify(process.versions.node)}); } else if (args[0] === 'which') { if (process.env.WHICH_FAIL) process.exit(1); console.log(${JSON.stringify(path.join(bin, "pnpm"))}); } else process.exit(98);`,
  );
  executable(
    "npm",
    "if (process.env.NPM_FAIL) process.exit(1); console.log('11.12.1');",
  );
  executable(
    "pnpm",
    `
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
if (args[0] === '--version') {
  if (process.env.PNPM_FAIL) process.exit(1);
  console.log(process.env.PNPM_VERSION ?? '10.20.0');
} else if (args[0] === 'list') {
  if (process.env.LIST_FAIL) process.exit(1);
  const projects = JSON.parse(process.env.PROJECTS_JSON ?? JSON.stringify([{path: ${JSON.stringify(root)}}]));
  console.log(JSON.stringify(process.cwd() === ${JSON.stringify(root)} ? projects : projects.map(project => ({...project, path: path.join(process.cwd(), path.relative(${JSON.stringify(root)}, project.path))}))));
} else if (args[0] === 'store') {
  if (process.env.STORE_FAIL) process.exit(1);
} else if (args[0] === 'install') {
  if (process.cwd() === ${JSON.stringify(root)}) process.exit(97);
  for (const flag of ['--frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile', '--offline']) {
    if (!args.includes(flag)) process.exit(96);
  }
  if (!fs.existsSync('package.json')) process.exit(95);
  if (process.env.INSTALL_FAIL) process.exit(1);
  if (!args.includes('--lockfile-only') && fs.existsSync(${JSON.stringify(path.join(root, "reference/node_modules"))})) fs.cpSync(${JSON.stringify(path.join(root, "reference/node_modules"))}, path.join(process.cwd(), 'node_modules'), {recursive: true});
} else process.exit(98);
`,
  );
  function run(extra = {}) {
    const lock = path.join(root, "pnpm-lock.yaml");
    const before =
      fs.existsSync(lock) && fs.statSync(lock).isFile() ?
        fs.readFileSync(lock, "utf8")
      : undefined;
    const result = spawnSync(process.execPath, [helper], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        TMPDIR: temporary,
        NODE_DISABLE_COMPILE_CACHE: "1",
        MISE_AUTO_INSTALL: "true",
        MISE_NOT_FOUND_AUTO_INSTALL: "true",
        ...extra,
      },
      encoding: "utf8",
      timeout: 20000,
      killSignal: "SIGKILL",
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    if (before !== undefined)
      assert.equal(fs.readFileSync(lock, "utf8"), before);
    assert.deepEqual(
      fs.readdirSync(temporary),
      [],
      "scratch directories must be cleaned",
    );
    const rows = JSON.parse(result.stdout);
    for (const row of rows) {
      assert.equal(typeof row.ok, "boolean");
      assert.equal(typeof row.label, "string");
      assert.equal(typeof row.value, "string");
      assert.doesNotMatch(row.value, /[\r\n\t]/u);
    }
    return rows;
  }
  return { root, bin, write, json, executable, run };
}

function failed(rows, label, message) {
  const row = rows.find((entry) => entry.label === label);
  assert.ok(row, `missing ${label}`);
  assert.equal(row.ok, false);
  assert.match(row.value, message);
}

test("real Node helper validates a healthy installation without changing locks", (t) => {
  const rows = fixture(t).run();
  assert.equal(rows.length, 5);
  assert.ok(
    rows.every((row) => row.ok),
    JSON.stringify(rows),
  );
});

for (const [env, label, message] of [
  [{ NODE_VERSION: "0.0.0" }, "Node.js runtime", /expected 0\.0\.0/u],
  [{ CONFIG_FAIL: "1" }, "Node.js runtime", /expected unavailable/u],
  [{ PNPM_VERSION: "0.0.0" }, "pnpm runtime", /expected 10\.20\.0/u],
  [{ PNPM_FAIL: "1" }, "pnpm runtime", /unavailable/u],
  [{ NPM_FAIL: "1" }, "npm runtime", /unavailable/u],
  [{ WHICH_FAIL: "1" }, "Node.js dependencies", /could not be resolved/u],
  [{ LIST_FAIL: "1" }, "Node.js dependencies", /could not be enumerated/u],
  [
    { PROJECTS_JSON: "null" },
    "Node.js dependencies",
    /could not be enumerated/u,
  ],
  [{ PROJECTS_JSON: "[]" }, "Node.js dependencies", /could not be enumerated/u],
  [{ PROJECTS_JSON: "not json" }, "Node.js dependencies", /enumerated/u],
  [
    { PROJECTS_JSON: '[{"path":"/outside"}]' },
    "Node.js dependencies",
    /outside the repository/u,
  ],
  [
    { INSTALL_FAIL: "1" },
    "Node.js dependencies",
    /manifests and lockfile are inconsistent/u,
  ],
]) {
  test(`real Node helper reports ${JSON.stringify(env)}`, (t) => {
    failed(fixture(t).run(env), label, message);
  });
}

for (const manifest of [null, [], "text", "invalid JSON"]) {
  test(`real Node helper rejects malformed manifests: ${JSON.stringify(manifest)}`, (t) => {
    const f = fixture(t);
    if (manifest === "invalid JSON") f.write("package.json", "{");
    else f.json("package.json", manifest);
    failed(f.run(), "Node.js manifest", /JSON/u);
  });
}

test("real Node helper requires a pnpm version declaration", (t) => {
  const f = fixture(t);
  f.json("package.json", { name: "fixture" });
  failed(f.run(), "pnpm runtime", /expected unavailable/u);
});

for (const [name, message] of [
  ["pnpm-lock.yaml", /pnpm-lock.yaml missing/u],
  ["node_modules", /node_modules missing/u],
  ["node_modules/.pnpm/lock.yaml", /install state could not be verified/u],
]) {
  test(`real Node helper detects missing ${name}`, (t) => {
    const f = fixture(t);
    fs.rmSync(path.join(f.root, name), { recursive: true });
    failed(f.run(), "Node.js dependencies", message);
  });
}

test("real Node helper rejects a directory in place of the lockfile", (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.root, "pnpm-lock.yaml"));
  fs.mkdirSync(path.join(f.root, "pnpm-lock.yaml"));
  failed(f.run(), "Node.js dependencies", /not a regular file/u);
});

test("real Node helper rejects a regular file in place of node_modules", (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.root, "node_modules"), { recursive: true });
  f.write("node_modules", "not a directory");
  failed(f.run(), "Node.js dependencies", /not a directory/u);
});

test("real Node helper verifies frozen-lock consistency with actual pnpm offline", (t) => {
  const f = fixture(t);
  const resolved = spawnSync("mise", ["which", "pnpm"], {
    env: {
      ...process.env,
      MISE_AUTO_INSTALL: "false",
      MISE_NOT_FOUND_AUTO_INSTALL: "false",
    },
    encoding: "utf8",
    timeout: 5000,
    killSignal: "SIGKILL",
  });
  assert.ifError(resolved.error);
  assert.equal(resolved.status, 0, resolved.stderr);
  const pnpm = resolved.stdout.trim();
  f.write(
    ".npmrc",
    `store-dir=${path.join(f.root, "store")}\ncache-dir=${path.join(f.root, "cache")}\nstate-dir=${path.join(f.root, "state")}\n`,
  );
  f.json("package.json", { name: "fixture", packageManager: "pnpm@10.20.0" });
  const installed = spawnSync(
    pnpm,
    ["install", "--offline", "--ignore-scripts", "--ignore-pnpmfile"],
    {
      cwd: f.root,
      env: {
        ...process.env,
        MISE_AUTO_INSTALL: "false",
        MISE_NOT_FOUND_AUTO_INSTALL: "false",
      },
      encoding: "utf8",
      timeout: 15000,
      killSignal: "SIGKILL",
    },
  );
  assert.ifError(installed.error);
  assert.equal(installed.status, 0, installed.stderr);
  // Empty dependency graphs may not create installation metadata; use the real lock.
  f.write(
    "node_modules/.pnpm/lock.yaml",
    fs.readFileSync(path.join(f.root, "pnpm-lock.yaml")),
  );
  f.executable(
    "pnpm",
    `import {spawnSync} from 'node:child_process'; const result = spawnSync(${JSON.stringify(pnpm)}, process.argv.slice(2), {stdio: 'inherit'}); process.exit(result.status ?? 1);`,
  );
  assert.ok(f.run().every((row) => row.ok));
  f.json("package.json", {
    name: "fixture",
    packageManager: "pnpm@10.20.0",
    pnpm: { overrides: { "example-package": "1.2.3" } },
  });
  failed(
    f.run(),
    "Node.js dependencies",
    /manifests and lockfile are inconsistent/u,
  );
});

test("real Node helper rejects an installed lock that differs", (t) => {
  const f = fixture(t);
  f.write(
    "node_modules/.pnpm/lock.yaml",
    "lockfileVersion: '9.0'\nimporters: {}\n",
  );
  failed(f.run(), "Node.js dependencies", /installed lock differs/u);
});

test("real Node helper reports malformed YAML and still cleans scratch files", (t) => {
  const f = fixture(t);
  f.write("node_modules/.pnpm/lock.yaml", "broken: [");
  failed(f.run(), "Node.js dependencies", /Flow sequence/u);
});

test("real Node helper verifies nested workspace dependencies and their bins", (t) => {
  const f = fixture(t);
  const project = path.join(f.root, "packages", "nested");
  f.json("packages/nested/package.json", {
    name: "nested",
    dependencies: { "@example/tool": "1.0.0" },
  });
  const env = {
    PROJECTS_JSON: JSON.stringify([{ path: f.root }, { path: project }]),
  };
  failed(
    f.run(env),
    "Node.js dependencies",
    /missing installed package: @example\/tool/u,
  );
  f.json("packages/nested/node_modules/@example/tool/package.json", {
    name: "@example/tool",
    bin: "cli.js",
  });
  failed(f.run(env), "Node.js dependencies", /ENOENT/u);
  f.write("packages/nested/node_modules/.bin/tool", "#!/bin/sh\nexit 0\n");
  fs.chmodSync(path.join(project, "node_modules/.bin/tool"), 0o755);
  assert.ok(f.run(env).every((row) => row.ok));
  fs.chmodSync(path.join(project, "node_modules/.bin/tool"), 0o644);
  failed(f.run(env), "Node.js dependencies", /EACCES/u);
});

test("real Node helper rejects a failed command even if it prints a plausible version", (t) => {
  const f = fixture(t);
  f.executable("npm", "console.log('11.12.1'); process.exit(7);");
  failed(f.run(), "npm runtime", /unavailable/u);
});

test("real Node helper rejects multiline version output", (t) => {
  const f = fixture(t);
  f.executable("npm", "console.log('11.12.1\\nextra');");
  failed(f.run(), "npm runtime", /unavailable/u);
});

test("real Node helper rejects embedded carriage returns in versions", (t) => {
  const f = fixture(t);
  f.executable("npm", "console.log('11.12.1\\rextra');");
  failed(f.run(), "npm runtime", /unavailable/u);
});

test("real Node helper kills a command that ignores TERM", (t) => {
  const f = fixture(t);
  f.executable(
    "npm",
    "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);",
  );
  const started = Date.now();
  failed(f.run(), "npm runtime", /unavailable/u);
  assert.ok(Date.now() - started < 10000, "version probe must remain bounded");
});

test("package integrity rejects a modified pnpm store", (t) => {
  failed(
    fixture(t).run({ STORE_FAIL: "1" }),
    "Node.js package integrity",
    /store contains modified/u,
  );
});

for (const mutation of ["bytes", "executable", "symlink", "missing", "added"]) {
  test(`package integrity rejects ${mutation} drift in installed files`, (t) => {
    const f = fixture(t);
    const relative =
      "node_modules/.pnpm/example@1.0.0/node_modules/example/index.js";
    f.write(`reference/${relative}`, "export const healthy = true;\n");
    f.write(relative, "export const healthy = true;\n");
    const actual = path.join(f.root, relative);
    if (mutation === "bytes")
      f.write(relative, "export const healthy = false;\n");
    else if (mutation === "executable") fs.chmodSync(actual, 0o755);
    else if (mutation === "symlink") {
      fs.rmSync(actual);
      fs.symlinkSync(path.join(f.root, "package.json"), actual);
    } else if (mutation === "added")
      f.write(
        path.join(path.dirname(relative), "unexpected.js"),
        "unexpected\n",
      );
    else fs.rmSync(actual);
    failed(f.run(), "Node.js package integrity", /differs|ENOENT|unexpected/u);
  });
}

test("package integrity checks managed dependency link targets", (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, "reference/node_modules"), {
    recursive: true,
  });
  fs.symlinkSync(
    ".pnpm/expected",
    path.join(f.root, "reference/node_modules/example"),
  );
  fs.symlinkSync(".pnpm/other", path.join(f.root, "node_modules/example"));
  failed(f.run(), "Node.js package integrity", /package link differs/u);
});

test("actual pnpm detects copied package tampering without modifying the store", (t) => {
  const f = fixture(t);
  const resolved = spawnSync("mise", ["which", "pnpm"], {
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(resolved.status, 0, resolved.stderr);
  const pnpm = resolved.stdout.trim();
  const store = spawnSync(pnpm, ["store", "path"], {
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(store.status, 0, store.stderr);
  f.write(".npmrc", `store-dir=${store.stdout.trim()}\n`);
  f.json("package.json", {
    name: "fixture",
    packageManager: "pnpm@10.20.0",
    dependencies: { yaml: "2.9.0" },
  });
  fs.rmSync(path.join(f.root, "pnpm-lock.yaml"));
  fs.rmSync(path.join(f.root, "node_modules"), { recursive: true });
  const locked = spawnSync(
    pnpm,
    [
      "install",
      "--lockfile-only",
      "--offline",
      "--ignore-scripts",
      "--ignore-pnpmfile",
    ],
    { cwd: f.root, encoding: "utf8", timeout: 15000 },
  );
  assert.equal(locked.status, 0, locked.stderr || locked.stdout);
  const install = spawnSync(
    pnpm,
    [
      "install",
      "--frozen-lockfile",
      "--offline",
      "--ignore-scripts",
      "--ignore-pnpmfile",
      "--package-import-method=copy",
    ],
    { cwd: f.root, encoding: "utf8", timeout: 15000 },
  );
  assert.equal(install.status, 0, install.stderr || install.stdout);
  f.executable(
    "pnpm",
    `import {spawnSync} from 'node:child_process'; const r = spawnSync(${JSON.stringify(pnpm)}, process.argv.slice(2), {stdio: 'inherit'}); process.exit(r.status ?? 1);`,
  );
  const healthy = f.run();
  assert.ok(
    healthy.every((row) => row.ok),
    JSON.stringify(healthy),
  );
  const payload = path.join(
    f.root,
    "node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/dist/index.js",
  );
  fs.appendFileSync(payload, "\n// deliberate installed-package tampering\n");
  // pnpm can detect linked-installation drift during store status before byte comparison.
  failed(
    f.run(),
    "Node.js package integrity",
    /package content differs|store contains modified/u,
  );
  const unchanged = spawnSync(pnpm, ["store", "status"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 8000,
  });
  assert.equal(unchanged.status, 0, unchanged.stderr || unchanged.stdout);
});
