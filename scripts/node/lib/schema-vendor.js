/**
 * Bundle explicit schema sources with the maintained JSON Schema Ref Parser.
 * Only updates access upstream sources; verification uses committed local
 * bytes.
 *
 * @file Local schema provenance, synchronization and offline integrity checks.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import Ajv from "ajv";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// Keep schema acquisition aligned with the declared tool, not the host PATH
function sourceVersion(root, name) {
  if (name === "editorconfig-checker") {
    const router = fs.readFileSync(
      path.join(root, "scripts/node/bin/workspace-check.js"),
      "utf8",
    );
    const version = /EC_VERSION:\s*"v?([0-9.]+)"/u.exec(router)?.[1];
    if (!version)
      throw new Error("Missing explicit EditorConfig checker version");
    return version;
  }
  const tools = fs.readFileSync(path.join(root, "mise.toml"), "utf8");
  const version = new RegExp(`^${name} = "([0-9.]+)"$`, "mu").exec(tools)?.[1];
  if (!version) throw new Error(`Missing exact mise version for ${name}`);
  return version;
}

// Resolve the installed, locked package and record its version for drift checks
export function schemaSources(root) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "schemas/sources.json"), "utf8"),
  );
  const validate = new Ajv().compile(
    JSON.parse(
      fs.readFileSync(path.join(root, "schemas/sources.schema.json"), "utf8"),
    ),
  );
  if (!validate(manifest))
    throw new Error(
      `Invalid schema source inventory: ${JSON.stringify(validate.errors)}`,
    );
  if (!/^[a-f0-9]{40}$/u.test(manifest.schemaStoreRevision))
    throw new Error("SchemaStore must be pinned to a commit");
  const seen = new Set();
  return manifest.schemas.map((entry) => {
    if (!/^[a-z0-9-]+\.schema\.json$/u.test(entry.file) || seen.has(entry.file))
      throw new Error(`Invalid or duplicate schema target: ${entry.file}`);
    seen.add(entry.file);
    if (entry.package) {
      if (!/^(?:@[a-z0-9-]+\/)?[a-z0-9-]+$/u.test(entry.package))
        throw new Error("Invalid schema package name");
      const packageFile = fs.realpathSync(
        path.join(root, "node_modules", entry.package, "package.json"),
      );
      const packageRoot = path.dirname(packageFile);
      const source = path.resolve(packageRoot, entry.path);
      if (!source.startsWith(`${packageRoot}${path.sep}`))
        throw new Error("Schema package path escapes its owner");
      const version = JSON.parse(fs.readFileSync(packageFile, "utf8")).version;
      const declared = JSON.parse(
        fs.readFileSync(path.join(root, "package.json"), "utf8"),
      );
      if (
        (declared.devDependencies?.[entry.package]
          ?? declared.dependencies?.[entry.package]) !== version
      )
        throw new Error(
          `Install locked dependencies before updating ${entry.package} schemas`,
        );
      return {
        file: entry.file,
        source,
        version,
        package: entry.package,
        packagePath: entry.path,
        packageRoot,
      };
    }
    const version =
      entry.versionFrom === "renovate" ? manifest.renovateVersion
      : entry.versionFrom ? sourceVersion(root, entry.versionFrom)
      : manifest.schemaStoreRevision;
    const source =
      entry.store ?
        `https://raw.githubusercontent.com/SchemaStore/schemastore/${version}/src/schemas/json/${entry.store}`
      : entry.url.replaceAll("{version}", version);
    return {
      file: entry.file,
      source,
      version,
      globalConfig: entry.globalConfig === true,
    };
  });
}

// Inspect schema keywords rather than examples that happen to contain $ref text
export function assertLocalReferences(schema) {
  if (!schema || typeof schema !== "object") return;
  for (const [key, value] of Object.entries(schema)) {
    if (
      [
        "properties",
        "patternProperties",
        "definitions",
        "$defs",
        "dependentSchemas",
        "dependencies",
      ].includes(key)
      && value
      && typeof value === "object"
    ) {
      for (const child of Object.values(value)) assertLocalReferences(child);
      continue;
    }
    if (["examples", "default", "enum", "const"].includes(key)) continue;
    if (
      ["$ref", "$dynamicRef", "$recursiveRef"].includes(key)
      && typeof value === "string"
      && !value.startsWith("#")
    )
      throw new Error(`Non-local schema reference: ${value}`);
    assertLocalReferences(value);
  }
}

// Resolve SchemaStore cross-references against the same pinned repository
export async function bundleSchemas(
  root,
  readRemote = async (url) => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
    const body = { size: 0, chunks: [] };
    for await (const chunk of response.body) {
      body.size += chunk.length;
      if (body.size > 8 * 1024 * 1024)
        throw new Error(`Schema too large: ${url}`);
      body.chunks.push(chunk);
    }
    return Buffer.concat(body.chunks).toString("utf8");
  },
) {
  const revision = JSON.parse(
    fs.readFileSync(path.join(root, "schemas/sources.json"), "utf8"),
  ).schemaStoreRevision;
  const sources = schemaSources(root);
  const records = {};
  const outputs = new Map();
  const licenses = {};
  for (const entry of sources) {
    const dependencies = {};
    const schema = await $RefParser.bundle(entry.source, {
      resolve: {
        file: false,
        http: false,
        packageFile: {
          order: 1,
          canRead: (file) => !/^https?:\/\//u.test(file.url),
          read(file) {
            const filename = fs.realpathSync(
              file.url.startsWith("file:") ? fileURLToPath(file.url) : file.url,
            );
            if (
              !filename.startsWith(
                `${fs.realpathSync(path.join(root, "node_modules"))}${path.sep}`,
              )
            )
              throw new Error(
                "Schema file reference escapes installed packages",
              );
            return fs.readFileSync(filename, "utf8");
          },
        },
        pinned: {
          order: 1,
          canRead: /^https?:\/\//u,
          async read(file) {
            const original = new URL(file.url);
            const url =
              (
                ["json.schemastore.org", "www.schemastore.org"].includes(
                  original.hostname,
                )
              ) ?
                `https://raw.githubusercontent.com/SchemaStore/schemastore/${revision}/src/schemas/json/${path.posix.basename(original.pathname)}`
              : original.href;
            if (
              !url.startsWith("https://raw.githubusercontent.com/")
              && !/^https:\/\/unpkg\.com\/renovate@[0-9.]+\/renovate-schema\.json$/u.test(
                url,
              )
            )
              throw new Error(`Unapproved schema source: ${url}`);
            const bytes = await readRemote(url);
            dependencies[url] = hash(bytes);
            return bytes;
          },
        },
      },
    });
    // Renovate's published schema forbids global options only at the root
    if (entry.globalConfig) {
      if (!Array.isArray(schema.not?.anyOf))
        throw new Error("Renovate global schema adapter needs review");
      delete schema.not;
      schema.title = `${schema.title} — administrator global configuration`;
    }
    assertLocalReferences(schema);
    const bytes = json(schema);
    outputs.set(`schemas/${entry.file}`, bytes);
    records[entry.file] = {
      source:
        entry.package ?
          `${entry.package}@${entry.version}/${entry.packagePath}`
        : entry.source,
      version: entry.version,
      sha256: hash(bytes),
      dependencies: Object.fromEntries(
        Object.keys(dependencies)
          .sort()
          .map((url) => [url, dependencies[url]]),
      ),
      globalConfig: entry.globalConfig === true,
    };
    if (entry.package) {
      const license = `LICENSE.${entry.package}.txt`;
      const bytes = fs.readFileSync(
        path.join(entry.packageRoot, "LICENSE"),
        "utf8",
      );
      outputs.set(`licenses/schema/${license}`, bytes);
      licenses[`schema/${license}`] = hash(bytes);
    }
  }
  for (const [name, url] of [
    [
      "SchemaStore",
      `https://raw.githubusercontent.com/SchemaStore/schemastore/${revision}/LICENSE`,
    ],
    [
      "Renovate",
      `https://unpkg.com/renovate@${JSON.parse(fs.readFileSync(path.join(root, "schemas/sources.json"))).renovateVersion}/license`,
    ],
    [
      "editorconfig-checker",
      `https://raw.githubusercontent.com/editorconfig-checker/editorconfig-checker/v${sourceVersion(root, "editorconfig-checker")}/LICENSE`,
    ],
    [
      "zizmor",
      `https://raw.githubusercontent.com/woodruffw/zizmor/v${sourceVersion(root, "zizmor")}/LICENSE`,
    ],
  ]) {
    const bytes = await readRemote(url);
    const file = `LICENSE.${name}.txt`;
    outputs.set(`licenses/schema/${file}`, bytes);
    licenses[`schema/${file}`] = hash(bytes);
  }
  outputs.set(
    "schemas/sources.lock.json",
    json({ schemas: records, licenses }),
  );
  return outputs;
}

// Fail on tool drift or changed local schema bytes without accessing the network
export function verifySchemaVendor(root) {
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "schemas/sources.lock.json"), "utf8"),
  );
  const sources = schemaSources(root);
  if (Object.keys(lock.schemas).length !== sources.length)
    throw new Error(
      "Schema source inventory drifted; run pnpm run schemas:update",
    );
  for (const entry of sources) {
    const record = lock.schemas[entry.file];
    const expectedSource =
      entry.package ?
        `${entry.package}@${entry.version}/${entry.packagePath}`
      : entry.source;
    const bytes = fs.readFileSync(
      path.join(root, "schemas", entry.file),
      "utf8",
    );
    if (
      !record
      || record.version !== entry.version
      || record.source !== expectedSource
      || record.globalConfig !== (entry.globalConfig === true)
      || record.sha256 !== hash(bytes)
    )
      throw new Error(
        `Schema drift: ${entry.file}; run pnpm run schemas:update`,
      );
    assertLocalReferences(JSON.parse(bytes));
  }
  for (const [file, expected] of Object.entries(lock.licenses ?? {})) {
    if (
      !/^schema\/LICENSE\.[a-zA-Z0-9-]+\.txt$/u.test(file)
      || hash(fs.readFileSync(path.join(root, "licenses", file))) !== expected
    )
      throw new Error(`Schema license drift: ${file}`);
  }
}
