import { readFileSync, writeFileSync } from "node:fs";

const [output, devcontainerPath, lockPath] = process.argv.slice(2);
if (!output || !devcontainerPath || !lockPath) {
  throw new Error("usage: build-policy-input OUTPUT DEVCONTAINER LOCK");
}

const bundle = {
  devcontainer: JSON.parse(readFileSync(devcontainerPath, "utf8")),
  lock: JSON.parse(readFileSync(lockPath, "utf8")),
};
writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`);
