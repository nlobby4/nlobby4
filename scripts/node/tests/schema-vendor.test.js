/**
 * Verify schema bundling, source alignment and offline validation in isolation.
 * Fixtures never fetch upstream content or change the real dependency graph.
 *
 * @file Schema vendoring and validation regression tests.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  bundleSchemas,
  schemaSources,
  verifySchemaVendor,
  assertLocalReferences,
} from "../lib/schema-vendor.js";
import { validateSchemas } from "../lib/schema-validator.js";

const repository = fileURLToPath(new URL("../../../", import.meta.url));

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "schema-vendor-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, value) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      typeof value === "string" ? value : `${JSON.stringify(value)}\n`,
    );
  };
  const sources = {
    schemaStoreRevision: "a".repeat(40),
    renovateVersion: "44.132.2",
    schemas: [{ file: "example.schema.json", store: "example.json" }],
  };
  write("schemas/sources.json", sources);
  write(
    "schemas/sources.schema.json",
    fs.readFileSync(
      path.join(repository, "schemas/sources.schema.json"),
      "utf8",
    ),
  );
  write(
    "scripts/node/bin/workspace-check.js",
    'const env = { EC_VERSION: "v4.0.1" };',
  );
  write("mise.toml", 'zizmor = "1.26.1"\n');
  fs.mkdirSync(path.join(root, "node_modules"));
  const read = async (url) => {
    if (/\/(LICENSE|license)$/u.test(url)) return "fixture license\n";
    if (url.endsWith("/example.json"))
      return JSON.stringify({
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          value: { $ref: "https://json.schemastore.org/value.json" },
        },
      });
    if (url.endsWith("/value.json"))
      return JSON.stringify({ type: "integer", minimum: 1 });
    throw new Error(`Unexpected test request: ${url}`);
  };
  return { root, write, sources, read };
}

test("bundles cross-references against a pinned commit and verifies offline", async (t) => {
  const f = fixture(t);
  const seen = [];
  const outputs = await bundleSchemas(f.root, async (url) => {
    seen.push(url);
    return f.read(url);
  });
  for (const [file, bytes] of outputs) f.write(file, bytes);
  assert.ok(
    seen.some((url) =>
      url.includes(`${"a".repeat(40)}/src/schemas/json/value.json`),
    ),
  );
  assertLocalReferences(JSON.parse(outputs.get("schemas/example.schema.json")));
  assert.doesNotThrow(() => verifySchemaVendor(f.root));
  f.write("example.json", { $schema: "schemas/example.schema.json", value: 0 });
  assert.match(validateSchemas(f.root).failures[0].message, /must be >= 1/u);
  f.write("example.json", { $schema: "schemas/example.schema.json", value: 1 });
  assert.deepEqual(validateSchemas(f.root).failures, []);
  assert.deepEqual([...(await bundleSchemas(f.root, f.read))], [...outputs]);
});

test("detects modified schema bytes, source revision and license drift", async (t) => {
  const f = fixture(t);
  const outputs = await bundleSchemas(f.root, f.read);
  for (const [file, bytes] of outputs) f.write(file, bytes);
  f.write("schemas/example.schema.json", "{}\n");
  assert.throws(() => verifySchemaVendor(f.root), /Schema drift/u);
  f.write(
    "schemas/example.schema.json",
    outputs.get("schemas/example.schema.json"),
  );
  f.write("schemas/sources.json", {
    ...f.sources,
    schemaStoreRevision: "b".repeat(40),
  });
  assert.throws(() => verifySchemaVendor(f.root), /Schema drift/u);
  f.write("schemas/sources.json", f.sources);
  f.write("licenses/schema/LICENSE.SchemaStore.txt", "changed\n");
  assert.throws(() => verifySchemaVendor(f.root), /license drift/u);
});

test("provenance order is independent of concurrent download completion", async (t) => {
  const f = fixture(t);
  const reader = (reverse) => async (url) => {
    if (url.endsWith("/example.json"))
      return JSON.stringify({
        properties: {
          first: { $ref: "https://json.schemastore.org/value.json" },
          second: { $ref: "https://json.schemastore.org/other.json" },
        },
      });
    if (url.endsWith("/value.json") || url.endsWith("/other.json")) {
      await new Promise((resolve) =>
        setTimeout(resolve, url.endsWith("/value.json") === reverse ? 15 : 1),
      );
      return '{"type":"string"}';
    }
    return f.read(url);
  };
  assert.deepEqual(
    [...(await bundleSchemas(f.root, reader(false)))],
    [...(await bundleSchemas(f.root, reader(true)))],
  );
});

test("rejects duplicates, unsafe paths and undeclared package versions", (t) => {
  const f = fixture(t);
  f.write("schemas/sources.json", {
    ...f.sources,
    schemas: [f.sources.schemas[0], f.sources.schemas[0]],
  });
  assert.throws(() => schemaSources(f.root), /duplicate/u);
  f.write("schemas/sources.json", {
    ...f.sources,
    schemas: [{ file: "../escape.schema.json", store: "example.json" }],
  });
  assert.throws(() => schemaSources(f.root), /Invalid schema source/u);
  f.write("package.json", { devDependencies: { example: "2.0.0" } });
  f.write("node_modules/example/package.json", { version: "1.0.0" });
  f.write("schemas/sources.json", {
    ...f.sources,
    schemas: [
      { file: "example.schema.json", package: "example", path: "schema.json" },
    ],
  });
  assert.throws(() => schemaSources(f.root), /Install locked dependencies/u);
});

test("rejects unapproved remote hosts and local-file reads from remote schemas", async (t) => {
  const f = fixture(t);
  await assert.rejects(
    bundleSchemas(
      f.root,
      async () => '{"$ref":"https://example.invalid/schema.json"}',
    ),
    /Unapproved/u,
  );
  f.write("secret.json", { type: "string" });
  await assert.rejects(
    bundleSchemas(f.root, async () =>
      JSON.stringify({ $ref: `file://${f.root}/secret.json` }),
    ),
    /escapes installed packages/u,
  );
});

test("failed downloads do not rewrite committed outputs", async (t) => {
  const f = fixture(t);
  f.write("schemas/example.schema.json", "existing\n");
  await assert.rejects(
    bundleSchemas(f.root, async () => {
      throw new Error("offline");
    }),
    /offline/u,
  );
  assert.equal(
    fs.readFileSync(path.join(f.root, "schemas/example.schema.json"), "utf8"),
    "existing\n",
  );
});

test("native downloads reject HTTP errors and oversized responses", async (t) => {
  const f = fixture(t);
  const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return new Response("unavailable", { status: 503 });
  });
  await assert.rejects(bundleSchemas(f.root), /503 fetching/u);
  fetch.mock.mockImplementation(
    async () => new Response(new Uint8Array(8 * 1024 * 1024 + 1)),
  );
  await assert.rejects(bundleSchemas(f.root), /Schema too large/u);
});

test("Renovate global adaptation preserves definitions and reports incompatible upstream shapes", async (t) => {
  const f = fixture(t);
  f.write("schemas/sources.json", {
    ...f.sources,
    schemas: [
      {
        file: "repository.schema.json",
        url: "https://unpkg.com/renovate@{version}/renovate-schema.json",
        versionFrom: "renovate",
      },
      {
        file: "global.schema.json",
        url: "https://unpkg.com/renovate@{version}/renovate-schema.json",
        versionFrom: "renovate",
        globalConfig: true,
      },
    ],
  });
  const upstream = {
    type: "object",
    properties: {
      allowedCommands: { type: "array", items: { type: "string" } },
    },
    not: { anyOf: [{ required: ["allowedCommands"] }] },
  };
  const outputs = await bundleSchemas(f.root, async (url) =>
    /\/(LICENSE|license)$/u.test(url) ? "license\n" : JSON.stringify(upstream),
  );
  const adapted = JSON.parse(outputs.get("schemas/global.schema.json"));
  assert.deepEqual(adapted.properties, upstream.properties);
  assert.equal(adapted.not, undefined);
  assert.deepEqual(
    JSON.parse(outputs.get("schemas/repository.schema.json")).not,
    upstream.not,
  );
  await assert.rejects(
    bundleSchemas(f.root, async () => '{"type":"object"}'),
    /adapter needs review/u,
  );
});

test("references in schema properties are checked while example data is untouched", () => {
  assert.doesNotThrow(() =>
    assertLocalReferences({ examples: [{ $ref: "https://example.invalid" }] }),
  );
  assert.throws(
    () =>
      assertLocalReferences({
        properties: { default: { $ref: "https://example.invalid" } },
      }),
    /Non-local/u,
  );
});

test("JSONC is validated and external configuration references fail offline", (t) => {
  const f = fixture(t);
  f.write("schemas/config.schema.json", {
    type: "object",
    properties: { enabled: { type: "boolean" } },
  });
  f.write(
    "config.jsonc",
    '// comment\n{"$schema":"schemas/config.schema.json","enabled":true,}\n',
  );
  assert.deepEqual(validateSchemas(f.root).failures, []);
  f.write(
    "config.jsonc",
    '{"$schema":"schemas/config.schema.json","enabled":"yes",}\n',
  );
  assert.match(validateSchemas(f.root).failures[0].message, /boolean/u);
  f.write(
    "config.jsonc",
    '{"$schema":"https://example.invalid/schema.json"}\n',
  );
  assert.match(validateSchemas(f.root).failures[0].message, /must be local/u);
});

test("schema validation skips local migration backups and independent templates", (t) => {
  const f = fixture(t);
  const baseline = validateSchemas(f.root);
  for (const directory of [
    ".local-work/migration",
    "projects/submodules/templates/existing",
  ])
    f.write(
      `${directory}/invalid.json`,
      '{"$schema":"https://example.invalid/schema.json"}',
    );
  const result = validateSchemas(f.root);
  assert.deepEqual(result, baseline);
});

test("real committed schemas have no runtime downloads and match tool versions", () => {
  assert.doesNotThrow(() => verifySchemaVendor(repository));
  const result = validateSchemas(repository);
  assert.deepEqual(result.failures, []);
  assert.equal(result.externalSchemaCount, 0);
  assert.ok(result.dataCount >= 18);
});
