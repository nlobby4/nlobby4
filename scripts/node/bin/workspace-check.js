#!/usr/bin/env node

/**
 * Run shell-installed formatting and lint tools in their owning directories.
 * Native tools discover project configuration and ignore files themselves.
 * Independent repositories in projects/submodules are never enrolled.
 *
 * Usage: node scripts/node/bin/workspace-check.js <check>.
 *
 * @file Organization and project quality-check routing.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const commands = {
  format: ["prettier", ".", "--write"],
  "format:check": ["prettier", ".", "--check"],
  "lint:yaml": ["yamllint", "--strict", "."],
  "lint:editorconfig": ["editorconfig-checker"],
  "lint:js": [
    "eslint",
    ".",
    "--max-warnings",
    "0",
    "--no-error-on-unmatched-pattern",
  ],
  "lint:dockerfile": ["hadolint"],
};
const selected = process.argv[2];
if (process.argv.length !== 3 || !Object.hasOwn(commands, selected)) {
  console.error(
    `Usage: workspace-check.js <${Object.keys(commands).join("|")}>`,
  );
  process.exit(2);
}

// Only ordinary directories at the documented project roots are enrolled
function directories(directory) {
  if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory())
    return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(directory, entry.name));
}

const projects = path.join(root, "projects");
const owners = [
  root,
  ...directories(projects).filter(
    (directory) =>
      !["submodules", "packages"].includes(path.basename(directory)),
  ),
  ...directories(path.join(projects, "packages")),
];

for (const owner of owners) {
  const [command, ...args] = commands[selected];
  const options =
    selected === "lint:js" && owner === root ?
      ["*.config.js", "scripts/node", ...args.slice(1)]
    : [...args];
  if (selected === "lint:dockerfile") {
    // The shell's Dockerfile and negative fixture are checked by its task wrapper
    if (owner === root) continue;
    const listing = spawnSync(
      "git",
      [
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "--deduplicate",
        "-z",
        "--",
        ".",
      ],
      {
        cwd: owner,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    if (listing.error || listing.status !== 0) {
      console.error(`git: ${listing.error?.message ?? listing.stderr.trim()}`);
      process.exit(listing.status || 1);
    }
    const files = listing.stdout
      .split("\0")
      .filter(
        (file) =>
          file
          && /^(?:Dockerfile|Containerfile)(?:\..+)?$|\.(?:Dockerfile|Containerfile)$/iu.test(
            path.basename(file),
          )
          && fs.existsSync(path.join(owner, file))
          && fs.lstatSync(path.join(owner, file)).isFile(),
      );
    if (files.length === 0) continue;
    const config =
      [".hadolint.yaml", ".hadolint.yml"]
        .map((file) => path.join(owner, file))
        .find((file) => fs.existsSync(file))
      ?? path.join(root, ".hadolint.yaml");
    options.push("--config", config, "--", ...files);
  }
  if (selected === "format:check" && owner === root)
    options.push(
      "--cache",
      "--cache-location",
      ".cache/prettier/.prettiercache",
      "--cache-strategy",
      "content",
    );
  if (
    selected === "lint:yaml"
    && owner !== root
    && ![".yamllint", ".yamllint.yaml", ".yamllint.yml"].some((file) =>
      fs.existsSync(path.join(owner, file)),
    )
  )
    options.push("--config-file", path.join(root, ".yamllint.yaml"));
  if (
    selected === "lint:editorconfig"
    && owner !== root
    && !fs.existsSync(path.join(owner, ".editorconfig-checker.json"))
  )
    options.push("-config", path.join(root, ".editorconfig-checker.json"));
  console.log(
    `Running ${selected}: ${path.relative(root, owner) || "organization setup"}`,
  );
  const result = spawnSync(command, options, {
    cwd: owner,
    stdio: "inherit",
    env: {
      ...process.env,
      EC_VERSION: "v4.0.1",
      MISE_AUTO_INSTALL: "false",
      MISE_NOT_FOUND_AUTO_INSTALL: "false",
      PATH: [
        path.join(owner, "node_modules/.bin"),
        path.join(root, "node_modules/.bin"),
        process.env.PATH,
      ].join(path.delimiter),
    },
  });
  if (result.error) console.error(`${command}: ${result.error.message}`);
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
