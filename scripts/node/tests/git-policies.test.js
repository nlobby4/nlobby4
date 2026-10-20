/**
 * Verify nested ignore policies, checkout bytes and project asset ownership in
 * disposable Git repositories without changing the workspace index.
 *
 * @file Git ignore and attribute regression tests.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "git-policies-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const env = {
    ...process.env,
    HOME: directory,
    XDG_CONFIG_HOME: directory,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_COUNT: "0",
    GIT_ATTR_NOSYSTEM: "1",
  };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_COMMON_DIR",
    "GIT_INDEX_FILE",
    "GIT_CONFIG",
  ])
    delete env[key];
  const run = (...args) =>
    spawnSync(
      "git",
      [
        "-c",
        "core.attributesFile=/dev/null",
        "-c",
        "core.excludesFile=/dev/null",
        ...args,
      ],
      { cwd: directory, env, encoding: "utf8", timeout: 10000 },
    );
  const git = (...args) => {
    const result = run(...args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const write = (file, contents) => {
    const target = path.join(directory, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, contents);
  };
  git("init", "--quiet");
  git("config", "core.hooksPath", "/dev/null");
  git("config", "user.name", "Policy fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "core.autocrlf", "false");
  for (const file of [
    ".gitignore",
    ".gitattributes",
    "scripts/node/.gitignore",
    "scripts/python/.gitignore",
  ]) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(directory, file));
  }
  return { directory, run, git, write };
}

test("rerere reuses a resolution without staging it", (t) => {
  const f = fixture(t);
  f.git("config", "--local", "rerere.enabled", "true");
  f.git("config", "--local", "rerere.autoupdate", "false");
  f.write("conflict.md", "original\n");
  f.git("add", "conflict.md");
  f.git("commit", "--quiet", "-m", "base");
  const base = f.git("rev-parse", "HEAD").trim();
  f.git("checkout", "--quiet", "-b", "left");
  f.write("conflict.md", "left\n");
  f.git("commit", "--quiet", "-am", "left");
  f.git("checkout", "--quiet", "-b", "right", base);
  f.write("conflict.md", "right\n");
  f.git("commit", "--quiet", "-am", "right");
  const right = f.git("rev-parse", "HEAD").trim();
  assert.equal(f.run("merge", "--no-edit", "left").status, 1);
  f.write("conflict.md", "reviewed resolution\n");
  f.git("add", "conflict.md");
  f.git("commit", "--quiet", "-m", "resolved");
  f.git("checkout", "--quiet", "-b", "replay", right);
  assert.equal(f.run("merge", "--no-edit", "left").status, 1);
  assert.equal(
    readFileSync(path.join(f.directory, "conflict.md"), "utf8"),
    "reviewed resolution\n",
  );
  assert.notEqual(f.git("ls-files", "--unmerged", "--", "conflict.md"), "");
  f.git("add", "conflict.md");
  f.git("commit", "--quiet", "-m", "reviewed reuse");
  assert.equal(f.git("ls-files", "--unmerged"), "");
});

test("root allowlist and nested language denylists compose correctly", (t) => {
  const f = fixture(t);
  const allowed = [
    "settings.json",
    "settings.jsonc",
    "settings.toml",
    "settings.yaml",
    "settings.yml",
    "mise.lock",
    "pnpm-lock.yaml",
    "README.md",
    ".env.template",
    ".mise/aqua.yaml",
    ".mise/locks/example/package.json",
    ".devcontainer/devcontainer.json",
    "scripts/node/.gitignore",
    "scripts/python/.gitignore",
    "scripts/node/package.json",
    "scripts/node/bin/helper.js",
    "scripts/node/tests/helper.test.js",
    "scripts/node/tests/fixtures/build/input.js",
    "scripts/node/tests/fixtures/dist/input.js",
    "scripts/node/.env.example",
    "scripts/node/nested/.env.template",
    "scripts/python/.env.sample",
    "scripts/python/devcontainer-state.py",
    "scripts/python/tests/fixtures/build/input.py",
    "scripts/python/pyproject.toml",
    "scripts/python/uv.lock",
  ];
  const ignored = [
    "unlisted.py",
    "unlisted.txt",
    ".env",
    ".env.local",
    ".local-work/note.md",
    "node_modules/package/index.js",
    ".devcontainer/.mise-bootstrap-update/state.json",
    ".devcontainer/.mise-bootstrap-update.lock",
    ".devcontainer/.mise-bootstrap-update.preparing-fixture/state.json",
    "scripts/node/node_modules/package/index.js",
    "scripts/node/nested/node_modules/package/index.js",
    "scripts/node/.pnpm-store/item",
    "scripts/node/.npm/item",
    "scripts/node/.cache/item",
    "scripts/node/build/output.js",
    "scripts/node/dist/output.js",
    "scripts/node/coverage/index.html",
    "scripts/node/nested/.nyc_output/data.json",
    "scripts/node/run.log",
    "scripts/node/report.123.json",
    "scripts/node/cache.tsbuildinfo",
    "scripts/node/package.tgz",
    "scripts/node/.env",
    "scripts/node/nested/.env.local",
    "scripts/python/__pycache__/helper.pyc",
    "scripts/python/cache.pyc",
    "scripts/python/cache.pyo",
    "scripts/python/cache.pyd",
    "scripts/python/module.so",
    "scripts/python/.venv/bin/python",
    "scripts/python/nested/venv/bin/python",
    "scripts/python/.pytest_cache/item",
    "scripts/python/.mypy_cache/item",
    "scripts/python/.ruff_cache/item",
    "scripts/python/.tox/item",
    "scripts/python/.nox/item",
    "scripts/python/.cache/item",
    "scripts/python/build/output.py",
    "scripts/python/dist/output.whl",
    "scripts/python/example.egg-info/metadata",
    "scripts/python/example.egg",
    "scripts/python/.coverage",
    "scripts/python/.coverage.worker",
    "scripts/python/htmlcov/index.html",
    "scripts/python/coverage.xml",
    "scripts/python/run.log",
    "scripts/python/.env",
    "scripts/python/nested/.env.local",
    "scripts/linux/node_modules/package/index.js",
    "scripts/linux/__pycache__/helper.pyc",
  ];
  for (const [files, expected] of [
    [allowed, 1],
    [ignored, 0],
  ]) {
    for (const file of files) {
      if (!file.endsWith("/.gitignore")) f.write(file, "fixture\n");
      const result = f.run("check-ignore", "--quiet", "--no-index", "--", file);
      assert.equal(result.status, expected, `${file}: ${result.stderr}`);
    }
  }
});

test("attributes preserve language and export policy without imposing media LFS", (t) => {
  const f = fixture(t);
  for (const [file, attribute, value] of [
    ["scripts/python/helper.py", "diff", "python"],
    ["example.Dockerfile", "eol", "lf"],
    ["filter.awk", "eol", "lf"],
    ["filter.jq", "eol", "lf"],
    ["image.svg", "text", "set"],
    ["image.svg", "diff", "unspecified"],
    ["document.pdf", "binary", "set"],
    ["document.docx", "binary", "set"],
    ["document.rtf", "text", "set"],
    ["image.png", "text", "unset"],
    ["media/image.svg", "filter", "unspecified"],
    ["media/nested/image.png", "filter", "unspecified"],
    ["media/README.md", "filter", "unspecified"],
    ["media/nested/README.md", "merge", "unspecified"],
    ["media/nested/guide.mdx", "filter", "unspecified"],
    ["media/nested/guide.mdx", "diff", "markdown"],
    [".gitignore", "export-ignore", "unspecified"],
    [".gitattributes", "export-ignore", "unspecified"],
  ]) {
    const actual = f
      .git("check-attr", attribute, "--", file)
      .trim()
      .split(": ")
      .at(-1);
    assert.equal(actual, value, `${file}: ${attribute}`);
  }
});

test("ordinary projects own optional LFS rules and root media is not enrolled", (t) => {
  const f = fixture(t);
  f.write("media/image.png", "placeholder\n");
  assert.equal(f.run("check-ignore", "media/image.png").status, 0);
  f.write(
    "projects/example/.gitattributes",
    "assets/*.png filter=lfs diff=lfs merge=lfs -text\n",
  );
  for (const [file, value] of [
    ["projects/example/assets/image.png", "lfs"],
    ["projects/example/assets/README.md", "unspecified"],
    ["projects/another/assets/image.png", "unspecified"],
  ]) {
    assert.equal(
      f.git("check-attr", "filter", "--", file).trim().split(": ").at(-1),
      value,
      file,
    );
  }
});

test("generated outputs are opt-in while caches stay ignored", (t) => {
  const f = fixture(t);
  const paths = [
    ".generated/schemas/example.json",
    ".generated/policy/devcontainer.json",
    ".generated/devcontainer.spdx.json",
    ".cache/prettier/.prettiercache",
    "scripts/node/.cache/knip/data.json",
  ];
  for (const file of paths) {
    f.write(file, "{}\n");
    assert.equal(
      f.run("check-ignore", "--quiet", "--no-index", "--", file).status,
      0,
      file,
    );
  }
  const config = readFileSync(path.join(f.directory, ".gitignore"), "utf8");
  f.write(
    ".gitignore",
    config.replace(
      "# !/.generated/schemas/*.json",
      "!/.generated/schemas/*.json",
    ),
  );
  assert.equal(
    f.run("check-ignore", "--quiet", "--no-index", "--", paths[0]).status,
    1,
  );
  for (const file of paths.slice(1))
    assert.equal(
      f.run("check-ignore", "--quiet", "--no-index", "--", file).status,
      0,
      file,
    );
});

test("real checkouts preserve sidecars, LF sources, CRLF exceptions and binary bytes", (t) => {
  const f = fixture(t);
  const originals = new Map([
    ["scripts/python/helper.py", Buffer.from("def example():\n    return 1\n")],
    ["scripts/node/helper.js", Buffer.from("export const value = 1;\n")],
    ["scripts/linux/helper.sh", Buffer.from("#!/bin/sh\nexit 0\n")],
    ["scripts/linux/helper.awk", Buffer.from("{ print $0 }\n")],
    ["scripts/linux/helper.jq", Buffer.from(".value\n")],
    ["example.Dockerfile", Buffer.from("FROM scratch\n")],
    ["settings.json", Buffer.from('{"value":1}\n')],
    ["settings.yaml", Buffer.from("value: 1\n")],
    ["image.svg", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>\n')],
    ["windows.cmd", Buffer.from("@echo hello\r\n")],
    ["table.csv", Buffer.from("a,b\r\n1,2\r\n")],
    ["example.patch", Buffer.from("--- old\r\n+++ new\r\n")],
    ["asset.png", Buffer.from([0, 13, 10, 255, 10])],
  ]);
  const sidecars = readdirSync(path.join(root, ".mise/locks"), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(root, path.join(entry.parentPath, entry.name)),
    );
  assert.ok(sidecars.length > 0, "native lock sidecars must be present");
  for (const file of sidecars)
    originals.set(file, readFileSync(path.join(root, file)));
  for (const [file, bytes] of originals) f.write(file, bytes);
  f.git("add", "--force", "--", ".gitattributes", ...originals.keys());
  for (const [autocrlf, eol] of [
    ["false", "lf"],
    ["false", "crlf"],
    ["input", "lf"],
    ["true", "lf"],
  ]) {
    f.git("config", "core.autocrlf", autocrlf);
    f.git("config", "core.eol", eol);
    for (const file of originals.keys()) rmSync(path.join(f.directory, file));
    f.git("checkout-index", "--force", "--", ...originals.keys());
    for (const [file, bytes] of originals)
      assert.deepEqual(
        readFileSync(path.join(f.directory, file)),
        bytes,
        `${autocrlf}/${eol}: ${file}`,
      );
  }
});

test("non-overlapping project Markdown changes merge normally", (t) => {
  const f = fixture(t);
  const rows = Array.from({ length: 40 }, (_, index) => `line ${index}`);
  f.write("projects/example/README.md", `${rows.join("\n")}\n`);
  f.git("add", "--force", "--", ".gitattributes", "projects/example/README.md");
  f.git("commit", "--quiet", "-m", "base");
  const base = f.git("rev-parse", "HEAD").trim();
  f.git("checkout", "--quiet", "-b", "left");
  f.write(
    "projects/example/README.md",
    `${rows.map((line, index) => (index === 0 ? "left change" : line)).join("\n")}\n`,
  );
  f.git("commit", "--quiet", "-am", "left");
  f.git("checkout", "--quiet", "-b", "right", base);
  f.write(
    "projects/example/README.md",
    `${rows.map((line, index) => (index === 39 ? "right change" : line)).join("\n")}\n`,
  );
  f.git("commit", "--quiet", "-am", "right");
  f.git("merge", "--no-edit", "left");
  const merged = readFileSync(
    path.join(f.directory, "projects/example/README.md"),
    "utf8",
  );
  assert.match(merged, /^left change\n/);
  assert.match(merged, /\nright change\n$/);
});
