/** Verify generic JSON selection and typed-table contracts independently. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const directory = fileURLToPath(
  new URL("../../linux/utils/filters/jq/", import.meta.url),
);

function run(filter, input, parameters, options = []) {
  const args = Object.entries(parameters).flatMap(([name, value]) => [
    "--argjson",
    name,
    JSON.stringify(value),
  ]);
  const result = spawnSync(
    "jq",
    [...options, ...args, "--from-file", `${directory}${filter}.jq`],
    { input: JSON.stringify(input), encoding: "utf8", timeout: 5000 },
  );
  assert.ifError(result.error);
  return result;
}

test("array selection supports unrelated fields and nested array paths", () => {
  const record = { metadata: [{ enabled: true }], payload: "ready" };
  const result = run(
    "json-array-match",
    [{ metadata: [{ enabled: false }] }, record],
    { match_path: ["metadata", 0, "enabled"], match_value: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), record);
});

test("array selection distinguishes an explicit null from a missing field", () => {
  const result = run("json-array-match", [{}, { value: null }], {
    match_path: ["value"],
    match_value: null,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { value: null });
});

for (const [input, match_path, match_value] of [
  [[], ["selected"], true],
  [[{ selected: true }, { selected: true }], ["selected"], true],
  [[{ selected: false }], ["selected"], true],
  [null, ["selected"], true],
  [[true], ["selected"], true],
  [[{ selected: true }], "selected", true],
  [[{ selected: true }], [-1], true],
]) {
  test(`array selection rejects ${JSON.stringify([input, match_path])}`, () => {
    const result = run("json-array-match", input, { match_path, match_value });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  });
}

const columns = [
  { field: "description", type: "string", nonempty: true },
  { field: "count", type: "number" },
  { field: "enabled", type: "boolean" },
];
test("table projects arbitrary fields in requested order and escapes text", () => {
  const result = run(
    "json-table",
    [{ enabled: false, count: 0, description: "tab\tand\\slash" }],
    { columns },
    ["--raw-output"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "tab\\tand\\\\slash\t0\tfalse\n");
});

test("table accepts empty strings when nonempty is not requested", () => {
  const result = run(
    "json-table",
    [{ value: "" }],
    { columns: [{ field: "value", type: "string" }] },
    ["--raw-output"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "\n");
});

for (const input of [
  null,
  [],
  [null],
  [{ description: "", count: 0, enabled: false }],
  [{ description: "ready", count: "0", enabled: false }],
  [{ description: "ready", count: 0 }],
  ...["\u0000", "\r", "\n"].map((c) => [
    { description: `bad${c}text`, count: 0, enabled: false },
  ]),
]) {
  test(`table rejects invalid rows ${JSON.stringify(input)} without partial output`, () => {
    const result = run("json-table", input, { columns });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  });
}

for (const invalid of [
  null,
  [],
  [{}],
  [{ field: "", type: "string" }],
  [{ field: "x", type: "object" }],
  [{ field: "x", type: "string", nonempty: "true" }],
]) {
  test(`table rejects invalid columns ${JSON.stringify(invalid)}`, () => {
    const result = run("json-table", [{ x: "value" }], { columns: invalid });
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  });
}

test("prefix matching supports arbitrary objects and literal punctuation", () => {
  const result = run(
    "json-prefix-match",
    { catalog: { "tool.[1]:stable": { release: "1=2", active: false } } },
    {
      object_path: ["catalog"],
      key_prefix: "tool.[1]:",
      fields: ["release", "active"],
    },
    ["--raw-output"],
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "1=2\nfalse\n");
});
