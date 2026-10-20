/** Isolated tests for coupled bootstrap updates and failure preservation. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { updateMiseBootstrap } from "../bin/update-mise-bootstrap.js";

const version = "2026.9.19";
const tracked = [
  ".devcontainer/versions.env",
  ".devcontainer/checksums.sha256",
  ".github/actions/setup-node-deps/action.yml",
  "mise.toml",
];
const filenames = ["x64", "arm64"].map(
  (arch) => `mise-v${version}-linux-${arch}`,
);
const hashes = ["a".repeat(64), "b".repeat(64)];
const manifest = filenames
  .map((name, index) => `${hashes[index]}  ./${name}\n`)
  .join("");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mise-update-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // Unit fixtures cannot be signed by the publisher: stub only the CLI boundary.
  // Real publisher signatures and tampering are exercised separately.
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, "minisign"),
    `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const signature = fs.readFileSync(args[args.indexOf("-x") + 1], "utf8");
if (signature !== "test-signature") { process.stderr.write("invalid signature"); process.exit(1); }
if (args[0] !== "-Vm" || args.at(-2) !== "-P" || args.at(-1) !== "RWTC3g8W3z4RZK3V3qv7fa1QY4JEWyBtqIHW+85QlJpZc5yG+uNYNBSZ") process.exit(2);
`,
    { mode: 0o755 },
  );
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}:${originalPath}`;
  t.after(() => {
    process.env.PATH = originalPath;
  });
  for (const name of [
    ".devcontainer",
    "schemas",
    ".github/actions",
    "mise.toml",
    "mise.lock",
    ".mise/locks",
    ".mise/aqua.yaml",
  ]) {
    fs.cpSync(
      new URL(`../../../${name}`, import.meta.url),
      path.join(root, name),
      { recursive: true },
    );
  }
  return root;
}

test("rejects releases older than the native-lock baseline before downloading", async () => {
  await assert.rejects(
    updateMiseBootstrap({
      version: "2026.9.17",
      fetcher: () => assert.fail("must not download"),
    }),
    /native locks require/u,
  );
});

function snapshots(root) {
  return tracked.map((name) => fs.readFileSync(path.join(root, name), "utf8"));
}

function upstream({
  text = manifest,
  signature = "test-signature",
  changeRelease = () => {},
} = {}) {
  const release = {
    tag_name: `v${version}`,
    draft: false,
    prerelease: false,
    assets: [
      {
        name: "SHASUMS256.txt",
        digest: `sha256:${createHash("sha256").update(text).digest("hex")}`,
      },
      ...filenames.map((name, index) => ({
        name,
        digest: `sha256:${hashes[index]}`,
      })),
    ],
  };
  changeRelease(release);
  return async (url) =>
    new Response(
      url.startsWith("https://api.github.com/") ? JSON.stringify(release)
      : url.endsWith(".minisig") ? signature
      : text,
    );
}

test("updates all coupled files, preserves unrelated content, and is idempotent", async (t) => {
  const root = fixture(t);
  const action = path.join(root, tracked[2]);
  fs.appendFileSync(action, "\n# Keep this user comment\n");
  const before = snapshots(root);
  fs.chmodSync(path.join(root, tracked[0]), 0o640);
  const result = await updateMiseBootstrap({
    root,
    version,
    fetcher: upstream(),
  });
  assert.equal(result.changed, true);
  assert.match(result.diff, /MISE_VERSION=2026\.9\.19/u);
  assert.match(result.diff, /SHASUMS256\.txt/u);
  const after = snapshots(root);
  assert.equal(
    after[0],
    before[0].replace(/^MISE_VERSION=.*$/mu, `MISE_VERSION=${version}`),
  );
  assert.match(after[1], /v2026\.9\.19\/SHASUMS256\.txt/u);
  const sourceComment = before[1]
    .split("\n")
    .find((line) => line.includes("/SHASUMS256.txt"));
  assert.ok(
    after[1].includes(sourceComment.replace(/\/v[^/]+/u, `/v${version}`)),
  );
  filenames.forEach((name, index) =>
    assert.ok(after[1].includes(`${hashes[index]}  ${name}\n`)),
  );
  assert.equal(
    after[2],
    before[2].replace(/^ {8}version: .*$/mu, `        version: ${version}`),
  );
  assert.equal(
    after[3],
    before[3].replace(/^min_version = .*$/mu, `min_version = "${version}"`),
  );
  assert.equal(fs.statSync(path.join(root, tracked[0])).mode & 0o777, 0o640);
  const again = await updateMiseBootstrap({
    root,
    version,
    fetcher: upstream(),
  });
  assert.equal(again.changed, false);
  assert.equal(again.diff, "");
  assert.deepEqual(snapshots(root), after);
});

for (const [name, fetcher, expected] of [
  [
    "invalid publisher signature",
    upstream({ signature: "tampered" }),
    /signature verification failed/u,
  ],
  [
    "network failure",
    async () => {
      throw new Error("network unavailable");
    },
    /network unavailable/u,
  ],
  [
    "release not found",
    async () => new Response("missing", { status: 404 }),
    /HTTP 404/u,
  ],
  [
    "wrong release tag",
    upstream({
      changeRelease: (release) => {
        release.tag_name = "v0.0.0";
      },
    }),
    /published stable/u,
  ],
  [
    "prerelease",
    upstream({
      changeRelease: (release) => {
        release.prerelease = true;
      },
    }),
    /published stable/u,
  ],
  [
    "manifest digest mismatch",
    upstream({
      changeRelease: (release) => {
        release.assets[0].digest = `sha256:${"0".repeat(64)}`;
      },
    }),
    /manifest does not match/u,
  ],
  [
    "binary digest mismatch",
    upstream({
      changeRelease: (release) => {
        release.assets[1].digest = `sha256:${"0".repeat(64)}`;
      },
    }),
    /mismatched upstream checksum/u,
  ],
  [
    "missing binary checksum",
    upstream({ text: manifest.split("\n")[0] + "\n" }),
    /missing or mismatched/u,
  ],
  [
    "missing release digest",
    upstream({
      changeRelease: (release) => {
        delete release.assets[1].digest;
      },
    }),
    /unverifiable release asset/u,
  ],
  [
    "duplicate checksum",
    upstream({ text: manifest + manifest }),
    /duplicate upstream checksum/u,
  ],
  [
    "malformed checksum",
    upstream({ text: "invalid\n" }),
    /malformed upstream checksum/u,
  ],
]) {
  test(`${name} preserves all source files`, async (t) => {
    const root = fixture(t);
    const before = snapshots(root);
    await assert.rejects(
      updateMiseBootstrap({ root, version, fetcher }),
      expected,
    );
    assert.deepEqual(snapshots(root), before);
  });
}

test("invalid candidate preserves originals", async (t) => {
  const root = fixture(t);
  fs.writeFileSync(
    path.join(root, ".devcontainer/devcontainer-lock.json"),
    '{"features":{}}',
  );
  const before = snapshots(root);
  await assert.rejects(
    updateMiseBootstrap({ root, version, fetcher: upstream() }),
    /candidate validation failed/u,
  );
  assert.deepEqual(snapshots(root), before);
});

test("missing signature preserves originals", async (t) => {
  const root = fixture(t);
  const before = snapshots(root);
  const fetcher = upstream();
  await assert.rejects(
    updateMiseBootstrap({
      root,
      version,
      fetcher: (url) =>
        url.endsWith(".minisig") ?
          new Response("missing", { status: 404 })
        : fetcher(url),
    }),
    /HTTP 404/u,
  );
  assert.deepEqual(snapshots(root), before);
});

test("missing verifier preserves originals", async (t) => {
  const root = fixture(t);
  const before = snapshots(root);
  fs.unlinkSync(path.join(root, "bin/minisign"));
  process.env.PATH = path.join(root, "bin");
  await assert.rejects(
    updateMiseBootstrap({ root, version, fetcher: upstream() }),
    /signature verification failed.*ENOENT/u,
  );
  assert.deepEqual(snapshots(root), before);
});

test("intervening edits are retained and abort the update", async (t) => {
  const root = fixture(t);
  const fetcher = upstream();
  const action = path.join(root, tracked[2]);
  const before = snapshots(root);
  const concurrent = async (...args) => {
    fs.writeFileSync(action, before[2] + "\n# Edited while downloading\n");
    return fetcher(...args);
  };
  await assert.rejects(
    updateMiseBootstrap({ root, version, fetcher: concurrent }),
    /file changed during update/u,
  );
  assert.deepEqual(snapshots(root), [
    before[0],
    before[1],
    before[2] + "\n# Edited while downloading\n",
    before[3],
  ]);
  for (const directory of [
    ".devcontainer",
    ".github/actions/setup-node-deps",
  ]) {
    assert.ok(
      fs
        .readdirSync(path.join(root, directory))
        .every((name) => !name.includes(".mise-update-")),
    );
  }
});

test("replacement failure restores earlier files and removes temporary files", async (t) => {
  const root = fixture(t);
  const before = snapshots(root);
  const rename = fs.renameSync;
  const counter = { replacements: 0 };
  fs.renameSync = (...args) => {
    if (args[0].includes(".mise-update-") && ++counter.replacements === 2) {
      throw new Error("simulated replacement failure");
    }
    return rename(...args);
  };
  try {
    await assert.rejects(
      updateMiseBootstrap({ root, version, fetcher: upstream() }),
      /simulated replacement failure/u,
    );
  } finally {
    fs.renameSync = rename;
  }
  assert.deepEqual(snapshots(root), before);
  for (const directory of [
    ".devcontainer",
    ".github/actions/setup-node-deps",
  ]) {
    assert.ok(
      fs
        .readdirSync(path.join(root, directory))
        .every((name) => !name.includes(".mise-update-")),
    );
  }
});

test("requires an explicit release version before downloading", async () => {
  for (const invalid of [
    "latest",
    "v2026.9.18",
    "2026.9",
    "2026.9.18-rc1",
    "2026.9.18; id",
    undefined,
  ]) {
    await assert.rejects(
      updateMiseBootstrap({
        version: invalid,
        fetcher: async () => {
          assert.fail("must not download");
        },
      }),
      /version must be explicit/u,
    );
  }
});
