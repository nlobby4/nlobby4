/**
 * Shared utilities for measuring, wrapping, and streaming terminal text.
 *
 * @file Terminal-line utilities.
 *
 * @author sphoon
 */

import { once } from "node:events";

import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
import wrapAnsi from "wrap-ansi";

const statusLinePattern = new RegExp(
  String.raw`^([^:]+)(:(?:\u001B\[[0-?]*[ -/]*[@-~])*\s)(.+)$`,
  "u",
);

/** Remove a carriage return belonging to a CRLF line ending. */
function normalizeLineEnding(value) {
  return value.endsWith("\r") ? value.slice(0, -1) : value;
}

/** Remove ANSI escape sequences from a string. */
export function stripTerminalAnsi(value) {
  return stripAnsi(value);
}

/** Measure display text with each tab represented by two spaces. */
export function terminalWidth(value) {
  return stringWidth(stripTerminalAnsi(value).replaceAll("\t", "  "));
}

/** Wrap one terminal line, expanding tabs independently of terminal tab stops. */
export function wrapTerminalLine(value, width) {
  const line = value.replaceAll("\t", "  ");
  const maximumPrefixWidth = Math.min(32, Math.floor(width / 2));
  const wrap = (value, targetWidth) =>
    wrapAnsi(value, targetWidth, {
      hard: true,
      trim: true,
      wordWrap: true,
    }).split("\n");

  const wrapWithIndent = (prefix, value) => {
    const prefixWidth = terminalWidth(prefix);
    const valueWidth = width - prefixWidth;
    if (valueWidth < 16 || prefixWidth > maximumPrefixWidth) {
      return wrap(`${prefix}${value}`, width);
    }

    const hangingIndent = " ".repeat(prefixWidth);

    return wrap(value, valueWidth).map((wrappedLine, index) =>
      index === 0 ?
        `${prefix}${wrappedLine}`
      : `${hangingIndent}${wrappedLine}`,
    );
  };

  if (terminalWidth(line) <= width) {
    return [line];
  }

  const statusMatch = statusLinePattern.exec(line);
  if (statusMatch) {
    const [, label, separator, value] = statusMatch;
    const prefix = `${label}${separator}`;
    const prefixWidth = terminalWidth(prefix);
    // Retain alignment unless its padding leaves too little space for the value.
    const wrappedPrefix =
      prefixWidth > maximumPrefixWidth || width - prefixWidth < 16 ?
        `${label.replace(/ +$/u, "")}${separator}`
      : prefix;
    return wrapWithIndent(wrappedPrefix, value);
  }

  const indentationMatch = /^(\s+)(\S.*)$/u.exec(line);
  if (indentationMatch) {
    return wrapWithIndent(indentationMatch[1], indentationMatch[2]);
  }

  return wrap(line, width);
}

/** Process an input stream one logical line at a time. */
export async function processInputLines(
  input,
  processLine,
  { emitEmptyInput = false } = {},
) {
  const state = {
    receivedInput: false,
    remainder: "",
  };

  input.setEncoding("utf8");

  for await (const chunk of input) {
    state.receivedInput = true;
    const segments = `${state.remainder}${chunk}`.split("\n");
    state.remainder = segments.pop() ?? "";

    for (const line of segments) {
      await processLine(normalizeLineEnding(line));
    }
  }

  if (state.remainder !== "" || (!state.receivedInput && emitEmptyInput)) {
    await processLine(state.remainder);
  }
}

/** Write one newline-terminated line while respecting stream backpressure. */
export async function writeStreamLine(stream, line) {
  if (!stream.write(`${line}\n`)) {
    await once(stream, "drain");
  }
}
