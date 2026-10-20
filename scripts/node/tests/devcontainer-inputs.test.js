/** Regression tests for the repository's build-input contract. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const validator = path.join(
  root,
  "scripts/node/bin/validate-devcontainer-inputs.js",
);

function verify(change, expected) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "devcontainer-inputs-"),
  );
  try {
    for (const name of [
      ".devcontainer",
      "schemas",
      ".github/actions",
      "mise.toml",
      "mise.lock",
      ".mise/locks",
      ".mise/aqua.yaml",
    ]) {
      fs.cpSync(path.join(root, name), path.join(directory, name), {
        recursive: true,
      });
    }
    const edit = (name, update) => {
      const file = path.join(directory, name);
      fs.writeFileSync(file, update(fs.readFileSync(file, "utf8")));
    };
    change(edit);
    const result = spawnSync(process.execPath, [validator], {
      cwd: directory,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, expected, result.stderr);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test("current build inputs are valid", () => verify(() => {}, 0));
test("mise minimum must match bootstrap", () =>
  verify((edit) => {
    edit("mise.toml", (text) =>
      text.replace(/^min_version = .*$/mu, 'min_version = "2026.9.1"'),
    );
  }, 1));
test("native graph digest mismatch fails", () =>
  verify((edit) => {
    edit(
      ".mise/locks/npm-pnpm/10.20.0/aube-lock.yaml",
      (text) => text + "\n# tampered\n",
    );
  }, 1));
test("duplicate version keys fail", () =>
  verify((edit) => {
    edit(
      ".devcontainer/versions.env",
      (text) => text + "MISE_VERSION=2026.9.1\n",
    );
  }, 1));
test("shell expansions are not literal versions", () =>
  verify((edit) => {
    edit(".devcontainer/versions.env", (text) =>
      text.replace(/^JQ_VERSION=.*$/m, "JQ_VERSION=1$(id)"),
    );
  }, 1));
test("extra assignment delimiters fail", () =>
  verify((edit) => {
    edit(".devcontainer/versions.env", (text) =>
      text.replace(/^JQ_VERSION=.*$/m, "JQ_VERSION=1=invalid"),
    );
  }, 1));
for (const value of [null, {}, [], { features: {} }, { features: null }]) {
  test(`incomplete feature lock fails: ${JSON.stringify(value)}`, () =>
    verify((edit) => {
      edit(".devcontainer/devcontainer-lock.json", () => JSON.stringify(value));
    }, 1));
}
test("missing container configuration fails", () =>
  verify((edit) => {
    edit(".devcontainer/devcontainer.json", () => "{}");
  }, 1));
test("short integrity fails", () =>
  verify((edit) => {
    edit(".devcontainer/devcontainer-lock.json", (text) =>
      text.replace(/sha256:[a-f0-9]{64}/g, "sha256:abc"),
    );
  }, 1));
test("inactive frontend directive fails", () =>
  verify((edit) => {
    edit(".devcontainer/Dockerfile", (text) => "# preceding comment\n" + text);
  }, 1));
test("CI bootstrap drift fails", () =>
  verify((edit) => {
    edit(".github/actions/setup-node-deps/action.yml", (text) =>
      text.replace(/version: .*/, "version: 0.0.0"),
    );
  }, 1));

// Exercise dependency graphs in disposable copies, never the repository lock.
const declaredFeature = "ghcr.io/devcontainers/features/docker-in-docker:4.1.1";
const dependencyFeature = "ghcr.io/devcontainers/features/common-utils:2";
const leafFeature = "ghcr.io/devcontainers/features/git:1.2";
const lockedFeature = (feature, version, dependsOn) => ({
  version,
  resolved: `${feature.replace(/(:[0-9.]+|@sha256:[a-f0-9]{64})$/, "")}@sha256:${"a".repeat(64)}`,
  integrity: `sha256:${"a".repeat(64)}`,
  ...(dependsOn === undefined ? {} : { dependsOn }),
});
const dependencyLock = () => ({
  features: {
    [declaredFeature]: lockedFeature(declaredFeature, "4.1.1", [
      dependencyFeature,
    ]),
    [dependencyFeature]: lockedFeature(dependencyFeature, "2.5.1", [
      leafFeature,
    ]),
    [leafFeature]: lockedFeature(leafFeature, "1.2.3"),
  },
});

for (const [name, change, expected] of [
  ["nested transitive Features with partial version selectors", () => {}, 0],
  [
    "missing transitive Feature",
    (lock) => {
      delete lock.features[leafFeature];
    },
    1,
  ],
  [
    "unreachable Feature",
    (lock) => {
      delete lock.features[dependencyFeature].dependsOn;
    },
    1,
  ],
  [
    "wrong dependency version",
    (lock) => {
      lock.features[leafFeature].version = "1.3.0";
    },
    1,
  ],
  [
    "malformed dependency list",
    (lock) => {
      lock.features[declaredFeature].dependsOn = dependencyFeature;
    },
    1,
  ],
  [
    "non-string dependency",
    (lock) => {
      lock.features[declaredFeature].dependsOn = [null];
    },
    1,
  ],
  [
    "malformed dependency entry",
    (lock) => {
      lock.features[leafFeature] = [];
    },
    1,
  ],
  [
    "dependency digest mismatch",
    (lock) => {
      lock.features[leafFeature].integrity = `sha256:${"b".repeat(64)}`;
    },
    1,
  ],
  [
    "reachable cycle terminates",
    (lock) => {
      lock.features[leafFeature].dependsOn = [dependencyFeature];
    },
    0,
  ],
  [
    "disconnected cycle is stale",
    (lock) => {
      delete lock.features[declaredFeature].dependsOn;
      lock.features[leafFeature].dependsOn = [dependencyFeature];
    },
    1,
  ],
  [
    "unapproved transitive registry",
    (lock) => {
      const unapproved = "ghcr.io/untrusted/features/git:1.2";
      lock.features[dependencyFeature].dependsOn = [unapproved];
      lock.features[unapproved] = lockedFeature(unapproved, "1.2.3");
      delete lock.features[leafFeature];
    },
    1,
  ],
  [
    "digest-pinned dependency",
    (lock) => {
      const pinned = `ghcr.io/devcontainers/features/git@sha256:${"a".repeat(64)}`;
      lock.features[dependencyFeature].dependsOn = [pinned];
      lock.features[pinned] = lockedFeature(pinned, "1.2.3");
      delete lock.features[leafFeature];
    },
    0,
  ],
  [
    "unversioned dependency",
    (lock) => {
      const unversioned = "ghcr.io/devcontainers/features/git";
      lock.features[dependencyFeature].dependsOn = [unversioned];
      lock.features[unversioned] = lockedFeature(unversioned, "1.2.3");
      delete lock.features[leafFeature];
    },
    0,
  ],
]) {
  test(name, () =>
    verify((edit) => {
      const lock = dependencyLock();
      change(lock);
      edit(".devcontainer/devcontainer-lock.json", () => JSON.stringify(lock));
    }, expected),
  );
}
