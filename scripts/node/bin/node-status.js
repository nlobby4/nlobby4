#!/usr/bin/env node

/**
 * Reports Node.js runtime and dependency metadata as JSON status rows.
 * Validates metadata and package bytes against a frozen offline reference
 * install.
 *
 * Usage: node scripts/node/bin/node-status.js.
 *
 * @file Node.js metadata utility.
 *
 * @author sphoon
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { parse } from "yaml";

// A readiness probe must not cause mise shims to install anything.
process.env.MISE_AUTO_INSTALL = "false";
process.env.MISE_NOT_FOUND_AUTO_INSTALL = "false";
// A host's pnpm may be a Corepack shim; probes must not download or edit manifests.
process.env.COREPACK_ENABLE_NETWORK = "0";
process.env.COREPACK_ENABLE_DOWNLOAD_PROMPT = "0";
process.env.COREPACK_ENABLE_AUTO_PIN = "0";

const lockfilePath = "pnpm-lock.yaml";
const installedLockfilePath = "node_modules/.pnpm/lock.yaml";
const miseConfigPath = "mise.toml";
// Finish command probes before the Bash wrapper's 35-second hard deadline.
const probeDeadline = Date.now() + 30_000;

class PackageIntegrityError extends Error {}

/**
 * Compare registry package payloads without following dependency/workspace
 * links.
 */
function comparePackageContents(
  reference,
  installed,
  referenceRoot,
  installedRoot,
) {
  if (!fs.existsSync(reference)) return;
  const entries = fs.readdirSync(reference, { withFileTypes: true });
  const metadata = (name) =>
    (path.basename(reference) === "node_modules"
      && [".modules.yaml", ".pnpm-workspace-state-v1.json"].includes(name))
    || (path.basename(reference) === ".pnpm" && name === "lock.yaml");
  const expectedNames = new Set(entries.map((entry) => entry.name));
  for (const name of fs.readdirSync(installed)) {
    // pnpm may retain unused package versions in its virtual store after updates.
    if (
      path.basename(reference) !== ".pnpm"
      && !(path.basename(reference) === "node_modules" && name === ".pnpm")
      && !metadata(name)
      && !expectedNames.has(name)
    )
      throw new Error(
        `unexpected package entry: ${path.relative(installedRoot, path.join(installed, name))}`,
      );
  }
  for (const entry of entries) {
    // Metadata contains environment-specific paths; lock contents are checked separately.
    if (metadata(entry.name)) continue;
    const expectedPath = path.join(reference, entry.name);
    const actualPath = path.join(installed, entry.name);
    if (entry.isSymbolicLink()) {
      if (!fs.lstatSync(actualPath).isSymbolicLink())
        throw new Error(`package link differs: ${entry.name}`);
      const normalize = (target, root) =>
        target.replaceAll(root, "<workspace>");
      if (
        normalize(fs.readlinkSync(expectedPath), referenceRoot)
        !== normalize(fs.readlinkSync(actualPath), installedRoot)
      )
        throw new Error(`package link differs: ${entry.name}`);
      continue;
    }
    if (entry.isDirectory()) {
      const actual = fs.lstatSync(actualPath);
      if (!actual.isDirectory())
        throw new Error(`package directory differs: ${entry.name}`);
      comparePackageContents(
        expectedPath,
        actualPath,
        referenceRoot,
        installedRoot,
      );
    } else if (entry.isFile()) {
      const actual = fs.lstatSync(actualPath);
      if (!actual.isFile())
        throw new Error(`package file differs: ${entry.name}`);
      const hash = (file, root) => {
        const contents = fs.readFileSync(file);
        const data =
          file.includes(`${path.sep}.bin${path.sep}`) ?
            contents.toString("utf8").replaceAll(root, "<workspace>")
          : contents;
        return createHash("sha256").update(data).digest("hex");
      };
      if (
        hash(expectedPath, referenceRoot) !== hash(actualPath, installedRoot)
        || (fs.statSync(expectedPath).mode & 0o111) !== (actual.mode & 0o111)
      )
        throw new Error(`package content differs: ${entry.name}`);
    }
  }
}

/**
 * Validate cached package hashes and installed bytes without repairing
 * anything.
 */
function checkPackageIntegrity(pnpm, scratch, root) {
  try {
    const store = spawnSync(pnpm, ["store", "status"], probeOptions(8000));
    if (store.error || store.status !== 0)
      throw new Error("pnpm store contains modified or unverifiable packages");
    // The prior lock-only probe can leave partial installation metadata.
    fs.rmSync(path.join(scratch, "node_modules"), {
      recursive: true,
      force: true,
    });
    const result = spawnSync(
      pnpm,
      [
        "install",
        "--frozen-lockfile",
        "--ignore-scripts",
        "--ignore-pnpmfile",
        "--offline",
        "--package-import-method=copy",
        "--verify-store-integrity",
      ],
      probeOptions(15000, scratch),
    );
    if (result.error || result.status !== 0) {
      const details =
        result.error?.message
        || result.stderr
        || result.stdout
        || "command failed";
      const failure =
        details.split("\n").find((line) => line.includes("ERR_PNPM"))
        || details.slice(-400);
      throw new Error(`offline reference install failed: ${failure}`);
    }
    if (
      fs.existsSync(path.join(root, "node_modules/.pnpm"))
      && !fs.existsSync(path.join(scratch, "node_modules/.pnpm"))
    ) {
      // An empty dependency graph may legitimately have no virtual store.
      const lock = parse(
        fs.readFileSync(path.join(scratch, lockfilePath), "utf8"),
      );
      if (Object.keys(lock.packages ?? {}).length)
        throw new Error("reference package tree is missing");
    }
    comparePackageContents(
      path.join(scratch, "node_modules"),
      path.join(root, "node_modules"),
      scratch,
      root,
    );
    const projects = spawnSync(
      pnpm,
      ["list", "--recursive", "--depth", "-1", "--json"],
      { ...probeOptions(5000), cwd: scratch },
    );
    if (projects.error || projects.status !== 0)
      throw new Error("reference workspace could not be enumerated");
    for (const project of JSON.parse(projects.stdout)) {
      const relative = path.relative(scratch, project.path);
      if (relative.startsWith("..") || path.isAbsolute(relative))
        throw new Error("reference workspace escapes scratch directory");
      if (relative)
        comparePackageContents(
          path.join(project.path, "node_modules"),
          path.join(root, relative, "node_modules"),
          scratch,
          root,
        );
    }
  } catch (error) {
    throw new PackageIntegrityError(
      String(error.message).replace(/[\r\n\t]/g, " "),
    );
  }
}

/** Keep individual probes within one shared budget with closed stdin. */
function probeOptions(timeout, cwd) {
  return {
    cwd,
    encoding: "utf8",
    timeout: Math.max(1, Math.min(timeout, probeDeadline - Date.now())),
    killSignal: "SIGKILL",
    stdio: ["ignore", "pipe", "pipe"],
  };
}

/**
 * Checks whether a path resolves to a regular file.
 *
 * @param {string} filePath Path to inspect.
 *
 * @returns {boolean} Whether the path is a regular file.
 */
function isRegularFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Checks whether a path resolves to a directory.
 *
 * @param {string} directoryPath Path to inspect.
 *
 * @returns {boolean} Whether the path is a directory.
 */
function isDirectory(directoryPath) {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Reads the exact Node.js version configured by mise.
 *
 * @returns {string | undefined} Configured version when available.
 */
function expectedNodeVersion() {
  if (!fs.existsSync(miseConfigPath)) return undefined;

  return commandOutput("mise", [
    "config",
    "get",
    "tools.node",
    "--file",
    miseConfigPath,
  ]);
}

/**
 * Reads the exact pnpm version from the package manager declaration.
 *
 * @param {Record<string, unknown>} packageManifest Root package manifest.
 *
 * @returns {string | undefined} Configured version when available.
 */
function expectedPnpmVersion(packageManifest) {
  if (typeof packageManifest.packageManager !== "string") return undefined;

  const match = packageManifest.packageManager.match(/^pnpm@(.+)$/);
  return match?.[1];
}

/**
 * Returns a command's single-line output.
 *
 * @param {string} command Executable name.
 * @param {string[]} args Command arguments.
 *
 * @returns {string | undefined} Output when the command succeeds.
 */
function commandOutput(command, args) {
  const result = spawnSync(command, args, probeOptions(5000));

  if (result.error || result.status !== 0) return undefined;

  const output = result.stdout.trim();
  return output && !/[\r\n]/u.test(output) ? output : undefined;
}

/**
 * Returns a command's single-line version output.
 *
 * @param {string} command Executable name.
 *
 * @returns {string | undefined} Version output when the command succeeds.
 */
function commandVersion(command) {
  return commandOutput(command, ["--version"]);
}

/** Verify manifests in a disposable directory, never in the real workspace. */
function checkDependencies() {
  const root = process.cwd();
  const pnpm = commandOutput("mise", ["which", "pnpm"]);
  if (!pnpm) throw new Error("pnpm executable could not be resolved");
  const projectsResult = spawnSync(
    pnpm,
    ["list", "--recursive", "--depth", "-1", "--json"],
    probeOptions(10000),
  );
  if (projectsResult.error || projectsResult.status !== 0) {
    throw new Error("workspace manifests could not be enumerated");
  }
  const projects = JSON.parse(projectsResult.stdout);
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error("workspace manifests could not be enumerated");
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "node-readiness-"));
  try {
    for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]) {
      if (fs.existsSync(file)) fs.copyFileSync(file, path.join(scratch, file));
    }
    for (const project of projects) {
      const relative = path.relative(root, project.path);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("workspace package is outside the repository");
      }
      const destination = path.join(scratch, relative);
      fs.mkdirSync(destination, { recursive: true });
      fs.copyFileSync(
        path.join(project.path, "package.json"),
        path.join(destination, "package.json"),
      );
      const manifest = JSON.parse(
        fs.readFileSync(path.join(project.path, "package.json"), "utf8"),
      );
      for (const name of Object.keys({
        ...manifest.dependencies,
        ...manifest.devDependencies,
      })) {
        const installedPath = path.join(
          project.path,
          "node_modules",
          name,
          "package.json",
        );
        if (!isRegularFile(installedPath))
          throw new Error(`missing installed package: ${name}`);
        const installed = JSON.parse(fs.readFileSync(installedPath, "utf8"));
        const bins =
          typeof installed.bin === "string" ?
            [name.split("/").at(-1)]
          : Object.keys(installed.bin ?? {});
        for (const bin of bins) {
          fs.accessSync(
            path.join(project.path, "node_modules", ".bin", bin),
            fs.constants.X_OK,
          );
        }
      }
    }
    const result = spawnSync(
      pnpm,
      [
        "install",
        "--lockfile-only",
        "--frozen-lockfile",
        "--ignore-scripts",
        "--ignore-pnpmfile",
        "--offline",
      ],
      probeOptions(15000, scratch),
    );
    if (result.error || result.status !== 0) {
      throw new Error(
        "manifests and lockfile are inconsistent; run pnpm install",
      );
    }
    const expected = parse(fs.readFileSync(lockfilePath, "utf8"));
    const installed = parse(fs.readFileSync(installedLockfilePath, "utf8"));
    if (!isDeepStrictEqual(expected, installed)) {
      throw new Error(
        "installed lock differs; run pnpm install --frozen-lockfile",
      );
    }
    checkPackageIntegrity(pnpm, scratch, root);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Builds Node.js status rows.
 *
 * @returns {{ label: string; value: string; ok: boolean }[]} Status rows.
 */
function statusRows() {
  if (!fs.existsSync("package.json")) {
    return [];
  }

  let packageManifest;
  try {
    packageManifest = JSON.parse(fs.readFileSync("package.json", "utf8"));
  } catch (error) {
    return [
      {
        label: "Node.js manifest",
        ok: false,
        value:
          error instanceof SyntaxError ?
            "package.json contains invalid JSON"
          : "package.json could not be read",
      },
    ];
  }

  if (
    packageManifest === null
    || typeof packageManifest !== "object"
    || Array.isArray(packageManifest)
  ) {
    return [
      {
        label: "Node.js manifest",
        ok: false,
        value: "package.json must contain a JSON object",
      },
    ];
  }

  const nodeVersion = process.version.replace(/^v/, "");
  const configuredNodeVersion = expectedNodeVersion();
  const pnpmVersion = commandVersion("pnpm");
  const configuredPnpmVersion = expectedPnpmVersion(packageManifest);
  const npmVersion = commandVersion("npm");
  const rows = [
    {
      label: "Node.js runtime",
      ok: nodeVersion === configuredNodeVersion,
      value: `${nodeVersion} (expected ${configuredNodeVersion ?? "unavailable"})`,
    },
    {
      label: "pnpm runtime",
      ok: pnpmVersion === configuredPnpmVersion,
      value:
        pnpmVersion ?
          `${pnpmVersion} (expected ${configuredPnpmVersion ?? "unavailable"})`
        : "unavailable",
    },
    {
      label: "npm runtime",
      ok: npmVersion !== undefined,
      value: npmVersion ?? "unavailable",
    },
  ];

  const lockfileExists = fs.existsSync(lockfilePath);
  const hasLockfile = isRegularFile(lockfilePath);
  const nodeModulesExists = fs.existsSync("node_modules");
  const hasNodeModules = isDirectory("node_modules");

  if (!hasLockfile) {
    return [
      ...rows,
      {
        label: "Node.js dependencies",
        ok: false,
        value:
          lockfileExists ?
            "pnpm-lock.yaml is not a regular file"
          : 'pnpm-lock.yaml missing; run "pnpm install"',
      },
    ];
  }

  if (!hasNodeModules) {
    return [
      ...rows,
      {
        label: "Node.js dependencies",
        ok: false,
        value:
          nodeModulesExists ?
            "node_modules is not a directory"
          : "node_modules missing; run pnpm install --frozen-lockfile",
      },
    ];
  }

  if (!isRegularFile(installedLockfilePath)) {
    return [
      ...rows,
      {
        label: "Node.js dependencies",
        ok: false,
        value: "install state could not be verified",
      },
    ];
  }

  try {
    checkDependencies();
  } catch (error) {
    if (error instanceof PackageIntegrityError) {
      return [
        ...rows,
        {
          label: "Node.js dependencies",
          ok: true,
          value: "installation metadata verified",
        },
        { label: "Node.js package integrity", ok: false, value: error.message },
      ];
    }
    return [
      ...rows,
      {
        label: "Node.js dependencies",
        ok: false,
        value: String(error.message).replace(/[\r\n\t]/g, " "),
      },
    ];
  }

  return [
    ...rows,
    {
      label: "Node.js dependencies",
      ok: true,
      value: "installed",
    },
    {
      label: "Node.js package integrity",
      ok: true,
      value: "store hashes and installed package bytes verified",
    },
  ];
}

console.log(JSON.stringify(statusRows()));
