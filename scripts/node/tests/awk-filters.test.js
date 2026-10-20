/** Exercise literal assignment extraction without shell evaluation. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = fileURLToPath(
  new URL("../../linux/utils/filters/awk/", import.meta.url),
);

function run(filter, input, args = []) {
  const engine = process.env.AWK_TEST_ENGINE ?? "awk";
  const prefix = engine === "busybox" ? ["awk"] : [];
  const result = spawnSync(
    engine,
    [...prefix, ...args, "-f", `${directory}${filter}.awk`],
    { input, encoding: "utf8", timeout: 5000 },
  );
  assert.ifError(result.error);
  return result;
}

for (const [input, expected] of [
  ["VALUE=a=b=c\n", "a=b=c\n"],
  ["VALUE=\n", "\n"],
  ["VALUE=0\n", "0\n"],
  ["VALUE=one\r\n", "one\n"],
  ["VALUE=no final newline", "no final newline\n"],
  [
    "#VALUE=comment\nOTHER=ignored\nVALUE='literal quotes'\n",
    "'literal quotes'\n",
  ],
  [
    "VALUE=  literal \\path $HOME $(false)  \n",
    "  literal \\path $HOME $(false)  \n",
  ],
]) {
  test(`env-value preserves ${JSON.stringify(input)}`, () => {
    const result = run("env-value", input, ["-v", "variable_name=VALUE"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  });
}

for (const [input, name, status] of [
  ["OTHER=value\n", "VALUE", 1],
  ["VALUE=first\nVALUE=second\n", "VALUE", 2],
  ["VALUE=same\nVALUE=same\n", "VALUE", 2],
  ["VALUE=first\n", "", 2],
  ["VALUE=first\n", "invalid-name", 2],
]) {
  test(`env-value rejects missing or ambiguous selection ${JSON.stringify([input, name])}`, () => {
    const result = run("env-value", input, ["-v", `variable_name=${name}`]);
    assert.equal(result.status, status);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /env-value:/u);
  });
}
