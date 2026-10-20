/**
 * Deliberately interrupt a bootstrap transaction only in a disposable smoke
 * repo.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  applyBootstrapChanges,
  bootstrapFiles,
} from "../../lib/bootstrap-transaction.js";

assert.match(path.basename(process.cwd()), /^nlobby4-devcontainer-smoke\./u);
const names = [
  bootstrapFiles.config,
  ...Object.values(bootstrapFiles).filter(
    (name) => name !== bootstrapFiles.config,
  ),
];
const originals = new Map(names.map((name) => [name, fs.readFileSync(name)]));
const proposed = new Map(
  names.map((name) => [
    name,
    name === bootstrapFiles.config ?
      originals
        .get(name)
        .toString("utf8")
        .replace(/^min_version = .*$/mu, 'min_version = "3000.1.0"')
    : `${originals.get(name).toString("utf8")}\n`,
  ]),
);
const rename = fs.renameSync;
fs.renameSync = (...args) => {
  const result = rename(...args);
  if (args[0].includes(".mise-update-")) process.kill(process.pid, "SIGKILL");
  return result;
};
applyBootstrapChanges(process.cwd(), originals, proposed);
assert.fail("crash fixture unexpectedly completed");
