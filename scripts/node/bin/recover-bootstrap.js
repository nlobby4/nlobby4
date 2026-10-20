#!/usr/bin/env node
/** Recover a journaled mise bootstrap update without installed npm dependencies. */
import { recoverBootstrapUpdate } from "../lib/bootstrap-transaction.js";

try {
  if (process.argv.length !== 2)
    throw new Error("Usage: node scripts/node/bin/recover-bootstrap.js");
  const result = recoverBootstrapUpdate();
  if (result !== "none") console.log(`Recovered bootstrap update (${result})`);
} catch (error) {
  console.error(`Bootstrap recovery failed: ${error.message}`);
  process.exitCode = 1;
}
