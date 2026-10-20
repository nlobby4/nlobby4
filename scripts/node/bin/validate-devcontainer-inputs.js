import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { parse } from "yaml";

const read = (path) => fs.readFileSync(path, "utf8");
const failures = [];
const fail = (message) => failures.push(message);

const versionLines = read(".devcontainer/versions.env")
  .split("\n")
  .filter((line) => line && !line.startsWith("#"));
const values = Object.fromEntries(
  versionLines.map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }),
);
const expectedVariables = [
  "DEBIAN_SNAPSHOT",
  "CMARK_GFM_VERSION",
  "CURL_VERSION",
  "GAWK_VERSION",
  "GIT_LFS_VERSION",
  "JQ_VERSION",
  "PYTHON_VENV_VERSION",
  "YQ_VERSION",
  "MISE_VERSION",
];

for (const line of versionLines) {
  if (!/^[A-Z][A-Z0-9_]*=\S+$/.test(line)) {
    fail(`invalid version entry: ${line}`);
  }
}
const seenVariables = new Set();
for (const line of versionLines) {
  const separator = line.indexOf("=");
  const name = line.slice(0, separator);
  const value = line.slice(separator + 1);
  if (seenVariables.has(name)) fail(`duplicate version entry: ${name}`);
  seenVariables.add(name);
  if (
    name !== "DEBIAN_SNAPSHOT"
    && !/^[0-9][0-9A-Za-z.+:~_-]*$/.test(value ?? "")
  ) {
    fail(`invalid literal version: ${name}`);
  }
}
if (!/^\d+\.\d+\.\d+$/.test(values.MISE_VERSION ?? ""))
  fail("MISE_VERSION must be exact");
for (const name of expectedVariables) {
  if (!values[name]) fail(`missing version entry: ${name}`);
}
for (const name of Object.keys(values)) {
  if (!expectedVariables.includes(name)) fail(`stale version entry: ${name}`);
}
if (!/^\d{8}T\d{6}Z$/.test(values.DEBIAN_SNAPSHOT ?? "")) {
  fail("DEBIAN_SNAPSHOT must use YYYYMMDDTHHMMSSZ format");
}

const checksums = new Map();
for (const [index, line] of read(".devcontainer/checksums.sha256")
  .split("\n")
  .entries()) {
  if (!line || line.startsWith("#")) continue;
  if (!/^[a-f0-9]{64} {2}\S+$/.test(line)) {
    fail(`invalid checksum entry on line ${index + 1}`);
    continue;
  }
  const [hash, filename] = line.split("  ");
  if (checksums.has(filename)) fail(`duplicate checksum: ${filename}`);
  checksums.set(filename, hash);
}

const expectedArtifacts = [
  `mise-v${values.MISE_VERSION}-linux-x64`,
  `mise-v${values.MISE_VERSION}-linux-arm64`,
];

for (const filename of expectedArtifacts) {
  if (!checksums.has(filename)) fail(`missing checksum: ${filename}`);
}
for (const filename of checksums.keys()) {
  if (!expectedArtifacts.includes(filename))
    fail(`stale checksum: ${filename}`);
}

const config = JSON.parse(read(".devcontainer/devcontainer.json"));
const lock = JSON.parse(read(".devcontainer/devcontainer-lock.json"));
const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(
  JSON.parse(read("schemas/devcontainer.schema.json")),
);
if (!validate(config)) fail(ajv.errorsText(validate.errors));
if (config?.build?.args?.USER !== config?.remoteUser)
  fail("build USER must equal remoteUser");
const features = config?.features ?? {};
if (
  !lock?.features
  || typeof lock.features !== "object"
  || Array.isArray(lock.features)
) {
  fail("Feature lock must contain an object");
} else {
  // Only declared Features and their reachable hard dependencies belong in the lock.
  const reachable = new Set(Object.keys(features));
  const pending = [...reachable];
  for (const key of pending) {
    const dependencies = lock.features[key]?.dependsOn;
    if (dependencies === undefined) continue;
    if (
      !Array.isArray(dependencies)
      || dependencies.some((dependency) => typeof dependency !== "string")
    ) {
      fail(`invalid Feature dependencies: ${key}`);
      continue;
    }
    for (const dependency of dependencies) {
      if (!reachable.has(dependency)) {
        reachable.add(dependency);
        pending.push(dependency);
      }
    }
  }
  for (const key of new Set([...reachable, ...Object.keys(lock.features)])) {
    const entry = lock.features[key];
    const identifier = key.match(
      /^(ghcr\.io\/devcontainers\/features\/[a-z0-9-]+)(?::([0-9]+(?:\.[0-9]+){0,2})|@(sha256:[a-f0-9]{64}))?$/,
    );
    const [, repository, selector, digest] = identifier ?? [];
    if (
      !reachable.has(key)
      || !identifier
      || !entry
      || typeof entry !== "object"
      || Array.isArray(entry)
      || !/^[0-9]+\.[0-9]+\.[0-9]+$/.test(entry.version ?? "")
      || (selector
        && entry.version !== selector
        && !entry.version.startsWith(`${selector}.`))
      || (digest && digest !== entry.integrity)
      || !/^sha256:[a-f0-9]{64}$/.test(entry.integrity ?? "")
      || entry.resolved !== `${repository}@${entry.integrity}`
    ) {
      fail(`missing, stale, or invalid Feature lock entry: ${key}`);
    }
  }
}
const dockerfile = read(".devcontainer/Dockerfile");
if (
  !/^# syntax=docker\/dockerfile:[^\s@]+@sha256:[a-f0-9]{64}\n/.test(dockerfile)
) {
  fail("Dockerfile must start with the digest-pinned syntax directive");
}
const ciSetup = parse(read(".github/actions/setup-node-deps/action.yml"));
const bootstrap = ciSetup.runs.steps.find((step) =>
  step.uses?.startsWith("jdx/mise-action@"),
);
if (String(bootstrap?.with?.version) !== values.MISE_VERSION) {
  fail("CI mise bootstrap must match versions.env");
}

const nativeLocks = spawnSync(
  "python3",
  [
    fileURLToPath(
      new URL("../../python/devcontainer-state.py", import.meta.url),
    ),
    "validate-locks",
  ],
  { encoding: "utf8", timeout: 10000 },
);
if (nativeLocks.error || nativeLocks.status !== 0) {
  fail(nativeLocks.error?.message ?? nativeLocks.stderr.trim());
}

if (failures.length) {
  for (const message of failures) {
    console.error(`Dev Container input error: ${message}`);
  }
  process.exit(1);
}

console.log("Dev Container version and checksum inputs are valid");
