#!/usr/bin/env node

/**
 * Validates repository JSON Schemas and schema-backed config files.
 *
 * Usage: node scripts/node/bin/validate-schemas.js.
 *
 * @file Schema validation command.
 *
 * @author sphoon
 */

import process from "node:process";

import { validateSchemas } from "../lib/schema-validator.js";

const { failures, schemaCount, dataCount } = validateSchemas();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`${failure.file}: ${failure.message}`);
  }

  process.exit(1);
}

console.log(
  `Validated ${schemaCount} schema file${schemaCount === 1 ? "" : "s"} and ${dataCount} local schema-backed config file${dataCount === 1 ? "" : "s"}.`,
);
