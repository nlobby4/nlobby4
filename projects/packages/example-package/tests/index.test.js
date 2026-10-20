import assert from "node:assert/strict";
import test from "node:test";

import { greet } from "@nlobby4/example-package";

test("the public package export provides a default greeting", () => {
  assert.equal(greet(), "Hello, world!");
});

test("the public package export accepts a name", () => {
  assert.equal(greet("nlobby4"), "Hello, nlobby4!");
});

test("the greeting preserves Unicode", () => {
  assert.equal(greet("世界"), "Hello, 世界!");
});
