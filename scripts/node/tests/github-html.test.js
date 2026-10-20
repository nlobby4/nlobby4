import assert from "node:assert/strict";
import { test } from "node:test";

import markdownIt from "markdown-it";

import githubHtml from "../lib/markdownlint/github-html.js";

async function lintHtml(markdown) {
  const tokens = markdownIt({ html: true }).parse(markdown, {});
  const addLineNumbers = (items, inheritedLineNumber = 1) => {
    for (const token of items) {
      token.lineNumber = token.map?.[0] + 1 || inheritedLineNumber;
      addLineNumbers(token.children ?? [], token.lineNumber);
    }
  };
  addLineNumbers(tokens);

  const issues = [];
  githubHtml.function(
    { parsers: { markdownit: { tokens } } },
    ({ lineNumber, range, detail }) => {
      issues.push({ lineNumber, errorRange: range, errorDetail: detail });
    },
  );

  return issues.sort((left, right) => {
    return left.lineNumber - right.lineNumber;
  });
}

test("accepts supported GFM and raw HTML", async () => {
  const issues = await lintHtml(`# Supported

- [x] Task lists

~~Strikethrough~~ and https://example.com are supported.

<details open><summary>Details</summary>Content</details>
`);

  assert.deepEqual(issues, []);
});

test("reports unsupported GitHub HTML with source locations", async () => {
  const issues = await lintHtml(`# Unsupported

<iframe src="https://example.com"></iframe>

<span class="notice" style="color: red">Styled text</span>

<a href="javascript:alert(1)" onclick="alert(1)">Unsafe link</a>
`);

  assert.equal(issues.length, 5);
  const details = issues.map(({ errorDetail }) => errorDetail).join("\n");
  assert.match(details, /Element <iframe> is not supported/);
  assert.match(details, /Attribute "class" is not supported/);
  assert.match(details, /Attribute "style" is not supported/);
  assert.match(details, /Protocol in a\[href\] is not supported/);
  assert.match(details, /Attribute "onclick" is not supported/);
  assert.ok(
    issues.every(({ lineNumber, errorRange }) => lineNumber && errorRange),
  );
});
