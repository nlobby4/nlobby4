#!/usr/bin/env node

/**
 * Perform ANSI- and Unicode-aware terminal text operations.
 *
 * Usage: node scripts/node/bin/terminal-text.js strip-ansi node
 * scripts/node/bin/terminal-text.js to-ascii node
 * scripts/node/bin/terminal-text.js visible-width [TEXT...] node
 * scripts/node/bin/terminal-text.js format-lines WIDTH [--pad]
 *
 * @file Terminal text command-line utility.
 *
 * @author sphoon
 */

import fs from "node:fs";

import anyAscii from "any-ascii";

import {
  processInputLines,
  stripTerminalAnsi,
  terminalWidth,
  wrapTerminalLine,
  writeStreamLine,
} from "../lib/terminal-lines.js";

const supportedFormatOptions = new Set(["--pad"]);

function exitWithUsage() {
  console.error(
    "Usage: terminal-text.js <strip-ansi|to-ascii|visible-width|format-lines> [arguments]",
  );
  process.exit(64);
}

function stripAnsiCommand(args, { ascii = false } = {}) {
  if (args.length !== 0) {
    exitWithUsage();
  }

  const text = stripTerminalAnsi(fs.readFileSync(0, "utf8"));
  process.stdout.write(ascii ? anyAscii(text) : text);
}

function visibleWidthCommand(args) {
  if (args.some((value) => /[\r\n]/u.test(value))) {
    console.error("visible-width input must be a single line");
    process.exit(64);
  }

  for (const value of args) {
    console.log(terminalWidth(value));
  }
}

async function formatLinesCommand(args) {
  const [widthArgument, ...options] = args;
  const width = Number(widthArgument);

  if (
    !Number.isSafeInteger(width)
    || width < 1
    || options.some((option) => !supportedFormatOptions.has(option))
    || new Set(options).size !== options.length
  ) {
    exitWithUsage();
  }

  const pad = options.includes("--pad");

  await processInputLines(process.stdin, async (line) => {
    for (const wrappedLine of wrapTerminalLine(line, width)) {
      // Preserve an indivisible wide grapheme even in a one-column viewport.
      // Such a line may overflow; never corrupt its text or request negative padding.
      const padding =
        pad ? " ".repeat(Math.max(0, width - terminalWidth(wrappedLine))) : "";
      await writeStreamLine(process.stdout, `${wrappedLine}${padding}`);
    }
  });
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "format-lines":
    await formatLinesCommand(args);
    break;
  case "strip-ansi":
    stripAnsiCommand(args);
    break;
  case "to-ascii":
    stripAnsiCommand(args, { ascii: true });
    break;
  case "visible-width":
    visibleWidthCommand(args);
    break;
  default:
    exitWithUsage();
}
