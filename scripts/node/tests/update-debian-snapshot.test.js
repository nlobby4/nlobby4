/** Snapshot coupling, refusal and preservation checks in isolated workspaces. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  recentSnapshot,
  updateDebianSnapshot,
} from "../bin/update-debian-snapshot.js";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "debian-update-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(
    new URL("../../../.devcontainer/", import.meta.url),
    path.join(root, ".devcontainer"),
    {
      recursive: true,
    },
  );
  const filename = path.join(root, ".devcontainer/versions.env");
  const before = fs.readFileSync(filename, "utf8");
  const values = new Map(
    [
      ["cmark-gfm", "CMARK_GFM_VERSION"],
      ["curl", "CURL_VERSION"],
      ["gawk", "GAWK_VERSION"],
      ["git-lfs", "GIT_LFS_VERSION"],
      ["python3-venv", "PYTHON_VENV_VERSION"],
      ["jq", "JQ_VERSION"],
      ["yq", "YQ_VERSION"],
    ].map(([name, key]) => [
      name,
      before.match(new RegExp(`^${key}=(.+)$`, "m"))[1],
    ]),
  );
  return { root, filename, before, values };
}

test("recent snapshot uses a seven-day UTC delay across month/year boundaries", () => {
  assert.equal(
    recentSnapshot(new Date("2026-01-03T23:00:00Z")),
    "20251227T000000Z",
  );
});
test("same snapshot and pins are idempotent", (t) => {
  const { root, filename, before, values } = fixture(t);
  assert.equal(
    updateDebianSnapshot({
      root,
      snapshot: "20260824T000000Z",
      resolve: () => values,
    }),
    false,
  );
  assert.equal(fs.readFileSync(filename, "utf8"), before);
});
test("updates all pins together only after resolving both architectures", (t) => {
  const { root, filename, before, values } = fixture(t);
  const calls = [];
  const resolve = (input) => {
    calls.push(input);
    return new Map(
      [...values].map(([name, version]) => [name, version + "+test1"]),
    );
  };
  assert.equal(
    updateDebianSnapshot({ root, snapshot: "20260901T000000Z", resolve }),
    true,
  );
  assert.deepEqual(
    calls.map(({ architecture }) => architecture),
    ["amd64", "arm64"],
  );
  assert(calls.every(({ image }) => /@sha256:[a-f0-9]{64}$/u.test(image)));
  const after = fs.readFileSync(filename, "utf8");
  assert.match(after, /DEBIAN_SNAPSHOT=20260901T000000Z/u);
  assert.equal(
    after.match(/^MISE_VERSION=.+$/mu)[0],
    before.match(/^MISE_VERSION=.+$/mu)[0],
  );
  assert.match(after, /JQ_VERSION=.+\+test1/u);
});
for (const snapshot of [
  "20260101T000000Z",
  "20260230T000000Z",
  "20260901",
  "$(id)",
]) {
  test(`refuses invalid/backward snapshot ${snapshot}`, (t) => {
    const { root, filename, before } = fixture(t);
    assert.throws(
      () =>
        updateDebianSnapshot({
          root,
          snapshot,
          resolve: () => {
            throw new Error("should not resolve");
          },
        }),
      /snapshot/u,
    );
    assert.equal(fs.readFileSync(filename, "utf8"), before);
  });
}
test("architecture mismatches preserve the complete manifest", (t) => {
  const { root, filename, before, values } = fixture(t);
  assert.throws(
    () =>
      updateDebianSnapshot({
        root,
        snapshot: "20260901T000000Z",
        resolve: ({ architecture }) =>
          new Map(
            [...values].map(([name, version]) => [
              name,
              architecture === "arm64" && name === "jq" ? "999.1" : version,
            ]),
          ),
      }),
    /architecture/u,
  );
  assert.equal(fs.readFileSync(filename, "utf8"), before);
});
test("second-architecture network failure preserves every pin", (t) => {
  const { root, filename, before, values } = fixture(t);
  assert.throws(
    () =>
      updateDebianSnapshot({
        root,
        snapshot: "20260901T000000Z",
        resolve: ({ architecture }) => {
          if (architecture === "arm64") throw new Error("network unavailable");
          return values;
        },
      }),
    /network unavailable/u,
  );
  assert.equal(fs.readFileSync(filename, "utf8"), before);
});
test("concurrent maintainer edit is preserved", (t) => {
  const { root, filename, before, values } = fixture(t);
  assert.throws(
    () =>
      updateDebianSnapshot({
        root,
        snapshot: "20260901T000000Z",
        resolve: () => {
          fs.writeFileSync(filename, before + "# later edit\n");
          return values;
        },
      }),
    /changed during resolution/u,
  );
  assert.equal(fs.readFileSync(filename, "utf8"), before + "# later edit\n");
});
