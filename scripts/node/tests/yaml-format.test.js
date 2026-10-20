/**
 * Verify selective YAML quoting preserves values and formatting stability.
 *
 * @file YAML formatter compatibility regression tests.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const rootRequire = createRequire(path.join(root, "package.json"));
const prettier = rootRequire("prettier");

for (const extension of ["yaml", "yml"]) {
  const options = {
    ...(await prettier.resolveConfig(path.join(root, `fixture.${extension}`))),
    filepath: path.join(root, `fixture.${extension}`),
  };
  for (const value of [
    "yes",
    "Yes",
    "YES",
    "no",
    "No",
    "NO",
    "on",
    "On",
    "ON",
    "off",
    "Off",
    "OFF",
  ]) {
    test(`${extension}: preserve quotes on ${value}`, async () => {
      const input = `value: "${value}"\n`;
      const output = await prettier.format(input, options);
      assert.match(output, /^value: ["']/);
      assert.deepEqual(parse(output), parse(input));
      assert.equal(await prettier.format(output, options), output);
    });
  }
  test(`${extension}: preserve real booleans, scalar types and workflow keys`, async () => {
    const input =
      'on:\n  pull_request:\n    branches: [main]\nenabled: true\ndisabled: false\nnumber: 42\nempty: null\ntext: "true"\nword: yesterday\n';
    const output = await prettier.format(input, options);
    assert.deepEqual(parse(output), parse(input));
    assert.match(output, /enabled: true\n/);
    assert.match(output, /disabled: false\n/);
    assert.match(output, /^on:/);
    assert.equal(await prettier.format(output, options), output);
  });
}
