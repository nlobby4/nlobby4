/** Verify custom extraction and the narrowly allowed maintenance command. */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const config = JSON.parse(
  fs.readFileSync(new URL("../../../renovate.json", import.meta.url), "utf8"),
);
const host = JSON.parse(
  fs.readFileSync(
    new URL("../../../.github/renovate-host.json", import.meta.url),
    "utf8",
  ),
);

for (const [manager, name, expected] of [
  [0, ".devcontainer/versions.env", "2026.9.18"],
  [1, ".devcontainer/devcontainer.json", "0.37.0"],
  [2, ".devcontainer/devcontainer.json", "2.40.3"],
  [3, ".devcontainer/devcontainer.json", "29.6.0"],
])
  test(`Renovate extracts tool pin ${manager}`, () => {
    const rule = config.customManagers.filter(
      (entry) =>
        !entry.managerFilePatterns.includes("/^schemas/sources\\.json$/"),
    )[manager];
    const pattern = rule.managerFilePatterns[0];
    assert(new RegExp(pattern.slice(1, -1)).test(name));
    const text = fs.readFileSync(path.join(root, name), "utf8");
    const matches = [...text.matchAll(new RegExp(rule.matchStrings[0], "gu"))];
    assert.equal(matches.length, 1);
    assert.equal(matches[0].groups.currentValue, expected);
  });
test("Docker version extraction ignores unrelated Feature options", () => {
  const text = fs.readFileSync(
    new URL("../../../.devcontainer/devcontainer.json", import.meta.url),
    "utf8",
  );
  const pattern = new RegExp(
    config.customManagers.find((entry) => entry.depNameTemplate === "moby/moby")
      .matchStrings[0],
    "gu",
  );
  assert.equal(
    [...('"other-feature": {"version": "999.0.0"},' + text).matchAll(pattern)]
      .length,
    1,
  );
});
test("self-hosted command permission allows only the exact refresh entry point", () => {
  const allowed = new RegExp(host.allowedCommands[0]);
  assert(
    allowed.test(
      "bash scripts/linux/commands/devcontainer/devcontainer-update.sh --refresh",
    ),
  );
  for (const command of [
    "bash other.sh",
    "bash scripts/linux/commands/devcontainer/devcontainer-updateXsh --refresh",
    "bash scripts/linux/commands/devcontainer/devcontainer-update.sh --refresh; env",
    "bash scripts/linux/commands/devcontainer/devcontainer-update.sh --mise 999.1.0",
  ])
    assert(!allowed.test(command));
  assert.equal(config.automerge, false);
  assert.equal(host.exposeAllEnv, false);
});

test("schema source pins are extracted and schema-only updates need no Docker", () => {
  const text = fs.readFileSync(path.join(root, "schemas/sources.json"), "utf8");
  for (const name of ["SchemaStore schemas", "renovate"]) {
    const rule = config.customManagers.find(
      (entry) => entry.depNameTemplate === name,
    );
    assert(
      new RegExp(rule.managerFilePatterns[0].slice(1, -1)).test(
        "schemas/sources.json",
      ),
    );
    const matches = [...text.matchAll(new RegExp(rule.matchStrings[0], "gu"))];
    assert.equal(matches.length, 1);
    assert.ok(
      matches[0].groups.currentDigest ?? matches[0].groups.currentValue,
    );
  }
  assert.deepEqual(config.postUpgradeTasks.commands, [
    "pnpm run schemas:update",
  ]);
  assert(config.postUpgradeTasks.fileFilters.includes("schemas/**"));
  const allowed = host.allowedCommands.map((pattern) => new RegExp(pattern));
  assert(allowed.some((pattern) => pattern.test("pnpm run schemas:update")));
  assert(
    !allowed.some((pattern) => pattern.test("pnpm run schemas:update; env")),
  );
  const toolchain = config.packageRules.find(
    (rule) => rule.groupName === "devcontainer toolchain",
  );
  assert(toolchain.matchPackageNames.includes("!SchemaStore schemas"));
  assert(
    toolchain.matchPackageNames.includes(
      "!https://github.com/SchemaStore/schemastore",
    ),
  );
  const schemaCommit = config.packageRules.find((rule) =>
    rule.matchDatasources?.includes("git-refs"),
  );
  assert.deepEqual(schemaCommit.matchFileNames, ["schemas/sources.json"]);
  assert.equal(schemaCommit.minimumReleaseAge, "0 days");
  assert(toolchain.matchPackageNames.includes("!renovate"));
  assert(
    toolchain.postUpgradeTasks.commands.includes(
      "bash scripts/linux/commands/devcontainer/devcontainer-update.sh --refresh",
    ),
  );
});
