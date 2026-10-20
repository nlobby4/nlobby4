/**
 * Exercise Bash Git helper contracts without changing the working repository.
 *
 * @file Git utility regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const script = path.join(root, "scripts/linux/utils/functions/git.sh");
const environment = {
  ...process.env,
  GIT_TEST_SCRIPT: script,
  COLOR_MODE: "never",
  ASCII_ONLY: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_COUNT: "0",
};
for (const name of [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_PREFIX",
  "GIT_EXTERNAL_DIFF",
  "GIT_EXTERNAL_DIFF_TRUST_EXIT_CODE",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_SSH_VARIANT",
  "GIT_NO_LAZY_FETCH",
  "_REPOSITORY_GIT_REFRESH_STATUS",
  "_REPOSITORY_GIT_UPSTREAM_REMOTE",
  "_REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS",
]) {
  delete environment[name];
}

function execute(code, { cwd = root, args = [], env = {} } = {}) {
  const result = spawnSync(
    "bash",
    [
      "-euo",
      "pipefail",
      "-c",
      'source "$GIT_TEST_SCRIPT"; ' + code,
      "test",
      ...args,
    ],
    { cwd, encoding: "utf8", env: { ...environment, ...env }, timeout: 10000 },
  );
  assert.ifError(result.error);
  return result;
}

function statusFixture(directory) {
  for (const name of [
    "scripts/linux/utils",
    "scripts/linux/commands/repository/info.sh",
    "scripts/linux/commands/repository/validation/git-status.sh",
    "scripts/linux/commands/repository/validation/node-status.sh",
    "scripts/node/bin/terminal-text.js",
    "scripts/node/lib/terminal-lines.js",
  ]) {
    const destination = path.join(directory, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(root, name), destination, { recursive: true });
  }
  fs.symlinkSync(
    path.join(root, "scripts/node/node_modules"),
    path.join(directory, "scripts/node/node_modules"),
    "dir",
  );
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}\n');
  // Keep this integration focused on Bash upstream handling, not the Node readiness engine.
  fs.writeFileSync(
    path.join(directory, "scripts/node/bin/node-status.js"),
    'console.log(JSON.stringify([{label:"Node.js fixture",value:"ready",ok:true}]));\n',
  );
}

test("status callers and info refresh the actual non-origin upstream", () => {
  fixture((directory) => {
    const { publisher, checkout } = remoteFixture(directory);
    const team = path.join(directory, "team.git");
    git(directory, "clone", "-q", "--bare", publisher, team);
    git(checkout, "remote", "add", "team", team);
    git(checkout, "fetch", "-q", "team");
    git(checkout, "config", "branch.main.remote", "team");
    git(publisher, "remote", "add", "team", team);
    const initial = git(checkout, "rev-parse", "team/main").trim();
    const changed = commit(publisher, '{"dependencies":{"fixture":"1.0.0"}}');
    git(publisher, "push", "-q", "team", "main");
    statusFixture(checkout);
    for (const status of ["git", "node"]) {
      git(checkout, "update-ref", "refs/remotes/team/main", initial);
      const result = execute(
        `bash scripts/linux/commands/repository/validation/${status}-status.sh`,
        {
          cwd: checkout,
          env: {
            _REPOSITORY_GIT_REFRESH_STATUS: "0",
            _REPOSITORY_GIT_UPSTREAM_REMOTE: "unrelated",
            _REPOSITORY_GIT_UPSTREAM_REFRESH_STATUS: "0",
          },
        },
      );
      assert.equal(
        git(checkout, "rev-parse", "team/main").trim(),
        changed,
        result.stderr,
      );
      assert.match(
        result.stdout,
        status === "git" ?
          /1 commit behind team\/main/u
        : /upstream has dependency changes/u,
      );
    }
    git(checkout, "update-ref", "refs/remotes/team/main", initial);
    const report = execute("bash scripts/linux/commands/repository/info.sh", {
      cwd: checkout,
    });
    assert.equal(
      git(checkout, "rev-parse", "team/main").trim(),
      changed,
      report.stderr,
    );
    assert.match(report.stdout, /1 commit behind team\/main/u);
    assert.match(report.stdout, /upstream has dependency changes/u);
    // An upstream does not require an origin remote to be configured.
    git(checkout, "remote", "remove", "origin");
    git(checkout, "update-ref", "refs/remotes/team/main", initial);
    const withoutOrigin = execute(
      "bash scripts/linux/commands/repository/validation/git-status.sh",
      { cwd: checkout },
    );
    assert.match(withoutOrigin.stdout, /1 commit behind team\/main/u);
  });
});

test("local and invalid upstream configurations have explicit contracts", () => {
  fixture((directory) => {
    repository(directory);
    commit(directory, "{}");
    git(directory, "branch", "other");
    git(directory, "config", "branch.main.remote", ".");
    git(directory, "config", "branch.main.merge", "refs/heads/other");
    const result = execute(
      "_git_noninteractive(){ return 99; }; git_refresh_upstream; git_upstream_remote; git_upstream_ref",
      { cwd: directory },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, ".\nrefs/heads/other\n");
    git(directory, "config", "--add", "branch.main.merge", "refs/heads/main");
    const ambiguous = execute("git_upstream_ref", { cwd: directory });
    assert.equal(ambiguous.status, 2);
    assert.match(ambiguous.stderr, /one branch/u);
  });
});

test(
  "network deadline kills TERM-resistant transport processes",
  { timeout: 25000 },
  () => {
    fixture((directory) => {
      repository(directory);
      git(
        directory,
        "remote",
        "add",
        "origin",
        "ssh://fixture.invalid/remote.git",
      );
      const transport = path.join(directory, "transport.sh");
      const parentFile = path.join(directory, "transport.pid");
      const childFile = path.join(directory, "sleep.pid");
      fs.writeFileSync(
        transport,
        'trap "" TERM\nprintf "%s\\n" "$$" > "$TRANSPORT_PID_FILE"\nsleep 60 &\nprintf "%s\\n" "$!" > "$TRANSPORT_CHILD_FILE"\nwait\n',
      );
      const result = spawnSync(
        "bash",
        [
          "-euo",
          "pipefail",
          "-c",
          'source "$GIT_TEST_SCRIPT"; git_refresh_upstream origin',
        ],
        {
          cwd: directory,
          env: {
            ...environment,
            GIT_SSH_VARIANT: "ssh",
            GIT_SSH_COMMAND: `bash '${transport}'`,
            TRANSPORT_PID_FILE: parentFile,
            TRANSPORT_CHILD_FILE: childFile,
          },
          encoding: "utf8",
          timeout: 22000,
        },
      );
      // Always clean up exact fixture PIDs even if the regression fails.
      const pids = [parentFile, childFile]
        .filter((file) => fs.existsSync(file))
        .map((file) => Number(fs.readFileSync(file, "utf8").trim()));
      try {
        assert.ifError(result.error);
        assert.equal(result.status, 2, result.stderr);
        assert.equal(pids.length, 2);
        for (const pid of pids) {
          const processState = spawnSync(
            "ps",
            ["-o", "stat=", "-p", String(pid)],
            { encoding: "utf8" },
          );
          assert.ok(
            processState.status === 1
              || processState.stdout.trim().startsWith("Z"),
            `transport survived: ${pid} ${processState.stdout}`,
          );
        }
      } finally {
        pids.forEach((pid) => {
          try {
            process.kill(pid, "SIGKILL");
          } catch (error) {
            if (error.code !== "ESRCH") throw error;
          }
        });
      }
    });
  },
);

function check(name, args, expected, options = {}) {
  const result = execute('"$@"', { ...options, args: [name, ...args] });
  assert.equal(result.status, expected, result.stderr);
  assert.equal(result.stdout, "");
  if (expected === 0) assert.equal(result.stderr, "");
  else assert.match(result.stderr, /\[ERROR\]:/u);
}

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "git-utils-"));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function git(directory, ...args) {
  const result = spawnSync("git", ["-C", directory, ...args], {
    env: environment,
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function repository(directory) {
  git(directory, "init", "-q", "-b", "main");
  git(directory, "config", "user.name", "Test");
  git(directory, "config", "user.email", "test@example.com");
  git(directory, "config", "commit.gpgsign", "false");
}

function commit(directory, value) {
  fs.writeFileSync(path.join(directory, "package.json"), `${value}\n`);
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "fixture change");
  return git(directory, "rev-parse", "HEAD").trim();
}

function remoteFixture(directory) {
  const publisher = path.join(directory, "publisher");
  const remote = path.join(directory, "remote.git");
  const checkout = path.join(directory, "checkout");
  fs.mkdirSync(publisher);
  repository(publisher);
  commit(publisher, "{}");
  git(directory, "clone", "-q", "--bare", publisher, remote);
  git(publisher, "remote", "add", "origin", remote);
  git(directory, "clone", "-q", remote, checkout);
  git(checkout, "config", "user.name", "Test");
  git(checkout, "config", "user.email", "test@example.com");
  git(checkout, "config", "commit.gpgsign", "false");
  return { publisher, remote, checkout };
}

test("refresh preserves local branches, tags and FETCH_HEAD despite unsafe configuration", () => {
  fixture((directory) => {
    const { publisher, checkout } = remoteFixture(directory);
    git(publisher, "checkout", "-qb", "topic");
    commit(publisher, '{"remote":true}');
    git(publisher, "push", "-q", "origin", "topic");
    git(checkout, "checkout", "-qb", "topic");
    const localTopic = commit(checkout, '{"local":true}');
    git(checkout, "checkout", "-q", "main");
    git(checkout, "tag", "local-only");
    git(publisher, "tag", "remote-only");
    git(publisher, "push", "-q", "origin", "--tags");
    git(checkout, "config", "fetch.pruneTags", "true");
    git(checkout, "config", "remote.origin.pruneTags", "true");
    git(
      checkout,
      "config",
      "--add",
      "remote.origin.fetch",
      "+refs/tags/*:refs/tags/*",
    );
    git(
      checkout,
      "config",
      "--add",
      "remote.origin.fetch",
      "+refs/heads/topic:refs/heads/topic",
    );
    const fetchHead = path.join(checkout, ".git/FETCH_HEAD");
    fs.writeFileSync(fetchHead, "caller-owned sentinel\n");
    const result = execute("git_refresh_upstream origin", { cwd: checkout });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(git(checkout, "rev-parse", "topic").trim(), localTopic);
    git(checkout, "show-ref", "--verify", "refs/tags/local-only");
    assert.equal(git(checkout, "tag", "--list", "remote-only"), "");
    assert.equal(fs.readFileSync(fetchHead, "utf8"), "caller-owned sentinel\n");
    assert.equal(
      git(checkout, "rev-parse", "refs/remotes/origin/topic"),
      git(publisher, "rev-parse", "topic"),
    );
    git(checkout, "config", "branch.main.merge", "refs/heads/topic");
    assert.equal(
      execute("git_upstream_ref", { cwd: checkout }).stdout,
      "refs/remotes/origin/topic\n",
    );
  });
});

test("refresh supplies missing mappings and prunes only its tracking namespace", () => {
  fixture((directory) => {
    const { publisher, checkout } = remoteFixture(directory);
    const original = git(checkout, "rev-parse", "HEAD");
    git(checkout, "config", "--unset-all", "remote.origin.fetch");
    git(checkout, "update-ref", "refs/remotes/origin/deleted", original.trim());
    git(checkout, "update-ref", "refs/remotes/team/preserved", original.trim());
    const changed = commit(publisher, '{"new":true}');
    git(publisher, "push", "-q", "origin", "main");
    assert.equal(
      execute("git_refresh_upstream origin", { cwd: checkout }).status,
      0,
    );
    assert.equal(
      git(checkout, "rev-parse", "refs/remotes/origin/main").trim(),
      changed,
    );
    assert.equal(git(checkout, "rev-parse", "HEAD"), original);
    assert.equal(
      git(
        checkout,
        "for-each-ref",
        "--format=%(refname)",
        "refs/remotes/origin/deleted",
      ),
      "",
    );
    git(checkout, "show-ref", "--verify", "refs/remotes/team/preserved");
  });
});

test("automatic refresh refuses overlapping remote namespaces", () => {
  fixture((directory) => {
    const { remote, checkout } = remoteFixture(directory);
    // Modern `git remote add` refuses this combination, but hand-written or
    // older configuration can still contain overlapping namespaces.
    git(checkout, "config", "remote.origin/team.url", remote);
    const result = execute(
      "_git_noninteractive(){ return 99; }; git_refresh_upstream origin",
      { cwd: checkout },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /overlapping git remote namespaces/u);
  });
});

test("comparison pins commits even if an upstream ref moves during inspection", () => {
  fixture((directory) => {
    repository(directory);
    commit(directory, "{}");
    git(directory, "checkout", "-qb", "upstream");
    commit(directory, '{"changed":true}');
    git(directory, "checkout", "-q", "main");
    const result = execute(
      'git(){ if [[ ${1:-} == --no-lazy-fetch && ${2:-} == diff ]]; then command git update-ref refs/heads/upstream HEAD; fi; command git "$@"; }; git_upstream_paths_changed upstream package.json',
      { cwd: directory },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      git(directory, "rev-parse", "upstream"),
      git(directory, "rev-parse", "HEAD"),
    );
  });
});

test("comparison reports unborn HEAD, unrelated histories and option-like refs as failures", () => {
  fixture((directory) => {
    repository(directory);
    assert.equal(
      execute("git_upstream_paths_changed HEAD package.json", {
        cwd: directory,
      }).status,
      2,
    );
    commit(directory, "{}");
    git(directory, "checkout", "-q", "--orphan", "unrelated");
    commit(directory, '{"unrelated":true}');
    git(directory, "checkout", "-q", "main");
    for (const ref of ["unrelated", "--help", "missing"]) {
      const result = execute('git_upstream_paths_changed "$1" package.json', {
        cwd: directory,
        args: [ref],
      });
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /unable to/u);
    }
  });
});

test("failed refresh updates no tracking refs when one destination is locked", () => {
  fixture((directory) => {
    const { publisher, checkout } = remoteFixture(directory);
    const original = git(checkout, "rev-parse", "origin/main");
    git(checkout, "update-ref", "refs/remotes/origin/deleted", original.trim());
    git(publisher, "checkout", "-qb", "a-new");
    commit(publisher, '{"branch":true}');
    git(publisher, "checkout", "-q", "main");
    commit(publisher, '{"main":true}');
    git(publisher, "push", "-q", "origin", "main", "a-new");
    fs.writeFileSync(
      path.join(checkout, ".git/refs/remotes/origin/main.lock"),
      "",
    );
    const result = execute("git_refresh_upstream origin", { cwd: checkout });
    assert.equal(result.status, 2, result.stderr);
    assert.equal(git(checkout, "rev-parse", "origin/main"), original);
    git(checkout, "show-ref", "--verify", "refs/remotes/origin/deleted");
    assert.equal(
      git(
        checkout,
        "for-each-ref",
        "--format=%(refname)",
        "refs/remotes/origin/a-new",
      ),
      "",
    );
  });
});

for (const mode of ["external", "textconv", "submodule"]) {
  test(`comparison ignores ${mode} display preferences`, () => {
    fixture((directory) => {
      repository(directory);
      if (mode === "textconv")
        fs.writeFileSync(
          path.join(directory, ".gitattributes"),
          "package.json diff=constant\n",
        );
      const first = commit(directory, "{}");
      const second = commit(directory, '{"changed":true}');
      if (mode === "submodule") {
        git(
          directory,
          "update-index",
          "--add",
          "--cacheinfo",
          `160000,${first},module`,
        );
        git(directory, "commit", "-qm", "initial gitlink");
      }
      git(directory, "branch", "upstream");
      git(directory, "checkout", "-q", "upstream");
      if (mode === "submodule") {
        git(
          directory,
          "update-index",
          "--cacheinfo",
          `160000,${second},module`,
        );
        git(directory, "commit", "-qm", "updated gitlink");
        git(directory, "config", "diff.ignoreSubmodules", "all");
      } else {
        commit(directory, '{"upstream":true}');
        git(
          directory,
          "config",
          mode === "external" ? "diff.external" : "diff.constant.textconv",
          "/bin/true",
        );
        git(directory, "config", "diff.trustExitCode", "true");
      }
      git(directory, "checkout", "-q", "main");
      const result = execute('git_upstream_paths_changed upstream "$1"', {
        cwd: directory,
        args: [mode === "submodule" ? "module" : "package.json"],
      });
      assert.equal(result.status, 0, result.stderr);
    });
  });
}

test("comparison rejects ambiguous criss-cross merge bases", () => {
  fixture((directory) => {
    repository(directory);
    const initial = commit(directory, "{}");
    const tree = git(directory, "rev-parse", "HEAD^{tree}").trim();
    commit(directory, '{"changed":true}');
    const changedTree = git(directory, "rev-parse", "HEAD^{tree}").trim();
    const a = git(
      directory,
      "commit-tree",
      tree,
      "-p",
      initial,
      "-m",
      "A",
    ).trim();
    const b = git(
      directory,
      "commit-tree",
      changedTree,
      "-p",
      initial,
      "-m",
      "B",
    ).trim();
    const left = git(
      directory,
      "commit-tree",
      tree,
      "-p",
      a,
      "-p",
      b,
      "-m",
      "left",
    ).trim();
    const right = git(
      directory,
      "commit-tree",
      tree,
      "-p",
      b,
      "-p",
      a,
      "-m",
      "right",
    ).trim();
    git(directory, "update-ref", "refs/heads/main", left);
    git(directory, "update-ref", "refs/heads/upstream", right);
    const result = execute("git_upstream_paths_changed upstream package.json", {
      cwd: directory,
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /multiple merge bases/u);
  });
});

test("partial-clone comparisons fail locally without fetching missing objects", () => {
  fixture((directory) => {
    const { publisher, remote } = remoteFixture(directory);
    git(publisher, "checkout", "-qb", "topic");
    commit(publisher, '{"changed":true}');
    git(publisher, "push", "-q", "origin", "topic");
    git(remote, "config", "uploadpack.allowFilter", "true");
    const partial = path.join(directory, "partial");
    git(
      directory,
      "clone",
      "-q",
      "--no-checkout",
      "--filter=tree:0",
      `file://${remote}`,
      partial,
    );
    const trace = path.join(directory, "trace.jsonl");
    const result = execute(
      "git_upstream_paths_changed origin/topic package.json",
      { cwd: partial, env: { GIT_TRACE2_EVENT: trace } },
    );
    assert.equal(result.status, 2, result.stderr);
    const events = fs
      .readFileSync(trace, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      events.filter(
        (event) =>
          event.event === "child_start" && event.argv?.includes("fetch"),
      ).length,
      0,
    );
    // Simulate Git before --no-lazy-fetch without requiring another installed Git.
    const legacy = execute(
      'git(){ if [[ ${1:-} == --no-lazy-fetch ]]; then return 129; fi; command git "$@"; }; git_upstream_paths_changed origin/topic package.json',
      { cwd: partial },
    );
    assert.equal(legacy.status, 2, legacy.stderr);
  });
});

test("legacy Git still compares ordinary repositories without requiring a new flag", () => {
  fixture((directory) => {
    repository(directory);
    commit(directory, "{}");
    const result = execute(
      'git(){ if [[ ${1:-} == --no-lazy-fetch ]]; then return 129; fi; command git "$@"; }; git_upstream_paths_changed HEAD package.json',
      { cwd: directory },
    );
    assert.equal(result.status, 1, result.stderr);
  });
});

test("Git module guards and sourcing do not execute Git", () => {
  const direct = spawnSync("bash", [script], { encoding: "utf8" });
  assert.equal(direct.status, 1);
  assert.match(direct.stderr, /meant to be sourced/u);
  const result = execute(
    'git(){ return 99; }; before=$(set +o); before_dir=$PWD; source "$GIT_TEST_SCRIPT"; [[ $(set +o) == "$before" && $PWD == "$before_dir" && $_GIT_LOADED == 1 ]]',
  );
  assert.equal(result.status, 0, result.stderr);
});

test("failed Git initialization can be retried", () => {
  fixture((directory) => {
    fs.cpSync(path.join(root, "scripts/linux/utils"), directory, {
      recursive: true,
    });
    const dependency = path.join(directory, "functions/core.sh");
    fs.renameSync(dependency, `${dependency}.off`);
    const result = spawnSync(
      "bash",
      [
        "-euo",
        "pipefail",
        "-c",
        'if source "$1/functions/git.sh"; then exit 3; fi; [[ -z ${_GIT_LOADED:-} ]]; mv "$1/functions/core.sh.off" "$1/functions/core.sh"; source "$1/functions/git.sh"; check_command bash; ! declare -F check_file',
        "test",
        directory,
      ],
      { encoding: "utf8", env: environment },
    );
    assert.equal(result.status, 0, result.stderr);
  });
});

test("Git checks handle absent, unborn and bare repositories", () => {
  fixture((directory) => {
    check("check_git_repo", [], 1, { cwd: directory });
    check("check_repository_root", [], 1, { cwd: directory });
    repository(directory);
    check("check_git_repo", [], 0, { cwd: directory });
    check("check_repository_root", [], 0, { cwd: directory });
    const bare = path.join(directory, "bare.git");
    git(directory, "init", "-q", "--bare", bare);
    check("check_git_repo", [], 0, { cwd: bare });
    check("check_repository_root", [], 1, { cwd: bare });
  });
});
test("repository roots support symlinks and trailing newlines", () => {
  fixture((directory) => {
    const repo = path.join(directory, "repo\n");
    fs.mkdirSync(repo);
    repository(repo);
    const alias = path.join(directory, "alias");
    fs.symlinkSync(repo, alias, "dir");
    check("check_repository_root", [], 0, { cwd: repo });
    check("check_repository_root", [], 0, { cwd: alias });
    const sub = path.join(repo, "sub");
    fs.mkdirSync(sub);
    check("check_repository_root", [], 1, { cwd: sub });
    check("check_git_repo", [], 0, { cwd: sub });
  });
});
test("linked worktrees and detached HEAD are valid roots", () => {
  fixture((directory) => {
    repository(directory);
    git(directory, "commit", "-q", "--allow-empty", "-m", "initial");
    const worktree = path.join(directory, "linked");
    git(directory, "worktree", "add", "-q", "--detach", worktree);
    check("check_git_repo", [], 0, { cwd: worktree });
    check("check_repository_root", [], 0, { cwd: worktree });
  });
});

test("local upstream fetch, default branch and changed paths work end to end", () => {
  fixture((directory) => {
    const publisher = path.join(directory, "publisher");
    const remote = path.join(directory, "remote.git");
    const checkout = path.join(directory, "checkout");
    fs.mkdirSync(publisher);
    repository(publisher);
    git(publisher, "branch", "-m", "trunk");
    fs.writeFileSync(path.join(publisher, "package.json"), "{}\n");
    git(publisher, "add", ".");
    git(publisher, "commit", "-q", "-m", "initial");
    git(directory, "clone", "-q", "--bare", publisher, remote);
    git(directory, "clone", "-q", remote, checkout);
    git(publisher, "remote", "add", "origin", remote);
    const initial = git(checkout, "rev-parse", "origin/trunk");
    const defaultBranch = execute("git_remote_default_branch origin", {
      cwd: checkout,
    });
    assert.equal(defaultBranch.status, 0, defaultBranch.stderr);
    assert.equal(defaultBranch.stdout, "trunk\n");
    assert.equal(
      execute("git_upstream_paths_changed origin/trunk package.json", {
        cwd: checkout,
      }).status,
      1,
    );
    fs.writeFileSync(
      path.join(publisher, "package.json"),
      '{"version":"1.0.0"}\n',
    );
    git(publisher, "add", ".");
    git(publisher, "commit", "-q", "-m", "dependency change");
    git(publisher, "push", "-q", "origin", "trunk");
    assert.equal(git(checkout, "rev-parse", "origin/trunk"), initial);
    const refresh = execute("git_refresh_upstream", { cwd: checkout });
    assert.equal(refresh.status, 0, refresh.stderr);
    assert.notEqual(git(checkout, "rev-parse", "origin/trunk"), initial);
    assert.equal(
      execute("git_upstream_paths_changed origin/trunk package.json", {
        cwd: checkout,
      }).status,
      0,
    );
    assert.equal(
      execute("git_upstream_paths_changed origin/trunk unrelated", {
        cwd: checkout,
      }).status,
      1,
    );
    assert.equal(
      execute("git_upstream_paths_changed missing package.json", {
        cwd: checkout,
      }).status,
      2,
    );
    assert.equal(
      execute("git_upstream_paths_changed origin/trunk", { cwd: checkout })
        .status,
      2,
    );
    assert.equal(
      execute("git_refresh_upstream missing", { cwd: checkout }).status,
      1,
    );
    assert.equal(
      execute("git_remote_default_branch missing", { cwd: checkout }).status,
      1,
    );
    assert.equal(
      execute("git_refresh_upstream .", { cwd: checkout }).status,
      0,
    );
    git(checkout, "checkout", "-q", "--detach");
    assert.equal(execute("git_refresh_upstream", { cwd: checkout }).status, 1);
    git(
      checkout,
      "remote",
      "set-url",
      "origin",
      path.join(directory, "missing.git"),
    );
    const failed = execute("git_refresh_upstream origin", { cwd: checkout });
    assert.equal(failed.status, 2);
    assert.match(failed.stderr, /unable to fetch git remote/u);
  });
});

test("network helper enforces noninteractive credentials and a timeout", () => {
  const result = execute(
    "timeout(){ if [[ $1 == --version ]]; then printf '%s\\n' 'timeout (GNU coreutils) fixture'; return; fi; [[ $1 == --signal=KILL && $2 == 15s && $3 == git && $4 == -c && $5 == credential.interactive=false && $6 == fetch && $GIT_TERMINAL_PROMPT == 0 && $GIT_ASKPASS == /bin/false && $GCM_INTERACTIVE == Never && $SSH_ASKPASS == /bin/false && $SSH_ASKPASS_REQUIRE == force ]]; }; _git_noninteractive fetch",
  );
  assert.equal(result.status, 0, result.stderr);
});

test("network helper selects GNU timeout aliases and rejects incompatible providers", () => {
  for (const candidate of ["gtimeout", "gnutimeout"]) {
    const result = execute(
      `timeout(){ printf '%s\\n' 'timeout (uutils coreutils) fixture'; }; command(){ if [[ $3 == '${candidate}' || $3 == timeout ]]; then return 0; fi; return 1; }; ${candidate}(){ if [[ $1 == --version ]]; then printf '%s\\n' 'timeout (GNU coreutils) fixture'; else [[ $1 == --signal=KILL && $2 == 15s ]]; fi; }; _git_noninteractive fetch`,
    );
    assert.equal(result.status, 0, result.stderr);
  }
  const unsupported = execute(
    "timeout(){ printf '%s\\n' 'timeout (uutils coreutils) fixture'; }; command(){ [[ $3 == timeout ]]; }; _git_noninteractive fetch",
  );
  assert.equal(unsupported.status, 2);
  assert.match(
    unsupported.stderr,
    /no matching command available.*GNU coreutils/u,
  );
  const failedVersion = execute(
    "timeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; return 7; }; gtimeout(){ printf '%s\\n' 'timeout (GNU coreutils) fixture'; }; command(){ [[ ${*: -1} == timeout || ${*: -1} == gtimeout ]]; }; find_timeout",
  );
  assert.equal(failedVersion.status, 0, failedVersion.stderr);
  assert.equal(failedVersion.stdout, "gtimeout\n");
});

test("default branch lookup reports a missing timeout as a requirements failure", () => {
  fixture((directory) => {
    repository(directory);
    git(directory, "remote", "add", "origin", directory);
    const result = execute(
      'command(){ case ${*: -1} in timeout|gtimeout|gnutimeout) return 1;; *) builtin command "$@";; esac; }; git_remote_default_branch origin',
      { cwd: directory },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /no matching command available.*timeout/u);
  });
});

test("upstream helpers report a missing Git command", () => {
  for (const call of [
    "git_refresh_upstream origin",
    "git_remote_default_branch origin",
    "git_upstream_paths_changed HEAD package.json",
  ]) {
    const result = execute(`command(){ return 1; }; ${call}`);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /git is required but is not available/u);
    assert.equal(result.stderr.trimEnd().split("\n").length, 1);
  }
});

const lfsAvailable =
  spawnSync("git", ["lfs", "version"], { env: environment }).status === 0;
const lfsValues = {
  clean: "git-lfs clean -- %f",
  smudge: "git-lfs smudge -- %f",
  process: "git-lfs filter-process",
  required: "true",
};
test("Git-dependent checks report a missing Git command", () => {
  for (const name of [
    "check_git_repo",
    "check_git_lfs",
    "check_git_lfs_configured",
    "check_repository_root",
  ]) {
    const result = execute(`command(){ return 1; }; ${name}`);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /git is required/u);
  }
});

function configureLfs(directory) {
  for (const [key, value] of Object.entries(lfsValues)) {
    git(directory, "config", "--local", `filter.lfs.${key}`, value);
  }
}
test("LFS command failure is reported independently of Git availability", () => {
  const result = execute("git(){ return 7; }; check_git_lfs");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /git lfs is required/u);
});
test("LFS validates actual local installation", { skip: !lfsAvailable }, () => {
  fixture((directory) => {
    repository(directory);
    check("check_git_lfs", [], 0, { cwd: directory });
    check("check_git_lfs_configured", [], 1, { cwd: directory });
    git(directory, "lfs", "install", "--local");
    check("check_git_lfs_configured", [], 0, { cwd: directory });
  });
});
test(
  "LFS repository-local configuration also works in an unborn bare repository",
  { skip: !lfsAvailable },
  () => {
    fixture((directory) => {
      git(directory, "init", "-q", "--bare");
      configureLfs(directory);
      check("check_git_lfs_configured", [], 0, { cwd: directory });
    });
  },
);

for (const key of Object.keys(lfsValues)) {
  test(`LFS rejects missing or wrong ${key}`, { skip: !lfsAvailable }, () => {
    fixture((directory) => {
      repository(directory);
      configureLfs(directory);
      git(directory, "config", "--local", "--unset", `filter.lfs.${key}`);
      check("check_git_lfs_configured", [], 1, { cwd: directory });
      git(
        directory,
        "config",
        "--local",
        `filter.lfs.${key}`,
        key === "required" ? "false" : "wrong-filter",
      );
      check("check_git_lfs_configured", [], 1, { cwd: directory });
    });
  });
  test(
    `LFS rejects worktree override of ${key}`,
    { skip: !lfsAvailable },
    () => {
      fixture((directory) => {
        repository(directory);
        configureLfs(directory);
        git(directory, "config", "extensions.worktreeConfig", "true");
        git(
          directory,
          "config",
          "--worktree",
          `filter.lfs.${key}`,
          key === "required" ? "false" : "wrong-filter",
        );
        check("check_git_lfs_configured", [], 1, { cwd: directory });
        git(
          directory,
          "config",
          "--worktree",
          `filter.lfs.${key}`,
          lfsValues[key],
        );
        check("check_git_lfs_configured", [], 0, { cwd: directory });
      });
    },
  );
}
test(
  "LFS handles boolean synonyms and rejects runtime overrides",
  { skip: !lfsAvailable },
  () => {
    fixture((directory) => {
      repository(directory);
      configureLfs(directory);
      for (const value of ["yes", "on", "1"]) {
        git(directory, "config", "filter.lfs.required", value);
        check("check_git_lfs_configured", [], 0, { cwd: directory });
      }
      check("check_git_lfs_configured", [], 1, {
        cwd: directory,
        env: {
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "filter.lfs.required",
          GIT_CONFIG_VALUE_0: "false",
        },
      });
    });
  },
);
test(
  "global-only LFS configuration does not replace repository initialization",
  { skip: !lfsAvailable },
  () => {
    fixture((directory) => {
      repository(directory);
      const global = path.join(directory, "global.cfg");
      for (const [key, value] of Object.entries(lfsValues)) {
        git(directory, "config", "--file", global, `filter.lfs.${key}`, value);
      }
      check("check_git_lfs_configured", [], 1, {
        cwd: directory,
        env: { GIT_CONFIG_GLOBAL: global },
      });
    });
  },
);
test(
  "local includes that override LFS are rejected",
  { skip: !lfsAvailable },
  () => {
    fixture((directory) => {
      repository(directory);
      configureLfs(directory);
      const included = path.join(directory, "override.cfg");
      git(
        directory,
        "config",
        "--file",
        included,
        "filter.lfs.required",
        "false",
      );
      git(directory, "config", "--local", "include.path", included);
      check("check_git_lfs_configured", [], 1, { cwd: directory });
    });
  },
);
