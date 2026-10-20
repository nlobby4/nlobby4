#!/usr/bin/env node

/**
 * Updates the mise bootstrap version, both Linux hashes and the CI bootstrap.
 * Prepares and validates the complete candidate before replacing source files.
 *
 * Usage: node scripts/node/bin/update-mise-bootstrap.js VERSION.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isScalar, parseDocument } from "yaml";

import {
  bootstrapFiles as files,
  applyBootstrapChanges,
  recoverBootstrapUpdate,
} from "../lib/bootstrap-transaction.js";
const validationFiles = [
  ...Object.values(files),
  ".devcontainer/devcontainer.json",
  ".devcontainer/devcontainer-lock.json",
  ".devcontainer/Dockerfile",
  "schemas/devcontainer.schema.json",
  "mise.lock",
  ".mise/aqua.yaml",
];
const validator = fileURLToPath(
  new URL("validate-devcontainer-inputs.js", import.meta.url),
);

// Publisher key: https://mise.jdx.dev/installing-mise.html#github-releases
// Key rotation requires an explicit review, not trust in downloaded metadata.
const publisherKey = "RWTC3g8W3z4RZK3V3qv7fa1QY4JEWyBtqIHW+85QlJpZc5yG+uNYNBSZ";

export function verifyMiseManifest(manifest, signature) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mise-signature-"));
  try {
    const filename = path.join(directory, "SHASUMS256.txt");
    fs.writeFileSync(filename, manifest, { mode: 0o600 });
    fs.writeFileSync(`${filename}.minisig`, signature, { mode: 0o600 });
    const verification = spawnSync(
      "minisign",
      ["-Vm", filename, "-x", `${filename}.minisig`, "-P", publisherKey],
      {
        encoding: "utf8",
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          MISE_AUTO_INSTALL: "false",
          MISE_NOT_FOUND_AUTO_INSTALL: "false",
        },
      },
    );
    if (verification.error || verification.status !== 0) {
      throw new Error(
        `mise publisher signature verification failed: ${verification.error?.message ?? (verification.stderr.trim() || "minisign failed")}`,
      );
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function nativeFiles(root, directory = ".mise/locks") {
  return fs
    .readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const name = path.posix.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`unexpected native lock symlink: ${name}`);
      return entry.isDirectory() ? nativeFiles(root, name) : [name];
    });
}

async function download(url, fetcher) {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(30000),
    headers: { "User-Agent": "nlobby4-mise-updater" },
  });
  if (!response.ok)
    throw new Error(`download failed: HTTP ${response.status} (${url})`);
  const chunks = [];
  const size = { bytes: 0 };
  for await (const chunk of response.body) {
    size.bytes += chunk.length;
    if (size.bytes > 1024 * 1024)
      throw new Error(`download exceeds 1 MiB (${url})`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function replaceOnce(text, pattern, replacement, description) {
  if ([...text.matchAll(pattern)].length !== 1) {
    throw new Error(`expected exactly one ${description}`);
  }
  return text.replace(pattern, replacement);
}

function updateAction(text, version) {
  const document = parseDocument(text);
  if (document.errors.length)
    throw new Error(`invalid CI YAML: ${document.errors[0].message}`);
  const steps = document.getIn(["runs", "steps"], true);
  const bootstrap =
    steps?.items?.filter((step) =>
      String(step.get?.("uses") ?? "").startsWith("jdx/mise-action@"),
    ) ?? [];
  if (bootstrap.length !== 1)
    throw new Error("expected exactly one CI mise bootstrap step");
  const scalar = bootstrap[0].getIn(["with", "version"], true);
  if (!isScalar(scalar) || !scalar.range)
    throw new Error("CI mise bootstrap must have a literal version");
  // Use the YAML parser's scalar range to preserve every unrelated line/comment.
  return text.slice(0, scalar.range[0]) + version + text.slice(scalar.range[1]);
}

function releaseAsset(release, name) {
  const matches = release.assets?.filter((asset) => asset.name === name) ?? [];
  if (
    matches.length !== 1
    || !/^sha256:[a-f0-9]{64}$/.test(matches[0].digest ?? "")
  ) {
    throw new Error(
      `missing, duplicate or unverifiable release asset: ${name}`,
    );
  }
  return matches[0].digest.slice("sha256:".length);
}

/** Prepare, validate and apply one explicitly selected stable release. */
export async function updateMiseBootstrap({
  version,
  root = process.cwd(),
  fetcher = fetch,
}) {
  if (
    !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version ?? "")
  ) {
    throw new Error("mise version must be explicit, for example 2026.9.18");
  }
  const selected = version.split(".").map(Number);
  const minimum = [2026, 9, 18];
  const difference = selected
    .map((part, index) => part - minimum[index])
    .find((part) => part !== 0);
  if (difference < 0)
    throw new Error("native locks require mise 2026.9.18 or newer");
  const recovery = recoverBootstrapUpdate(root);
  if (recovery !== "none")
    console.log(`Recovered bootstrap update (${recovery})`);
  const originals = new Map(
    [...validationFiles, ...nativeFiles(root)].map((name) => {
      const target = path.join(root, name);
      if (!fs.lstatSync(target).isFile())
        throw new Error(`expected a regular file: ${name}`);
      return [name, fs.readFileSync(target)];
    }),
  );
  const release = JSON.parse(
    (
      await download(
        `https://api.github.com/repos/jdx/mise/releases/tags/v${version}`,
        fetcher,
      )
    ).toString("utf8"),
  );
  if (
    release.tag_name !== `v${version}`
    || release.draft !== false
    || release.prerelease !== false
  ) {
    throw new Error(
      "expected a published stable mise release matching the requested version",
    );
  }
  const url = `https://github.com/jdx/mise/releases/download/v${version}/SHASUMS256.txt`;
  const manifest = await download(url, fetcher);
  if (
    createHash("sha256").update(manifest).digest("hex")
    !== releaseAsset(release, "SHASUMS256.txt")
  ) {
    throw new Error(
      "upstream checksum manifest does not match its release digest",
    );
  }
  const signature = await download(`${url}.minisig`, fetcher);
  verifyMiseManifest(manifest, signature);
  const hashes = new Map();
  for (const line of manifest.toString("utf8").split(/\r?\n/u)) {
    if (!line || line.startsWith("#")) continue;
    const match = /^([a-f0-9]{64})[ \t]+\*?(?:\.\/)?(\S+)$/u.exec(line);
    if (!match) throw new Error("malformed upstream checksum entry");
    if (hashes.has(match[2]))
      throw new Error(`duplicate upstream checksum: ${match[2]}`);
    hashes.set(match[2], match[1]);
  }
  const entries = ["x64", "arm64"].map((architecture) => {
    const asset = `mise-v${version}-linux-${architecture}`;
    const hash = hashes.get(asset);
    if (!hash || hash !== releaseAsset(release, asset)) {
      throw new Error(`missing or mismatched upstream checksum: ${asset}`);
    }
    return `${hash}  ${asset}`;
  });
  const previousChecksums = originals.get(files.checksums).toString("utf8");
  const records = previousChecksums
    .split("\n")
    .filter((line) => line && !line.startsWith("#"));
  if (
    records.length !== 2
    || !records.every((line) =>
      /^[a-f0-9]{64} {2}mise-v[0-9.]+-linux-(x64|arm64)$/u.test(line),
    )
  ) {
    throw new Error(
      "local checksum file must contain only the two mise Linux entries",
    );
  }
  const header = previousChecksums
    .split("\n")
    .filter((line) => !line || line.startsWith("#"))
    .join("\n")
    .trimEnd();
  const proposed = new Map([
    [
      files.config,
      replaceOnce(
        originals.get(files.config).toString("utf8"),
        /^min_version = "[^"]+"$/gmu,
        `min_version = "${version}"`,
        "minimum mise version",
      ),
    ],
    [
      files.versions,
      replaceOnce(
        originals.get(files.versions).toString("utf8"),
        /^MISE_VERSION=.*$/gmu,
        `MISE_VERSION=${version}`,
        "MISE_VERSION assignment",
      ),
    ],
    [
      files.checksums,
      `${replaceOnce(header, /https:\/\/github\.com\/jdx\/mise\/releases\/download\/v[^/\s]+\/SHASUMS256\.txt$/gmu, url, "upstream checksum URL")}\n\n${entries.join("\n")}\n`,
    ],
    [
      files.action,
      updateAction(originals.get(files.action).toString("utf8"), version),
    ],
  ]);
  const scratch = fs.mkdtempSync(
    path.join(os.tmpdir(), "mise-bootstrap-update-"),
  );
  try {
    for (const [name, contents] of originals) {
      for (const directory of ["before", "after"]) {
        const target = path.join(scratch, directory, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
          target,
          directory === "after" ? (proposed.get(name) ?? contents) : contents,
        );
      }
    }
    const validation = spawnSync(process.execPath, [validator], {
      cwd: path.join(scratch, "after"),
      encoding: "utf8",
      timeout: 10000,
    });
    if (validation.error || validation.status !== 0) {
      throw new Error(
        `candidate validation failed: ${validation.error?.message ?? validation.stderr.trim()}`,
      );
    }
    const diff = spawnSync(
      "git",
      [
        "diff",
        "--no-index",
        "--no-prefix",
        "--color=never",
        "--",
        "before",
        "after",
      ],
      { cwd: scratch, encoding: "utf8", timeout: 10000 },
    );
    if (diff.error || ![0, 1].includes(diff.status))
      throw new Error(
        `could not generate update diff: ${diff.error?.message ?? diff.stderr.trim()}`,
      );
    if (
      JSON.stringify(nativeFiles(root).sort())
      !== JSON.stringify(
        [...originals.keys()]
          .filter((name) => name.startsWith(".mise/locks/"))
          .sort(),
      )
    ) {
      throw new Error(
        "native lock files changed during update; retry after reviewing them",
      );
    }
    if (diff.status === 1) applyBootstrapChanges(root, originals, proposed);
    return { changed: diff.status === 1, diff: diff.stdout };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: update-mise-bootstrap.js VERSION");
    const result = await updateMiseBootstrap({ version: process.argv[2] });
    process.stdout.write(result.diff);
    console.log(
      result.changed ?
        `Updated mise bootstrap to ${process.argv[2]}`
      : `Mise bootstrap ${process.argv[2]} already matches upstream`,
    );
  } catch (error) {
    console.error(`Mise bootstrap update failed: ${error.message}`);
    process.exitCode = 1;
  }
}
