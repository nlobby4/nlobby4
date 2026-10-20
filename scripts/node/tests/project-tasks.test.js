/**
 * Verify project task scheduling and cache boundaries in disposable
 * repositories. Uses installed Turbo and pnpm without fetching packages or
 * starting services.
 *
 * @file Organization project task integration tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(repository, "package.json")),
);
const turbo = path.join(repository, "node_modules/.bin/turbo");
const installedPnpm = spawnSync("mise", ["which", "pnpm"], {
  cwd: repository,
  env: {
    ...process.env,
    MISE_AUTO_INSTALL: "false",
    MISE_NOT_FOUND_AUTO_INSTALL: "false",
  },
  encoding: "utf8",
  timeout: 5000,
});
const pnpmDirectory =
  installedPnpm.status === 0 ?
    path.dirname(installedPnpm.stdout.trim())
  : path.dirname(process.execPath);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-tasks-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, contents) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  };
  const json = (file, contents) => write(file, JSON.stringify(contents));
  const env = {
    ...process.env,
    PATH: [
      path.dirname(process.execPath),
      pnpmDirectory,
      path.join(repository, "node_modules/.bin"),
      process.env.PATH,
    ].join(path.delimiter),
    HOME: root,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "0",
    MISE_AUTO_INSTALL: "false",
    MISE_NOT_FOUND_AUTO_INSTALL: "false",
    TURBO_TELEMETRY_DISABLED: "1",
    COREPACK_ENABLE_NETWORK: "0",
    NO_COLOR: "1",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_CONFIG",
    "TURBO_CACHE_DIR",
    "TURBO_TOKEN",
    "TURBO_TEAM",
    "TURBO_REMOTE_CACHE_ENABLED",
  ])
    delete env[key];
  const run = (command, args) =>
    spawnSync(command, args, {
      cwd: root,
      env,
      encoding: "utf8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  };
  json("package.json", {
    name: "organization",
    private: true,
    packageManager: manifest.packageManager,
    scripts: Object.fromEntries(
      Object.entries(manifest.scripts).filter(([name]) =>
        name.startsWith("projects:"),
      ),
    ),
  });
  for (const file of ["turbo.json", "pnpm-workspace.yaml"]) {
    write(file, fs.readFileSync(path.join(repository, file)));
  }
  const config = JSON.parse(fs.readFileSync(path.join(root, "turbo.json")));
  for (const file of config.globalDependencies) write(file, "initial\n");
  write("AGENTS.md", "Fixture instructions must remain unchanged\n");
  write(".gitignore", "node_modules/\n.cache/\n.generated/\n.turbo/\n");
  write("pnpm-lock.yaml", "lockfileVersion: '9.0'\nimporters:\n  .: {}\n");
  git("init", "--quiet");
  const project = (directory, name, scripts, dependencies = {}) => {
    json(`${directory}/package.json`, {
      name,
      private: true,
      scripts,
      dependencies,
    });
    write(`${directory}/.gitignore`, ".generated/\n.cache/\n.turbo/\n");
  };
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    );
  };
  const execute = (task, ...args) =>
    run(turbo, ["run", task, "--filter=./projects/**", ...args]);
  const dry = (task, ...args) => {
    const result = execute(task, "--dry=json", ...args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  return { root, write, json, run, project, commit, execute, dry };
}

test("project commands select ordinary projects, not automation or submodules", (t) => {
  const f = fixture(t);
  for (const [directory, name] of [
    ["projects/example", "@fixture/example"],
    ["projects/packages/shared", "@fixture/shared"],
    ["scripts/node", "@fixture/automation"],
    ["projects/submodules/independent", "@fixture/independent"],
  ])
    f.project(directory, name, { test: "node task.js", check: "node task.js" });
  f.commit();
  assert.deepEqual(
    f
      .dry("test")
      .tasks.map(({ package: name }) => name)
      .sort(),
    ["@fixture/example", "@fixture/shared"],
  );
  const result = f.run("pnpm", ["run", "projects:check", "--dry=json"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout, /@fixture\/(automation|independent)/);
  assert.equal(
    fs.readFileSync(path.join(f.root, "AGENTS.md"), "utf8"),
    "Fixture instructions must remain unchanged\n",
  );
});

test("uncached defaults rerun checks while project scripts propagate failure", (t) => {
  const f = fixture(t);
  f.project("projects/example", "@fixture/example", { check: "node task.js" });
  f.write("projects/example/task.js", "console.log('check executed');\n");
  f.commit();
  for (const iteration of [1, 2]) {
    const result = f.execute("check");
    assert.equal(result.status, 0, `iteration ${iteration}: ${result.stderr}`);
    assert.match(result.stdout, /check executed/);
    assert.match(result.stdout, /cache bypass/);
  }
  f.write(
    "projects/example/task.js",
    "console.error('deliberate failure'); process.exit(7);\n",
  );
  const result = f.execute("check");
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /deliberate failure/);
});

test("project opt-in cache hits and invalidates on sources and shared config", (t) => {
  const f = fixture(t);
  f.project("projects/example", "@fixture/example", { test: "node task.js" });
  f.json("projects/example/turbo.json", {
    extends: ["//"],
    tasks: { test: { cache: true, outputs: [] } },
  });
  f.write(
    "projects/example/task.js",
    [
      "const fs = require('node:fs');",
      "fs.mkdirSync('.generated', { recursive: true });",
      "fs.appendFileSync('.generated/executions', 'run\\n');",
    ].join("\n"),
  );
  f.commit();
  const count = () =>
    fs
      .readFileSync(
        path.join(f.root, "projects/example/.generated/executions"),
        "utf8",
      )
      .trim()
      .split("\n").length;
  const first = f.execute("test");
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(count(), 1);
  const second = f.execute("test");
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /cache hit/);
  assert.equal(count(), 1);
  f.write("projects/example/source.txt", "new source\n");
  assert.equal(f.execute("test").status, 0);
  assert.equal(count(), 2);
  f.write("mise.toml", "changed shared toolchain\n");
  assert.equal(f.execute("test").status, 0);
  assert.equal(count(), 3);
  assert.ok(fs.readdirSync(path.join(f.root, ".cache/turbo")).length > 0);
  assert.equal(fs.existsSync(path.join(f.root, ".turbo/cache")), false);
});

test("dependency builds precede consumer tests and failed builds block them", (t) => {
  const f = fixture(t);
  f.project("projects/packages/shared", "@fixture/shared", {
    build: "node build.js",
  });
  f.project(
    "projects/app",
    "@fixture/app",
    { test: "node test.js" },
    {
      "@fixture/shared": "workspace:*",
    },
  );
  f.write(
    "pnpm-lock.yaml",
    [
      "lockfileVersion: '9.0'",
      "importers:",
      "  .: {}",
      "  projects/packages/shared: {}",
      "  projects/app:",
      "    dependencies:",
      "      '@fixture/shared':",
      "        specifier: workspace:*",
      "        version: link:../packages/shared",
      "",
    ].join("\n"),
  );
  f.write(
    "projects/packages/shared/build.js",
    [
      "const fs = require('node:fs');",
      "fs.mkdirSync('.generated', { recursive: true });",
      "fs.writeFileSync('.generated/built', 'ready');",
    ].join("\n"),
  );
  f.write(
    "projects/app/test.js",
    [
      "const assert = require('node:assert/strict');",
      "const fs = require('node:fs');",
      "assert.equal(fs.readFileSync('../packages/shared/.generated/built', 'utf8'), 'ready');",
      "console.log('consumer ran');",
    ].join("\n"),
  );
  f.commit();
  assert.ok(
    f
      .dry("test")
      .tasks.some(({ taskId }) => taskId === "@fixture/shared#build"),
  );
  const success = f.execute("test");
  assert.equal(success.status, 0, success.stdout + success.stderr);
  assert.match(success.stdout, /consumer ran/);
  f.write("projects/packages/shared/build.js", "process.exit(3);\n");
  const failure = f.execute("test");
  assert.notEqual(failure.status, 0);
  assert.doesNotMatch(failure.stdout, /consumer ran/);
});

test("development tasks are persistent and never cached", (t) => {
  const f = fixture(t);
  f.project("projects/example", "@fixture/example", { dev: "node server.js" });
  f.commit();
  const task = f.dry("dev").tasks[0];
  assert.equal(task.resolvedTaskDefinition.persistent, true);
  assert.equal(task.resolvedTaskDefinition.cache, false);
});

test("native schema validates root and example configuration", () => {
  const schema = JSON.parse(
    fs.readFileSync(path.join(repository, "schemas/turbo.schema.json")),
  );
  const root = JSON.parse(fs.readFileSync(path.join(repository, "turbo.json")));
  const example = JSON.parse(
    fs.readFileSync(path.join(repository, "projects/example/turbo.json")),
  );
  // Treat uint64 as an annotation while enforcing the schema's integer bounds
  const validate = new Ajv({
    strict: false,
    formats: { uint64: true },
  }).compile(schema);
  assert.equal(validate(root), true, JSON.stringify(validate.errors));
  assert.equal(validate(example), true, JSON.stringify(validate.errors));
  assert.equal(root.remoteCache.enabled, false);
  assert.equal(root.cacheDir, ".cache/turbo");
  assert.equal(root.agentGuidance, false);
  assert.equal(example.tasks.test.cache, true);
  assert.ok(manifest.devDependencies.turbo.match(/^\d+\.\d+\.\d+$/));
  assert.equal(root.$schema, "./schemas/turbo.schema.json");
  assert.equal(example.$schema, "../../schemas/turbo.schema.json");
  const settings = JSON.parse(
    fs.readFileSync(path.join(repository, ".vscode/settings.json")),
  );
  assert.equal(settings["json.schemaDownload.enable"], false);
  assert.match(
    fs.readFileSync(
      path.join(repository, "organization.code-workspace"),
      "utf8",
    ),
    /"eslint\.workingDirectories"/u,
  );
});
