/**
 * Exercise the actual Dockerfile user stanza against disposable base-image
 * variants.
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const text = fs.readFileSync(
  path.join(root, ".devcontainer/Dockerfile"),
  "utf8",
);
const image = text.match(/^FROM (.+)$/mu)[1];
const stanza = text
  .match(/^RUN test "\$\{USER\}" != root [\s\S]+?\n\n/mu)[0]
  .replace(/^RUN /u, "")
  .replace(/\\\n/gu, " ");

for (const [name, prepare, expected] of [
  ["stock base account", "true", 0],
  [
    "different login, primary group and home",
    'source_user="$(getent passwd 1000 | cut -d: -f1)"; source_group="$(id -gn "$source_user")"; groupmod --new-name builders "$source_group"; usermod --login builder --home /opt/builder --move-home "$source_user"',
    0,
  ],
  [
    "no inherited UID 1000 account",
    'source_user="$(getent passwd 1000 | cut -d: -f1)"; userdel --remove "$source_user"',
    0,
  ],
  ["already-provisioned target account", stanza, 0],
  [
    "target account with a different home",
    'source_user="$(getent passwd 1000 | cut -d: -f1)"; usermod --login nlobby4 --home /opt/nlobby4 --move-home "$source_user"',
    0,
  ],
  ["conflicting target UID", "useradd --create-home --uid 2000 nlobby4", 1],
  ["root target", "USER=root; USER_HOME=/home/root", 1],
])
  test(name, () => {
    const program =
      "set -euo pipefail\n"
      + prepare
      + "\n"
      + stanza
      + '\n test "$(id -u "$USER")" = 1000\n test "$(getent passwd "$USER" | cut -d: -f6)" = "$USER_HOME"\n test -d "$USER_HOME/.cache"\n test "$(stat -c %u "$USER_HOME/.cache")" = 1000\n ! id -nG "$USER" | grep -qw sudo\n';
    const result = spawnSync(
      "docker",
      [
        "run",
        "--rm",
        "--interactive",
        "--user=0",
        "--entrypoint=bash",
        "--env=USER=nlobby4",
        "--env=USER_HOME=/home/nlobby4",
        image,
        "-s",
      ],
      { input: program, encoding: "utf8", timeout: 60000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, expected, result.stderr);
  });
