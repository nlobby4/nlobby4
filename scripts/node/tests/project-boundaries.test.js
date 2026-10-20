/**
 * Exercise organization and project ownership in disposable local repositories.
 * No remote repositories, application installs or real workspace index writes.
 *
 * @file Monorepo and local-submodule boundary regression tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateSchemas } from "../lib/schema-validator.js";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const cli = "scripts/node/bin/workspace-check.js";

// Optional external binaries are exercised when already installed, never fetched
function installedMiseTool(name) {
  const result = spawnSync("mise", ["which", name], {
    env: {
      ...process.env,
      MISE_AUTO_INSTALL: "false",
      MISE_NOT_FOUND_AUTO_INSTALL: "false",
    },
    encoding: "utf8",
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

function fixture(t) {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "project-boundaries-"),
  );
  const root = path.join(temporary, "organization");
  fs.mkdirSync(root);
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "0",
    HOME: temporary,
    MISE_AUTO_INSTALL: "false",
    MISE_NOT_FOUND_AUTO_INSTALL: "false",
    PATH: `${path.join(repository, "node_modules/.bin")}${path.delimiter}${process.env.PATH}`,
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_CONFIG",
  ])
    delete env[key];
  const write = (file, contents) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), contents);
  };
  for (const file of [
    cli,
    "package.json",
    ".gitignore",
    ".gitattributes",
    ".prettierignore",
    "prettier.config.js",
    "eslint.config.js",
    ".editorconfig",
    ".editorconfig-checker.json",
    ".yamllint.yaml",
    ".hadolint.yaml",
    ".shellcheckrc",
    "pnpm-workspace.yaml",
    "schemas",
    "projects/.lintstagedrc.json",
    "projects/example",
    "projects/packages/example-package",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.cpSync(path.join(repository, file), path.join(root, file), {
      recursive: true,
    });
  }
  fs.symlinkSync(
    path.join(repository, "node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
  const run = (command, args, cwd = root, overrides = {}) =>
    spawnSync(command, args, {
      cwd,
      env: { ...env, ...overrides },
      encoding: "utf8",
      timeout: 30000,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout.trim();
  };
  git("init", "--quiet");
  git("config", "user.name", "Boundary fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.hooksPath", "/dev/null");
  git("config", "commit.gpgsign", "false");
  return {
    temporary,
    root,
    write,
    run,
    git,
    check: (name) => run(process.execPath, [cli, name]),
  };
}

test("example package joins the workspace and runs through its public exports", (t) => {
  const f = fixture(t);
  const result = f.run("pnpm", [
    "--filter",
    "@nlobby4/example-package",
    "test",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /tests 3/u);
  assert.match(result.stdout, /fail 0/u);
  f.write(
    "pnpm-lock.yaml",
    fs.readFileSync(path.join(repository, "pnpm-lock.yaml")),
  );
  f.write("turbo.json", fs.readFileSync(path.join(repository, "turbo.json")));
  f.write(
    "projects/submodules/independent/package.json",
    JSON.stringify({ name: "@fixture/independent", private: true }),
  );
  const scheduled = f.run(process.execPath, [
    path.join(repository, "node_modules/turbo/bin/turbo"),
    "run",
    "check",
    "--filter=./projects/**",
    "--dry=json",
  ]);
  assert.equal(scheduled.status, 0, scheduled.stdout + scheduled.stderr);
  assert.deepEqual(JSON.parse(scheduled.stdout).packages.sort(), [
    "@nlobby4/example",
    "@nlobby4/example-package",
  ]);
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(f.root, "projects/packages/example-package/package.json"),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.resolve(f.root, "projects/packages/example-package", schema.$schema),
    ),
  );
});

test("example package inherits shell formatting and respects local overrides", (t) => {
  const f = fixture(t);
  const owner = "projects/packages/example-package";
  f.write(
    `${owner}/src/probe.js`,
    'export function probe(){return {name:"fixture"}}\n',
  );
  f.write(`${owner}/.generated/invalid.js`, "invalid JavaScript!");
  f.write(`${owner}/.cache/invalid.js`, "invalid JavaScript!");
  f.write("projects/submodules/independent/invalid.js", "invalid JavaScript!");
  const shared = f.check("format");
  assert.equal(shared.status, 0, shared.stdout + shared.stderr);
  assert.match(shared.stdout, /projects\/packages\/example-package/u);
  assert.match(
    fs.readFileSync(path.join(f.root, owner, "src/probe.js"), "utf8"),
    /\n {2}return \{ name: "fixture" \};/u,
  );
  f.write(
    `${owner}/.prettierrc.json`,
    '{"tabWidth":4,"singleQuote":true,"semi":false}\n',
  );
  const local = f.check("format");
  assert.equal(local.status, 0, local.stdout + local.stderr);
  assert.match(
    fs.readFileSync(path.join(f.root, owner, "src/probe.js"), "utf8"),
    /\n {4}return \{ name: 'fixture' \}/u,
  );
  assert.equal(
    fs.readFileSync(
      path.join(f.root, "projects/submodules/independent/invalid.js"),
      "utf8",
    ),
    "invalid JavaScript!",
  );
});

test("example package inherits basic linting without shell runtime globals", (t) => {
  const f = fixture(t);
  const owner = "projects/packages/example-package";
  assert.equal(f.check("lint:js").status, 0);
  f.write(`${owner}/src/probe.js`, "export const value = process.platform;\n");
  const failed = f.check("lint:js");
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout + failed.stderr, /no-undef/u);
  f.write(
    `${owner}/eslint.config.mjs`,
    "export default [{ ignores: ['.generated/**', '.cache/**'] }, { files: ['**/*.js'], languageOptions: { globals: { process: 'readonly' } }, rules: { 'no-undef': 'error' } }];\n",
  );
  const local = f.check("lint:js");
  assert.equal(local.status, 0, local.stdout + local.stderr);
  assert.equal(fs.existsSync(path.join(f.root, owner, "node_modules")), false);
});

test("example package owns its ignore rules and packaging contents", (t) => {
  const f = fixture(t);
  const owner = "projects/packages/example-package";
  f.write(`${owner}/.generated/probe.txt`, "generated\n");
  f.write(`${owner}/.cache/probe.txt`, "cache\n");
  f.write(`${owner}/.turbo/probe.log`, "task log\n");
  f.write(`${owner}/.env`, "EXAMPLE=fixture\n");
  for (const name of [
    ".generated/probe.txt",
    ".cache/probe.txt",
    ".turbo/probe.log",
    ".env",
  ])
    assert.equal(f.run("git", ["check-ignore", `${owner}/${name}`]).status, 0);
  assert.equal(
    f.run("git", ["check-ignore", `${owner}/src/index.js`]).status,
    1,
  );
  assert.match(
    f.git("check-attr", "eol", "--", `${owner}/src/index.js`),
    /eol: lf/u,
  );
  const packed = f.run(
    "pnpm",
    ["pack", "--out", ".generated/example-package.tgz"],
    path.join(f.root, owner),
  );
  assert.equal(packed.status, 0, packed.stdout + packed.stderr);
  const listing = f.run("tar", [
    "-tzf",
    `${owner}/.generated/example-package.tgz`,
  ]);
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout, /package\/src\/index.js/u);
  assert.match(listing.stdout, /package\/package.json/u);
  assert.doesNotMatch(
    listing.stdout,
    /(?:tests\/|\.cache\/|\.generated\/|\.env|\.turbo\/)/u,
  );
});

test("formatting honors project style, local exclusions and submodule boundaries", (t) => {
  const f = fixture(t);
  f.write("fixture.config.js", "export default {value:1}\n");
  f.write(
    "projects/example/src/fixture.js",
    'export const value={text:"example"};\n',
  );
  f.write(
    "projects/example/.gitignore",
    "excluded/\n.cache/\n.generated/\nnode_modules/\n",
  );
  f.write("projects/example/.prettierignore", "custom/\n");
  for (const file of [
    "excluded/broken.js",
    "custom/broken.js",
    ".cache/broken.js",
  ])
    f.write(
      `projects/example/${file}`,
      "this is deliberately invalid JavaScript",
    );
  f.write("projects/submodules/local/broken.js", "also invalid JavaScript");
  const result = f.check("format");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(
    fs.readFileSync(path.join(f.root, "fixture.config.js"), "utf8"),
    /value: 1.*;/,
  );
  assert.equal(
    fs.readFileSync(
      path.join(f.root, "projects/example/src/fixture.js"),
      "utf8",
    ),
    "export const value = { text: 'example' }\n",
  );
  assert.equal(
    fs.readFileSync(
      path.join(f.root, "projects/submodules/local/broken.js"),
      "utf8",
    ),
    "also invalid JavaScript",
  );
  assert.equal(f.check("format:check").status, 0);
  f.write("projects/example/src/fixture.js", "export const value=1;\n");
  assert.equal(f.check("format:check").status, 1);
});

test("local submodule has independent Git policy and is skipped by shared formatting", (t) => {
  const f = fixture(t);
  const origin = path.join(f.temporary, "submodule-origin");
  fs.mkdirSync(origin);
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.name", "Local fixture"],
    ["config", "user.email", "fixture@example.invalid"],
    ["config", "commit.gpgsign", "false"],
  ])
    assert.equal(f.run("git", args, origin).status, 0);
  fs.writeFileSync(path.join(origin, "source.js"), "const submodule=1;\n");
  fs.writeFileSync(path.join(origin, ".gitignore"), "local-output/\n");
  assert.equal(f.run("git", ["add", "."], origin).status, 0);
  assert.equal(
    f.run("git", ["commit", "--quiet", "-m", "local fixture"], origin).status,
    0,
  );
  f.git(
    "-c",
    "protocol.file.allow=always",
    "submodule",
    "add",
    "--quiet",
    origin,
    "projects/submodules/local",
  );
  const submodule = path.join(f.root, "projects/submodules/local");
  const before = f.run("git", ["status", "--porcelain"], submodule).stdout;
  assert.match(
    f.git("ls-files", "--stage", "--", "projects/submodules/local"),
    /^160000 /,
  );
  assert.equal(f.check("format").status, 0);
  assert.equal(
    fs.readFileSync(path.join(submodule, "source.js"), "utf8"),
    "const submodule=1;\n",
  );
  assert.equal(
    f.run("git", ["status", "--porcelain"], submodule).stdout,
    before,
  );
  assert.equal(
    f.run("git", ["config", "--local", "--get", "rerere.enabled"], submodule)
      .status,
    1,
  );
  assert.match(
    f.git("check-attr", "eol", "--", "projects/example/src/greeting.js"),
    /eol: lf/,
  );
  const mise = f.run("mise", ["--version"]);
  if (mise.status === 0) {
    fs.cpSync(
      path.join(repository, "mise.toml"),
      path.join(f.root, "mise.toml"),
    );
    f.write(
      "projects/submodules/local/mise.toml",
      '[tasks.probe]\nrun = "echo local-only"\n',
    );
    const configs = f.run("mise", ["config", "ls", "--json"], submodule, {
      MISE_CEILING_PATHS: path.join(f.root, "projects/submodules"),
      MISE_TRUSTED_CONFIG_PATHS: f.root,
      MISE_CACHE_DIR: path.join(f.temporary, "mise-cache"),
    });
    assert.equal(configs.status, 0, configs.stdout + configs.stderr);
    assert.ok(configs.stdout.includes(path.join(submodule, "mise.toml")));
    assert.ok(!configs.stdout.includes(path.join(f.root, "mise.toml")));
  }
});

test("project denylist owns generated output without changing the root", (t) => {
  const f = fixture(t);
  for (const file of [
    ".generated/report.json",
    ".cache/tool/data.json",
    "dist/output.js",
    ".env",
  ])
    f.write(`projects/example/${file}`, "temporary");
  for (const file of [
    ".generated/report.json",
    ".cache/tool/data.json",
    "dist/output.js",
    ".env",
  ])
    assert.equal(
      f.run("git", ["check-ignore", "--quiet", `projects/example/${file}`])
        .status,
      0,
    );
  assert.equal(
    f.run("git", [
      "check-ignore",
      "--quiet",
      "projects/example/src/greeting.js",
    ]).status,
    1,
  );
});

test("shared routing skips symlinked projects and preserves tool failure codes", (t) => {
  const f = fixture(t);
  const outside = path.join(f.temporary, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "broken.js"), "invalid JavaScript");
  fs.symlinkSync(outside, path.join(f.root, "projects/linked"), "dir");
  assert.equal(f.check("format").status, 0);
  f.write(
    "projects/example/node_modules/.bin/prettier",
    "#!/usr/bin/env node\nprocess.exit(7)\n",
  );
  fs.chmodSync(
    path.join(f.root, "projects/example/node_modules/.bin/prettier"),
    0o755,
  );
  assert.equal(f.check("format:check").status, 7);
  assert.equal(f.check("unknown").status, 2);
});

test("root schema policy does not enroll project-specific schemas", (t) => {
  const f = fixture(t);
  f.write("projects/example/schemas/broken.schema.json", "{ invalid");
  f.write(
    "projects/example/data.json",
    '{"$schema":"schemas/broken.schema.json"}\n',
  );
  assert.deepEqual(validateSchemas(f.root).failures, []);
});

test("staged project files use project lint-staged policy, not root Markdown policy", (t) => {
  const f = fixture(t);
  f.git("add", "--force", "package.json");
  f.git("commit", "--quiet", "-m", "initial");
  f.write(
    "projects/example/fixture.md",
    "This intentionally has no first-level title.\n",
  );
  f.git("add", "projects/example/fixture.md");
  const result = f.run(process.execPath, [
    path.join(repository, "node_modules/lint-staged/bin/lint-staged.js"),
    "--no-stash",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /markdownlint/);
  assert.match(result.stdout + result.stderr, /prettier --write/);
});

test("staged JavaScript inherits shared linting without a project installation", (t) => {
  const f = fixture(t);
  f.git("add", "--force", "package.json");
  f.git("commit", "--quiet", "-m", "initial");
  f.write("projects/plain/index.js", "export const value = missing;\n");
  f.git("add", "projects/plain/index.js");
  const args = [
    path.join(repository, "node_modules/lint-staged/bin/lint-staged.js"),
    "--no-stash",
  ];
  const failed = f.run(process.execPath, args);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout + failed.stderr, /no-undef/);
  f.write("projects/plain/index.js", "export const value = 1;\n");
  f.git("add", "projects/plain/index.js");
  const passed = f.run(process.execPath, args);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  assert.equal(
    fs.existsSync(path.join(f.root, "projects/plain/node_modules")),
    false,
  );
});

test("project ESLint policy wins while reusing the shell's installed binary", (t) => {
  const f = fixture(t);
  const args = [
    path.join(repository, "node_modules/eslint/bin/eslint.js"),
    ".",
    "--max-warnings",
    "0",
  ];
  f.write(
    "projects/example/src/noisy.js",
    "export function noisy() { console.log('noise') }\n",
  );
  const shared = f.check("lint:js");
  assert.equal(shared.status, 1, shared.stdout + shared.stderr);
  assert.match(shared.stdout + shared.stderr, /no-console/);
  const result = f.run(
    process.execPath,
    args,
    path.join(f.root, "projects/example"),
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /no-console/);
});

test("ESLint falls back to shell defaults without requiring project dependencies", (t) => {
  const f = fixture(t);
  f.write("projects/plain/src/index.js", "export const value = 1;\n");
  f.write("projects/submodules/independent/broken.js", "not JavaScript");
  f.write("projects/plain/.generated/broken.js", "not JavaScript");
  f.write("projects/plain/.cache/broken.js", "not JavaScript");
  assert.equal(f.check("lint:js").status, 0);
  f.write("projects/plain/src/index.js", "export const value = missingName;\n");
  const failed = f.check("lint:js");
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout + failed.stderr, /no-undef/);
  f.write(
    "projects/plain/eslint.config.mjs",
    [
      "export default [",
      "{ ignores: ['.generated/**', '.cache/**'] },",
      "{ files: ['**/*.js'], rules: { 'no-undef': 'off' } }",
      "];\n",
    ].join("\n"),
  );
  assert.equal(f.check("lint:js").status, 0);
  assert.equal(
    fs.existsSync(path.join(f.root, "projects/plain/node_modules")),
    false,
  );
});

test("projects without JavaScript do not fail the shared ESLint check", (t) => {
  const f = fixture(t);
  f.write("projects/native/README.md", "Native project without JavaScript\n");
  const result = f.check("lint:js");
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("Hadolint shares shell defaults, honors project config and skips ignored inputs", (t) => {
  const binary = installedMiseTool("hadolint");
  if (!binary) return t.skip("hadolint is not installed");
  const f = fixture(t);
  const bin = path.join(f.temporary, "bin");
  fs.mkdirSync(bin);
  fs.symlinkSync(binary, path.join(bin, "hadolint"));
  const run = () =>
    f.run(process.execPath, [cli, "lint:dockerfile"], f.root, {
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    });
  f.write("projects/plain/.gitignore", ".generated/\nignored.Dockerfile\n");
  f.write(
    "projects/plain/Dockerfile",
    "FROM docker.io/library/alpine:3.23.0\n",
  );
  f.write("projects/plain/.generated/Dockerfile", "not a Dockerfile");
  f.write("projects/plain/ignored.Dockerfile", "not a Dockerfile");
  f.write("projects/submodules/independent/Dockerfile", "not a Dockerfile");
  assert.equal(run().status, 0);
  f.write("projects/plain/Dockerfile", "FROM alpine:latest\n");
  const failure = run();
  assert.equal(failure.status, 1, failure.stdout + failure.stderr);
  assert.match(failure.stdout + failure.stderr, /DL3007/);
  f.write(
    "projects/plain/.hadolint.yml",
    "failure-threshold: warning\nignored: [DL3007]\n",
  );
  const overridden = run();
  assert.equal(overridden.status, 0, overridden.stdout + overridden.stderr);
  f.write("projects/plain/Dockerfile.custom", "FROM alpine:latest\n");
  f.write("projects/plain/other.Containerfile", "FROM alpine:latest\n");
  assert.equal(run().status, 0);
  f.write(
    "projects/plain/.hadolint.yml",
    "failure-threshold: warning\ntrustedRegistries: [mcr.microsoft.com]\n",
  );
  for (const file of ["Dockerfile", "Dockerfile.custom", "other.Containerfile"])
    f.write(`projects/plain/${file}`, "FROM docker.io/library/alpine:3.23.0\n");
  const restricted = run();
  assert.equal(restricted.status, 1, restricted.stdout + restricted.stderr);
  assert.match(restricted.stdout + restricted.stderr, /DL3026/);
  f.write("untrusted.Dockerfile", "FROM docker.io/library/alpine:3.23.0\n");
  const shellRestriction = f.run(binary, [
    "--config",
    ".hadolint.yaml",
    "--trusted-registry",
    "mcr.microsoft.com",
    "untrusted.Dockerfile",
  ]);
  assert.equal(shellRestriction.status, 1);
  assert.match(shellRestriction.stdout + shellRestriction.stderr, /DL3026/);
});

test("ShellCheck inherits shell rules and honors a project override", (t) => {
  const binary = installedMiseTool("shellcheck");
  if (!binary) return t.skip("shellcheck is not installed");
  const f = fixture(t);
  f.write(
    "projects/plain/check.sh",
    "#!/usr/bin/env bash\nname='hello world'\nprintf '%s\\n' $name\n",
  );
  const args = ["projects/plain/check.sh"];
  const failure = f.run(binary, args);
  assert.equal(failure.status, 1, failure.stdout + failure.stderr);
  assert.match(failure.stdout + failure.stderr, /SC2086/);
  f.write("projects/plain/.shellcheckrc", "disable=SC2086\n");
  const overridden = f.run(binary, args);
  assert.equal(overridden.status, 0, overridden.stdout + overridden.stderr);
});

test("shared YAML check uses defaults then honors project-specific overrides", (t) => {
  const binary = installedMiseTool("yamllint");
  if (!binary) return t.skip("yamllint is not installed");
  const f = fixture(t);
  // Supply the installed binary through PATH without editing shared dependencies
  const bin = path.join(f.temporary, "bin");
  fs.mkdirSync(bin);
  fs.symlinkSync(binary, path.join(bin, "yamllint"));
  const env = { PATH: `${bin}${path.delimiter}${process.env.PATH}` };
  fs.unlinkSync(path.join(f.root, "projects/example/.yamllint.yaml"));
  f.write("projects/example/settings.yaml", "value: yes\n");
  const rejected = f.run(process.execPath, [cli, "lint:yaml"], f.root, env);
  assert.equal(rejected.status, 2, rejected.stdout + rejected.stderr);
  assert.match(rejected.stdout, /truthy/);
  f.write(
    "projects/example/.yamllint.yaml",
    "extends: default\nrules:\n  document-start: disable\n  truthy: disable\n",
  );
  const accepted = f.run(process.execPath, [cli, "lint:yaml"], f.root, env);
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
});

test("shared EditorConfig check respects project root and detects project violations", (t) => {
  const binary = path.join(
    repository,
    "node_modules/editorconfig-checker/bin/v4.0.1/editorconfig-checker",
  );
  if (!fs.existsSync(binary))
    return t.skip("EditorConfig checker core is not installed");
  const f = fixture(t);
  const bin = path.join(f.temporary, "bin");
  fs.mkdirSync(bin);
  // A project-local tool takes precedence over the organization default
  fs.mkdirSync(path.join(f.root, "projects/example/node_modules/.bin"), {
    recursive: true,
  });
  fs.symlinkSync(
    binary,
    path.join(
      f.root,
      "projects/example/node_modules/.bin/editorconfig-checker",
    ),
  );
  f.write("projects/example/indent.txt", "start\n    project indentation\n");
  f.git(
    "add",
    "--force",
    "projects/example/indent.txt",
    "projects/example/.editorconfig",
  );
  const result = f.check("lint:editorconfig");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  f.write("projects/example/indent.txt", "start\n  wrong indentation\n");
  const rejected = f.check("lint:editorconfig");
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  assert.match(rejected.stdout, /indent/i);
});

test("mise namespaces project tasks without changing root setup dispatch", (t) => {
  const available = spawnSync("mise", ["--version"], { encoding: "utf8" });
  if (available.status !== 0) return t.skip("mise is not installed");
  const f = fixture(t);
  fs.cpSync(path.join(repository, "mise.toml"), path.join(f.root, "mise.toml"));
  const result = f.run("mise", ["tasks", "ls", "--all", "--json"], f.root, {
    MISE_TRUSTED_CONFIG_PATHS: f.root,
    MISE_CACHE_DIR: path.join(f.temporary, "mise-cache"),
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const tasks = JSON.parse(result.stdout);
  assert.equal(
    tasks.find((task) => task.name === "//projects/example:test").dir,
    path.join(f.root, "projects/example"),
  );
  assert.equal(tasks.find((task) => task.name === "//:setup").dir, f.root);
  assert.ok(tasks.every((task) => !task.name.includes("submodules")));
});
