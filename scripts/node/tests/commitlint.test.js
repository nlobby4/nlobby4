/**
 * Verify commit policy, hook forwarding and pull-request range validation with
 * the installed Commitlint implementation and disposable Git repositories.
 *
 * @file Commitlint integration regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const rootRequire = createRequire(path.join(root, "package.json"));
const cliRequire = createRequire(rootRequire.resolve("@commitlint/cli"));
const { default: load } = await import(cliRequire.resolve("@commitlint/load"));
const { default: lint } = await import(cliRequire.resolve("@commitlint/lint"));
const config = await load({}, { cwd: root });
const options = {
  parserOpts: config.parserPreset.parserOpts,
  plugins: config.plugins,
  defaultIgnores: config.defaultIgnores,
};

for (const [name, message, valid, rule] of [
  ["optional scope", "fix: repair behavior", true],
  ["kebab scope", "fix(node-tools): repair behavior", true],
  ["empty scope", "fix(): repair behavior", false, "no-empty-scope"],
  ["space scope", "fix( ): repair behavior", false, "no-empty-scope"],
  ["tab scope", "fix(\t): repair behavior", false, "no-empty-scope"],
  [
    "breaking empty scope",
    "fix(  )!: repair behavior",
    false,
    "no-empty-scope",
  ],
  ["scope casing", "fix(node_tools): repair behavior", false, "scope-case"],
  ["unknown type", "unknown: repair behavior", false, "type-enum"],
  ["empty subject", "fix:", false, "subject-empty"],
  ["subject casing", "fix: Repair behavior", false, "subject-case"],
  ["subject period", "fix: repair behavior.", false, "subject-full-stop"],
  ["breaking header alone", "feat!: change behavior", true],
  [
    "breaking footer alone",
    "feat: change behavior\n\nBREAKING CHANGE: new interface",
    true,
  ],
  [
    "both breaking markers",
    "feat!: change behavior\n\nBREAKING CHANGE: new interface",
    true,
  ],
  [
    "body separator",
    "fix: repair behavior\nbody without a blank line",
    false,
    "body-leading-blank",
  ],
  ["generated merge", "Merge branch 'main'", true],
]) {
  test(name, async () => {
    const result = await lint(message, config.rules, options);
    assert.equal(result.valid, valid, JSON.stringify(result));
    if (rule)
      assert.ok(
        result.errors.some((error) => error.name === rule),
        JSON.stringify(result),
      );
  });
}

test("length limits remain warnings", async () => {
  const result = await lint(
    `fix: ${"a".repeat(80)}\n\n${"b".repeat(101)}`,
    config.rules,
    options,
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.warnings.map((warning) => warning.name).sort(), [
    "body-max-line-length",
    "header-max-length",
    "subject-max-length",
  ]);
});

test("body URL exemption remains available", async () => {
  const result = await lint(
    `fix: repair behavior\n\nhttps://example.invalid/${"a".repeat(120)}`,
    config.rules,
    options,
  );
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0);
});

test("prompt type choices match validation", () => {
  assert.deepEqual(
    Object.keys(config.prompt.questions.type.enum).sort(),
    [...config.rules["type-enum"][2]].sort(),
  );
});

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "commitlint-integration-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const bin = path.join(directory, "bin");
  mkdirSync(bin);
  mkdirSync(path.join(directory, "hooks"));
  const env = {
    ...process.env,
    HOME: directory,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    PATH: `${bin}:${process.env.PATH}`,
    NO_COLOR: "1",
    HUSKY: "1",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_CONFIG",
  ])
    delete env[key];
  const run = (command, args) =>
    spawnSync(command, args, {
      cwd: directory,
      env,
      encoding: "utf8",
      timeout: 20000,
    });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "--quiet");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.hooksPath", "hooks");
  cpSync(
    path.join(root, ".husky/commit-msg"),
    path.join(directory, "hooks/commit-msg"),
  );
  cpSync(
    path.join(root, "commitlint.config.js"),
    path.join(directory, "commitlint.config.js"),
  );
  writeFileSync(path.join(directory, "package.json"), '{"type":"module"}\n');
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(directory, "node_modules"),
    "dir",
  );
  const runner = path.join(root, "scripts/linux/commands/tasks/lint/commit.sh");
  // Dispatch only the hook's supported package command without installing tools
  writeFileSync(
    path.join(bin, "pnpm"),
    `#!/bin/sh\n[ "$1" = run ] && [ "$2" = lint:commit ] || exit 90\nshift 2\nexec bash ${JSON.stringify(runner)} "$@"\n`,
    { mode: 0o700 },
  );
  writeFileSync(
    path.join(bin, "commitlint"),
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(rootRequire.resolve("@commitlint/cli/cli.js"))} "$@"\n`,
    { mode: 0o700 },
  );
  return { directory, run, git, runner };
}

test("real Git hook preserves filename arguments and rejects invalid messages", (t) => {
  const f = fixture(t);
  const message = path.join(f.directory, "message with spaces");
  writeFileSync(message, "fix: repair behavior\n");
  const accepted = f.run("sh", ["hooks/commit-msg", message]);
  assert.equal(accepted.status, 0, accepted.stderr + accepted.stdout);
  f.git("commit", "--quiet", "--allow-empty", "-F", message);
  const before = f.git("rev-parse", "HEAD");
  writeFileSync(message, "fix( ): repair behavior\n");
  const rejected = f.run("git", [
    "commit",
    "--quiet",
    "--allow-empty",
    "-F",
    message,
  ]);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stdout + rejected.stderr, /no-empty-scope/);
  assert.equal(f.git("rev-parse", "HEAD"), before);
});

test("PR range detects invalid intermediate commits that --last misses", (t) => {
  const f = fixture(t);
  f.git("commit", "--quiet", "--allow-empty", "-m", "chore: initial state");
  const base = f.git("rev-parse", "HEAD");
  f.git("commit", "--quiet", "--allow-empty", "-m", "fix: valid change");
  const validTip = f.git("rev-parse", "HEAD");
  assert.equal(
    f.run("bash", [f.runner, "--from", base, "--to", validTip]).status,
    0,
  );
  f.git(
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "invalid message",
  );
  f.git("commit", "--quiet", "--allow-empty", "-m", "fix: valid tip");
  const tip = f.git("rev-parse", "HEAD");
  assert.equal(f.run("bash", [f.runner]).status, 0);
  assert.notEqual(
    f.run("bash", [f.runner, "--from", base, "--to", tip]).status,
    0,
  );
});

test("CI and editor preserve safe Commitlint integration", () => {
  const workflow = parse(
    readFileSync(path.join(root, ".github/workflows/ci-general.yml"), "utf8"),
  );
  const job = workflow.jobs.commitlint;
  assert.deepEqual(job.permissions, { contents: "read" });
  assert.equal(job.steps[0].with["fetch-depth"], 0);
  assert.equal(job.steps[0].with["persist-credentials"], false);
  assert.match(job.steps[0].uses, /^actions\/checkout@[a-f0-9]{40}$/);
  assert.equal(job.steps[1].uses, "./.github/actions/setup-node-deps");
  assert.deepEqual(job.steps[2].env, {
    PR_BASE_SHA: "${{ github.event.pull_request.base.sha }}",
    PR_HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
  });
  assert.equal(
    job.steps[2].run,
    'pnpm run lint:commit --from "$PR_BASE_SHA" --to "$PR_HEAD_SHA"',
  );
  assert.ok(workflow.on.pull_request);
  assert.equal(workflow.on.pull_request_target, undefined);
  const settings = JSON.parse(
    readFileSync(path.join(root, ".vscode/settings.json"), "utf8"),
  );
  assert.equal(settings["[git-commit]"]["editor.defaultFormatter"], null);
  assert.equal(settings["[git-commit]"]["editor.formatOnSave"], false);
  assert.doesNotMatch(
    readFileSync(path.join(root, ".husky/commit-msg"), "utf8"),
    /cspell/,
  );
});
