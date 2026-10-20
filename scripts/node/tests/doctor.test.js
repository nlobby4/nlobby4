/**
 * Verify safe repository repair and read-only diagnosis in disposable Git
 * repos.
 *
 * @file Repository doctor regression tests.
 */

import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const command = "scripts/linux/commands/repository/doctor.sh";

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "repository-doctor-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const home = path.join(directory, "home");
  const store = path.join(directory, "store");
  mkdirSync(home);
  mkdirSync(store);
  const env = {
    ...process.env,
    HOME: home,
    XDG_CONFIG_HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: path.join(home, "gitconfig"),
    GIT_CONFIG_COUNT: "0",
    NPM_CONFIG_STORE_DIR: store,
    HUSKY: "1",
    NO_COLOR: "1",
    MISE_AUTO_INSTALL: "false",
    MISE_NOT_FOUND_AUTO_INSTALL: "false",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_CONFIG",
    "GIT_INDEX_FILE",
  ]) {
    delete env[key];
  }
  const git = (...args) => {
    const result = spawnSync("git", args, {
      cwd: directory,
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git("init", "--quiet");
  git("config", "user.name", "Preserved Identity");
  git("config", "user.email", "preserved@example.invalid");
  git("config", "commit.gpgsign", "true");
  git("config", "user.signingkey", "preserved-key");
  mkdirSync(path.join(directory, path.dirname(command)), { recursive: true });
  cpSync(path.join(root, command), path.join(directory, command));
  cpSync(
    path.join(root, "scripts/linux/utils"),
    path.join(directory, "scripts/linux/utils"),
    { recursive: true },
  );
  mkdirSync(path.join(directory, ".husky"));
  for (const hook of ["pre-commit", "commit-msg"]) {
    writeFileSync(path.join(directory, ".husky", hook), "#!/bin/sh\nexit 0\n", {
      mode: 0o600,
    });
  }
  for (const file of [".gitmessage", ".git-blame-ignore-revs"]) {
    writeFileSync(path.join(directory, file), "# fixture\n");
  }
  cpSync(
    path.join(root, ".gitattributes"),
    path.join(directory, ".gitattributes"),
  );
  mkdirSync(path.join(directory, "node_modules/.bin"), { recursive: true });
  cpSync(
    path.join(root, "node_modules/husky"),
    path.join(directory, "node_modules/husky"),
    { recursive: true, dereference: true },
  );
  writeFileSync(
    path.join(directory, "node_modules/.bin/husky"),
    '#!/bin/sh\nexec node "$(dirname "$0")/../husky/bin.js" "$@"\n',
    { mode: 0o700 },
  );
  const run = (args = [], overrides = {}) =>
    spawnSync("bash", [command, ...args], {
      cwd: directory,
      env: { ...env, ...overrides },
      encoding: "utf8",
      timeout: 15000,
    });
  return { directory, env, git, run };
}

function snapshot(directory) {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name);
    const stat = lstatSync(file);
    if (name === ".git")
      return [[file, readFileSync(path.join(file, "config"), "utf8")]];
    if (name === "node_modules" || name === "store" || name === "home")
      return [];
    if (stat.isDirectory()) return [[file, stat.mode], ...snapshot(file)];
    if (stat.isSymbolicLink()) return [[file, "symlink", stat.mode]];
    return [[file, readFileSync(file, "utf8"), stat.mode]];
  });
}

test("doctor repairs local setup, preserves identity and is idempotent", (t) => {
  const { directory, run, git } = fixture(t);
  const file = path.join(directory, "scripts/a space\nand newline.sh");
  writeFileSync(file, "#!/bin/sh\nexit 0\n", { mode: 0o600 });
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(
    git("config", "--local", "filter.lfs.process"),
    "git-lfs filter-process",
  );
  assert.equal(git("config", "--local", "core.hooksPath"), ".husky/_");
  assert.equal(git("config", "--local", "--bool", "core.autocrlf"), "false");
  assert.equal(git("config", "--local", "--bool", "rerere.enabled"), "true");
  assert.equal(
    git("config", "--local", "--bool", "rerere.autoupdate"),
    "false",
  );
  assert.equal(git("config", "user.name"), "Preserved Identity");
  assert.equal(git("config", "user.email"), "preserved@example.invalid");
  assert.equal(git("config", "commit.gpgsign"), "true");
  assert.equal(git("config", "user.signingkey"), "preserved-key");
  assert.equal(lstatSync(file).mode & 0o777, 0o700);
  const before = snapshot(directory);
  assert.equal(run().status, 0);
  assert.deepEqual(snapshot(directory), before);
  assert.equal(run(["--check"]).status, 0);
  assert.deepEqual(snapshot(directory), before);
});

test("check-only reports missing setup without writing files or configuration", (t) => {
  const { directory, run } = fixture(t);
  const before = snapshot(directory);
  const result = run(["--check"]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /need attention/);
  assert.deepEqual(snapshot(directory), before);
});

for (const value of ["true", "input"]) {
  test(`doctor overrides global auto-CRLF ${value} locally without rewriting files`, (t) => {
    const { directory, run, git } = fixture(t);
    git("config", "--global", "core.autocrlf", value);
    const file = path.join(directory, "unchanged.txt");
    writeFileSync(file, "existing\r\ncontent\r\n");
    const index = git("ls-files", "--stage");
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(git("config", "--local", "--bool", "core.autocrlf"), "false");
    assert.equal(git("config", "--global", "core.autocrlf"), value);
    assert.equal(readFileSync(file, "utf8"), "existing\r\ncontent\r\n");
    assert.equal(git("ls-files", "--stage"), index);
    assert.equal(run(["--check"]).status, 0);
  });
  test(`doctor repairs local auto-CRLF ${value}`, (t) => {
    const { run, git } = fixture(t);
    git("config", "--local", "core.autocrlf", value);
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(git("config", "--local", "--bool", "core.autocrlf"), "false");
  });
}

test("doctor accepts normalized false and reports a higher-priority auto-CRLF override", (t) => {
  const { run, git } = fixture(t);
  git("config", "--local", "core.autocrlf", "off");
  assert.equal(run().status, 0);
  assert.equal(git("config", "--local", "core.autocrlf"), "off");
  const result = run([], {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.autocrlf",
    GIT_CONFIG_VALUE_0: "true",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /core.autocrlf is overridden/);
  assert.equal(git("config", "--local", "core.autocrlf"), "off");
});

test("missing managed files fail while independent repairs continue", (t) => {
  const { directory, run, git } = fixture(t);
  rmSync(path.join(directory, ".gitmessage"));
  const result = run();
  assert.equal(result.status, 1);
  assert.equal(git("config", "filter.lfs.required"), "true");
  assert.equal(git("config", "core.hooksPath"), ".husky/_");
  assert.equal(existsSync(path.join(directory, ".cache/commitizen")), true);
  assert.equal(existsSync(path.join(directory, ".gitmessage")), false);
});

for (const scope of ["--local", "--global"]) {
  test(`custom ${scope} hooks are preserved`, (t) => {
    const { directory, run, git } = fixture(t);
    git("config", scope, "core.hooksPath", "reviewed-hooks");
    const result = run();
    assert.equal(result.status, 1);
    assert.match(
      result.stdout + result.stderr,
      /Custom Git hook path preserved/,
    );
    assert.equal(git("config", scope, "core.hooksPath"), "reviewed-hooks");
    assert.equal(existsSync(path.join(directory, ".husky/_")), false);
  });
}

for (const location of [".cache", ".husky/_", "scripts/external.sh"]) {
  test(`symlink at ${location} is refused without altering the target`, (t) => {
    const { directory, run } = fixture(t);
    const target = path.join(directory, "outside");
    if (location.endsWith(".sh"))
      writeFileSync(target, "preserved\n", { mode: 0o600 });
    else mkdirSync(target);
    symlinkSync(target, path.join(directory, location));
    const before = lstatSync(target).mode;
    assert.equal(run().status, 1);
    assert.equal(lstatSync(target).mode, before);
    if (!location.endsWith(".sh")) assert.deepEqual(readdirSync(target), []);
  });
}

test("HUSKY=0 is an actionable failure, not successful hook installation", (t) => {
  const { directory, run } = fixture(t);
  assert.equal(run([], { HUSKY: "0" }).status, 1);
  assert.equal(existsSync(path.join(directory, ".husky/_")), false);
});

test("missing dependencies are reported and not installed", (t) => {
  const { directory, run } = fixture(t);
  rmSync(path.join(directory, "node_modules"), { recursive: true });
  const result = run();
  assert.equal(result.status, 1);
  assert.match(
    result.stdout + result.stderr,
    /install locked dependencies first/,
  );
  assert.equal(existsSync(path.join(directory, "node_modules")), false);
});

test("Husky zero exit without working hooks cannot produce success", (t) => {
  const { directory, run } = fixture(t);
  rmSync(path.join(directory, "node_modules/.bin/husky"));
  writeFileSync(
    path.join(directory, "node_modules/.bin/husky"),
    "#!/bin/sh\nexit 0\n",
    { mode: 0o700 },
  );
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Husky hooks needs attention/);
});

test("corrupted Husky runner is repaired and source hook content preserved", (t) => {
  const { directory, run } = fixture(t);
  assert.equal(run().status, 0);
  const source = readFileSync(
    path.join(directory, ".husky/pre-commit"),
    "utf8",
  );
  writeFileSync(path.join(directory, ".husky/_/h"), "corrupt runner\n");
  assert.equal(run(["--check"]).status, 1);
  assert.equal(run().status, 0);
  assert.equal(
    readFileSync(path.join(directory, ".husky/_/h"), "utf8"),
    readFileSync(path.join(directory, "node_modules/husky/husky"), "utf8"),
  );
  assert.equal(
    readFileSync(path.join(directory, ".husky/pre-commit"), "utf8"),
    source,
  );
});

test("executable but corrupted generated wrappers are detected and repaired", (t) => {
  const { directory, run } = fixture(t);
  assert.equal(run().status, 0);
  writeFileSync(
    path.join(directory, ".husky/_/pre-commit"),
    "#!/bin/sh\nexit 0\n",
  );
  assert.equal(run(["--check"]).status, 1);
  assert.equal(run().status, 0);
  assert.equal(run(["--check"]).status, 0);
});

test("effective Git overrides are reported rather than silently accepted", (t) => {
  const { run, git } = fixture(t);
  assert.equal(run().status, 0);
  const result = run([], {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "commit.template",
    GIT_CONFIG_VALUE_0: "external-template",
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /commit.template is overridden/);
  assert.equal(git("config", "--local", "commit.template"), ".gitmessage");
});

test("ignored scripts and unrelated hook files retain their modes", (t) => {
  const { directory, run, git } = fixture(t);
  writeFileSync(path.join(directory, ".gitignore"), "scripts/ignored.sh\n");
  for (const file of ["scripts/ignored.sh", ".husky/README.md"]) {
    writeFileSync(path.join(directory, file), "preserved\n", { mode: 0o600 });
  }
  writeFileSync(path.join(directory, "scripts/deleted.sh"), "deleted\n");
  git("add", "scripts/deleted.sh");
  rmSync(path.join(directory, "scripts/deleted.sh"));
  assert.equal(run().status, 0);
  for (const file of ["scripts/ignored.sh", ".husky/README.md"]) {
    assert.equal(lstatSync(path.join(directory, file)).mode & 0o777, 0o600);
  }
  assert.equal(existsSync(path.join(directory, "scripts/deleted.sh")), false);
});

test("missing shared pnpm store is reported without creating it", (t) => {
  const { directory, run } = fixture(t);
  const missing = path.join(directory, "uncreated-store");
  assert.equal(run([], { NPM_CONFIG_STORE_DIR: missing }).status, 1);
  assert.equal(existsSync(missing), false);
});

test("help and invalid options do not modify repository state", (t) => {
  const { directory, run } = fixture(t);
  const before = snapshot(directory);
  assert.equal(run(["--help"]).status, 0);
  assert.equal(run(["--invalid"]).status, 2);
  assert.deepEqual(snapshot(directory), before);
});

test("doctor rejects bare repositories", (t) => {
  const { directory, env } = fixture(t);
  const bare = path.join(directory, "bare.git");
  assert.equal(spawnSync("git", ["init", "--bare", bare], { env }).status, 0);
  const result = spawnSync("bash", [path.join(directory, command)], {
    cwd: bare,
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.equal(existsSync(path.join(bare, ".cache")), false);
});

test("readiness orchestration stays separate from repair", () => {
  const mise = readFileSync(path.join(root, "mise.toml"), "utf8");
  assert.match(
    mise,
    /\[tasks.doctor\][\s\S]*?run = "bash scripts\/linux\/commands\/repository\/doctor.sh"/,
  );
  assert.match(
    mise,
    /\[tasks.health\][\s\S]*?run = "bash scripts\/linux\/commands\/repository\/health.sh"/,
  );
  assert.doesNotMatch(
    readFileSync(
      path.join(root, "scripts/linux/commands/devcontainer/smoke.sh"),
      "utf8",
    ),
    /mise run doctor/,
  );
  assert.match(
    readFileSync(path.join(root, ".vscode/launch.json"), "utf8"),
    /"health"/,
  );
  assert.equal(
    existsSync(path.join(root, "scripts/linux/commands/repository/repair.sh")),
    false,
  );
  const setup = readFileSync(
    path.join(root, "scripts/linux/commands/repository/setup.sh"),
    "utf8",
  );
  assert.match(setup, /bash "\$SCRIPT_DIR\/doctor.sh"/);
  assert.match(setup, /git lfs pull/);
  assert.doesNotMatch(
    readFileSync(path.join(root, command), "utf8"),
    /git lfs (pull|checkout)/,
  );
});

test("global defaults do not make correct local settings appear overridden", (t) => {
  const { run, git } = fixture(t);
  git("config", "--global", "filter.lfs.required", "true");
  git("config", "--global", "commit.template", "global-template");
  assert.equal(run().status, 0);
  assert.equal(run(["--check"]).status, 0);
  assert.equal(git("config", "--global", "commit.template"), "global-template");
});

test("symlinked generated hook is refused and outside content preserved", (t) => {
  const { directory, run } = fixture(t);
  assert.equal(run().status, 0);
  const target = path.join(directory, "outside-hook");
  writeFileSync(target, "preserved\n", { mode: 0o600 });
  rmSync(path.join(directory, ".husky/_/pre-commit"));
  symlinkSync(target, path.join(directory, ".husky/_/pre-commit"));
  assert.equal(run().status, 1);
  assert.equal(readFileSync(target, "utf8"), "preserved\n");
  assert.equal(lstatSync(target).mode & 0o777, 0o600);
});

test("failed local tool invocation is reported while other checks continue", (t) => {
  const { directory, run } = fixture(t);
  writeFileSync(
    path.join(directory, "node_modules/.bin/husky"),
    "#!/bin/sh\nprintf 'fixture timed out\\n' >&2\nexit 124\n",
    { mode: 0o700 },
  );
  const result = run();
  assert.equal(result.status, 1);
  assert.match(
    result.stdout + result.stderr,
    /Husky installation failed: fixture timed out/,
  );
  assert.equal(existsSync(path.join(directory, ".cache/commitizen")), true);
});

test("linked worktrees are supported without replacing their Git metadata", (t) => {
  const { directory, env, git } = fixture(t);
  git("add", ".gitmessage", ".git-blame-ignore-revs", ".gitattributes");
  git("-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture");
  const worktree = path.join(directory, "worktree");
  git("worktree", "add", "--quiet", "-b", "fixture-worktree", worktree);
  for (const name of ["scripts", ".husky", "node_modules"]) {
    cpSync(path.join(directory, name), path.join(worktree, name), {
      recursive: true,
    });
  }
  const metadata = readFileSync(path.join(worktree, ".git"), "utf8");
  const result = spawnSync("bash", [command], {
    cwd: worktree,
    env,
    encoding: "utf8",
    timeout: 15000,
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(path.join(worktree, ".git"), "utf8"), metadata);
});

test("tracked sources beneath a symlinked parent cannot change outside modes", (t) => {
  const { directory, run, git } = fixture(t);
  mkdirSync(path.join(directory, "scripts/local"));
  writeFileSync(path.join(directory, "scripts/local/test.sh"), "preserved\n", {
    mode: 0o600,
  });
  git("add", "scripts/local/test.sh");
  rmSync(path.join(directory, "scripts/local"), { recursive: true });
  mkdirSync(path.join(directory, "outside"));
  const outside = path.join(directory, "outside/test.sh");
  writeFileSync(outside, "preserved\n", { mode: 0o600 });
  symlinkSync(
    path.join(directory, "outside"),
    path.join(directory, "scripts/local"),
  );
  assert.equal(run().status, 1);
  assert.equal(lstatSync(outside).mode & 0o777, 0o600);
});
