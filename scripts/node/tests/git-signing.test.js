/** Verify signing against disposable keys without touching the caller's keyring. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const helper = fileURLToPath(
  new URL("../../python/git-signing-check.py", import.meta.url),
);

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "signing-test-"));
  const repo = path.join(root, "repository");
  const temporary = path.join(root, "temporary");
  const home = path.join(root, "gpg");
  for (const directory of [repo, temporary, home])
    fs.mkdirSync(directory, { mode: 0o700 });
  const env = {
    ...process.env,
    GNUPGHOME: home,
    TMPDIR: temporary,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    SSH_AUTH_SOCK: "",
  };
  for (const name of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_CONFIG_COUNT",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_AUTHOR_NAME",
    "GIT_AUTHOR_EMAIL",
    "GIT_COMMITTER_NAME",
    "GIT_COMMITTER_EMAIL",
  ])
    delete env[name];
  t.after(() => {
    spawnSync("gpgconf", ["--homedir", home, "--kill", "gpg-agent"], {
      env,
      timeout: 5000,
    });
    fs.rmSync(root, { recursive: true, force: true });
  });
  function command(bin, args) {
    const result = spawnSync(bin, args, {
      cwd: repo,
      env,
      encoding: "utf8",
      timeout: 15000,
      killSignal: "SIGKILL",
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }
  command("git", ["init", "--quiet"]);
  command("git", ["config", "user.name", "Readiness Fixture"]);
  command("git", ["config", "user.email", "fixture@example.invalid"]);
  command("git", ["config", "commit.gpgsign", "true"]);
  function verify() {
    const before = command("git", ["count-objects", "-v"]);
    const refs = command("git", ["for-each-ref"]);
    const head = fs.readFileSync(path.join(repo, ".git/HEAD"), "utf8");
    const result = spawnSync("python3", [helper], {
      cwd: repo,
      env,
      encoding: "utf8",
      timeout: 15000,
      killSignal: "SIGKILL",
    });
    assert.ifError(result.error);
    assert.equal(command("git", ["count-objects", "-v"]), before);
    assert.equal(command("git", ["for-each-ref"]), refs);
    assert.equal(fs.readFileSync(path.join(repo, ".git/HEAD"), "utf8"), head);
    assert.equal(fs.existsSync(path.join(repo, ".git/index")), false);
    assert.deepEqual(fs.readdirSync(temporary), []);
    return result;
  }
  return { root, repo, home, command, verify };
}

test("SSH signs and verifies a disposable commit using the configured trust policy", (t) => {
  const f = fixture(t);
  const key = path.join(f.root, "ssh-key");
  f.command("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", key]);
  const allowed = path.join(f.root, "allowed-signers");
  fs.writeFileSync(
    allowed,
    `fixture@example.invalid ${fs.readFileSync(`${key}.pub`, "utf8")}`,
  );
  f.command("git", ["config", "gpg.format", "ssh"]);
  f.command("git", ["config", "user.signingkey", key]);
  f.command("git", ["config", "gpg.ssh.allowedSignersFile", allowed]);
  const result = f.verify();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("encrypted SSH keys fail without opening a passphrase prompt", (t) => {
  const f = fixture(t);
  const key = path.join(f.root, "encrypted-key");
  f.command("ssh-keygen", [
    "-q",
    "-t",
    "ed25519",
    "-N",
    "fixture-passphrase",
    "-f",
    key,
  ]);
  f.command("git", ["config", "gpg.format", "ssh"]);
  f.command("git", ["config", "user.signingkey", key]);
  const started = Date.now();
  const result = f.verify();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(Date.now() - started < 5000);
});

test("SSH verification fails if allowed-signers policy is absent", (t) => {
  const f = fixture(t);
  const key = path.join(f.root, "ssh-key");
  f.command("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", key]);
  f.command("git", ["config", "gpg.format", "ssh"]);
  f.command("git", ["config", "user.signingkey", key]);
  assert.equal(f.verify().status, 1);
});

test("OpenPGP signs and verifies without pinentry and preserves repository state", (t) => {
  const f = fixture(t);
  f.command("gpg", [
    "--batch",
    "--pinentry-mode",
    "loopback",
    "--passphrase",
    "",
    "--quick-generate-key",
    "Readiness Fixture <fixture@example.invalid>",
    "ed25519",
    "sign",
    "0",
  ]);
  const fingerprint = f
    .command("gpg", ["--with-colons", "--list-secret-keys"])
    .split("\n")
    .find((line) => line.startsWith("fpr:"))
    .split(":")[9];
  f.command("git", ["config", "user.signingkey", fingerprint]);
  const result = f.verify();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("missing signing key reports failure without prompts or original object writes", (t) => {
  const f = fixture(t);
  f.command("git", ["config", "user.signingkey", "NONEXISTENTKEY"]);
  assert.equal(f.verify().status, 1);
});

test("unsupported signing formats fail safely", (t) => {
  const f = fixture(t);
  f.command("git", ["config", "gpg.format", "unsupported"]);
  // Git rejects the configuration; invoke the helper without subsequent Git snapshots.
  const result = spawnSync("python3", [helper], {
    cwd: f.repo,
    env: {
      ...process.env,
      GNUPGHOME: f.home,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
    },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 1);
});
