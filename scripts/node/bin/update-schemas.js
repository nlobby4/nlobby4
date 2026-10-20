#!/usr/bin/env node

/**
 * Refresh local schema bundles for the declared tool versions and source pins.
 * Completes all downloads before writing any files; never runs during
 * readiness.
 *
 * Usage: node scripts/node/bin/update-schemas.js [--check].
 *
 * @file Schema update and offline drift-check command.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundleSchemas, verifySchemaVendor } from "../lib/schema-vendor.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
try {
  if (process.argv.length === 3 && process.argv[2] === "--check") {
    verifySchemaVendor(root);
    console.log("Local schema sources and checksums verified");
  } else if (process.argv.length === 2) {
    const outputs = await bundleSchemas(root);
    for (const [file, bytes] of outputs) {
      const target = path.join(root, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    }
    console.log(
      `Updated ${[...outputs.keys()].filter((file) => file.endsWith(".schema.json")).length} local schema bundles`,
    );
  } else {
    throw new Error("Usage: update-schemas.js [--check]");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
