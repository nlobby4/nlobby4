import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

import Ajv from "ajv";
import Ajv2019 from "ajv/dist/2019.js";
import Ajv2020 from "ajv/dist/2020.js";
import { parse as parseYaml } from "yaml";
import { parse as parseJsonc } from "jsonc-parser";
import addFormats from "ajv-formats";

const ignoredDirectories = new Set([
  ".cache",
  ".generated",
  ".git",
  ".local-work",
  "dist",
  "node_modules",
]);

const dataExtensions = new Set([".json", ".jsonc", ".yaml", ".yml"]);

/**
 * @typedef {object} ValidationFailure
 *
 * @property {string} file
 * @property {string} message
 */

/**
 * @typedef {object} SchemaReference
 *
 * @property {string} dataFile
 * @property {string} schemaReference
 */

/**
 * Returns whether a directory entry should be skipped during repository scans.
 *
 * @param {string} name - Directory name.
 *
 * @returns {boolean} Whether the directory should be skipped.
 */
function isIgnoredDirectory(name) {
  return ignoredDirectories.has(name);
}

/**
 * Recursively walks a directory.
 *
 * @param {string} directory - Directory to walk.
 *
 * @returns {string[]} File paths.
 */
function walkFiles(directory, root = directory) {
  const files = [];

  if (!fs.existsSync(directory)) {
    return files;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory()
      && (isIgnoredDirectory(entry.name)
        || (directory === root && entry.name === "projects"))
    ) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath, root));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Parses JSON or YAML from disk.
 *
 * @param {string} file - File path.
 *
 * @returns {unknown} Parsed data.
 */
function readDataFile(file) {
  const contents = fs.readFileSync(file, "utf8");
  const extension = path.extname(file);

  if (extension === ".json") {
    return JSON.parse(contents);
  }

  if (extension === ".jsonc") {
    const errors = [];
    const result = parseJsonc(contents, errors, { allowTrailingComma: true });
    if (errors.length)
      throw new Error(`invalid JSONC at offset ${errors[0].offset}`);
    return result;
  }

  if (extension === ".yaml" || extension === ".yml") {
    return parseYaml(contents);
  }

  throw new Error(`unsupported data file extension: ${extension}`);
}

/**
 * Formats Ajv validation errors.
 *
 * @param {import("ajv").ErrorObject[] | null | undefined} errors - Ajv errors.
 *
 * @returns {string} Human-readable error text.
 */
function formatAjvErrors(errors) {
  return (errors ?? [])
    .map((error) => {
      const location = error.instancePath || "/";
      return `${location} ${error.message ?? "is invalid"}`;
    })
    .join("; ");
}

/**
 * Creates an Ajv instance for a schema draft.
 *
 * @param {string | undefined} schemaUri - Schema URI from $schema.
 *
 * @returns {Ajv} Ajv instance.
 */
function createAjv(schemaUri) {
  const options = {
    allErrors: true,
    allowUnionTypes: true,
    strict: false,
    formats: { uint64: true, uint: true },
  };

  if (schemaUri?.includes("2020-12")) {
    return addFormats(new Ajv2020(options));
  }

  if (schemaUri?.includes("2019-09")) {
    return addFormats(new Ajv2019(options));
  }

  return addFormats(new Ajv(options));
}

/**
 * Returns the schema URI when the parsed data is a JSON Schema object.
 *
 * @param {unknown} schema - Parsed schema.
 *
 * @returns {string | undefined} Schema URI.
 */
function schemaUri(schema) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return undefined;
  }

  const value = schema.$schema;
  return typeof value === "string" ? value : undefined;
}

/**
 * Returns a stable file URL key for a schema file.
 *
 * @param {string} file - Schema file path.
 *
 * @returns {string} Schema key.
 */
function schemaKey(file) {
  return pathToFileURL(file).href;
}

/**
 * Returns all JSON Schema files in repository schema directories.
 *
 * @param {string} root - Repository root.
 *
 * @returns {string[]} Schema file paths.
 */
function findSchemaFiles(root) {
  return walkFiles(root).filter((file) => {
    const normalized = file.split(path.sep).join("/");
    return normalized.includes("/schemas/") && file.endsWith(".schema.json");
  });
}

/**
 * Resolves a schema path relative to a data file.
 *
 * @param {string} dataFile - Data file path.
 * @param {string} schemaReference - Schema path from a modeline.
 *
 * @returns {string} Resolved schema path.
 */
function resolveSchemaReference(dataFile, schemaReference) {
  if (/^https?:\/\//u.test(schemaReference)) {
    return schemaReference;
  }

  return path.resolve(path.dirname(dataFile), schemaReference);
}

/**
 * Finds a yaml-language-server schema modeline in a data file.
 *
 * @param {string} file - Data file path.
 *
 * @returns {string | undefined} Referenced schema path.
 */
function schemaReferenceFromModeline(file) {
  const contents = fs.readFileSync(file, "utf8");
  if (file.endsWith(".schema.json")) return undefined;
  // Only parse JSON that opts in; editor JSON-with-comments need not be JSON.
  if (
    [".json", ".jsonc"].includes(path.extname(file))
    && /"\$schema"\s*:/u.test(contents)
  ) {
    const reference = readDataFile(file)?.$schema;
    if (typeof reference === "string") return reference;
  }
  const modeline = contents
    .split("\n")
    .slice(0, 20)
    .find((line) => line.includes("yaml-language-server:"));

  return /(?:^|\s)\$schema=([^\s]+)/u.exec(modeline ?? "")?.[1];
}

/**
 * Finds data files that declare a schema modeline.
 *
 * @param {string} root - Repository root.
 *
 * @returns {SchemaReference[]} Schema references.
 */
function findSchemaReferences(root) {
  return walkFiles(root)
    .filter((file) => dataExtensions.has(path.extname(file)))
    .map((dataFile) => ({
      dataFile,
      schemaReference: schemaReferenceFromModeline(dataFile),
    }))
    .filter((reference) => reference.schemaReference);
}

/**
 * Finds data files that opt into schema validation.
 *
 * @param {string} root - Repository root.
 * @param {Set<string>} schemaFiles - Known schema files.
 *
 * @returns {{ dataFile: string; schemaFile: string }[]} Validation pairs.
 */
function findValidationPairs(root, schemaFiles) {
  const pairs = new Map();

  for (const { dataFile, schemaReference } of findSchemaReferences(root)) {
    const schemaFile = resolveSchemaReference(dataFile, schemaReference);
    if (schemaFiles.has(schemaFile)) {
      pairs.set(`${schemaFile}\0${dataFile}`, { dataFile, schemaFile });
    }
  }

  for (const schemaFile of schemaFiles) {
    const schemaDirectory = path.dirname(schemaFile);
    const schemaRoot = path.basename(schemaFile, ".schema.json");
    const projectRoot =
      path.basename(schemaDirectory) === "schemas" ?
        path.dirname(schemaDirectory)
      : schemaDirectory;

    for (const extension of [".yml", ".yaml", ".json"]) {
      const dataFile = path.join(projectRoot, `${schemaRoot}${extension}`);
      if (fs.existsSync(dataFile)) {
        pairs.set(`${schemaFile}\0${dataFile}`, { dataFile, schemaFile });
      }
    }
  }

  return [...pairs.values()].sort((a, b) =>
    `${a.schemaFile}\0${a.dataFile}`.localeCompare(
      `${b.schemaFile}\0${b.dataFile}`,
    ),
  );
}

/**
 * Counts schema-backed data files that point to external schemas.
 *
 * External schemas are rejected rather than fetched or skipped during
 * validation so CI remains deterministic and offline-capable.
 *
 * @param {string} root - Repository root.
 *
 * @returns {number} External schema reference count.
 */
function externalSchemaReferenceCount(root) {
  return findSchemaReferences(root).filter(({ schemaReference }) =>
    /^https?:\/\//u.test(schemaReference),
  ).length;
}

/**
 * Validates repository schemas and schema-backed data files.
 *
 * @param {string} root - Repository root.
 *
 * @returns {{
 *   failures: ValidationFailure[];
 *   schemaCount: number;
 *   dataCount: number;
 *   externalSchemaCount: number;
 * }}
 *   Validation result.
 */
export function validateSchemas(root = process.cwd()) {
  const schemaFiles = findSchemaFiles(root).map((file) => path.resolve(file));
  const schemaFileSet = new Set(schemaFiles);
  const validationPairs = findValidationPairs(root, schemaFileSet);
  const externalSchemaCount = externalSchemaReferenceCount(root);
  const failures = [];
  for (const { dataFile, schemaReference } of findSchemaReferences(root)) {
    const resolved = resolveSchemaReference(dataFile, schemaReference);
    if (/^https?:\/\//u.test(resolved) || !schemaFileSet.has(resolved)) {
      failures.push({
        file: path.relative(root, dataFile),
        message: `schema must be local and present in schemas: ${schemaReference}`,
      });
    }
  }
  const schemaRecords = [];
  const compiledSchemas = new Map();

  for (const schemaFile of schemaFiles) {
    try {
      const schema = readDataFile(schemaFile);
      schemaRecords.push({
        file: schemaFile,
        schema,
        ajv: createAjv(schemaUri(schema)),
      });
    } catch (error) {
      failures.push({
        file: path.relative(root, schemaFile),
        message: `schema could not be parsed: ${error.message}`,
      });
    }
  }

  for (const record of schemaRecords) {
    try {
      record.ajv.addSchema(record.schema, schemaKey(record.file));
    } catch (error) {
      failures.push({
        file: path.relative(root, record.file),
        message: `schema is invalid: ${error.message}`,
      });
    }
  }

  for (const record of schemaRecords) {
    try {
      const validate = record.ajv.getSchema(schemaKey(record.file));
      if (!validate) {
        throw new Error("schema was not compiled");
      }

      compiledSchemas.set(record.file, validate);
    } catch (error) {
      failures.push({
        file: path.relative(root, record.file),
        message: `schema is invalid: ${error.message}`,
      });
    }
  }

  for (const { dataFile, schemaFile } of validationPairs) {
    const validate = compiledSchemas.get(schemaFile);
    if (!validate) {
      continue;
    }

    try {
      const data = readDataFile(dataFile);
      if (!validate(data)) {
        failures.push({
          file: path.relative(root, dataFile),
          message: `does not match ${path.relative(root, schemaFile)}: ${formatAjvErrors(validate.errors)}`,
        });
      }
    } catch (error) {
      failures.push({
        file: path.relative(root, dataFile),
        message: `could not be parsed: ${error.message}`,
      });
    }
  }

  return {
    failures,
    schemaCount: schemaFiles.length,
    dataCount: validationPairs.length,
    externalSchemaCount,
  };
}
