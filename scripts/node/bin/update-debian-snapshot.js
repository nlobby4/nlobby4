#!/usr/bin/env node
/**
 * Resolve a dated Debian snapshot and its coupled package pins without
 * installing them.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const packages = Object.freeze({
  CMARK_GFM_VERSION: "cmark-gfm",
  CURL_VERSION: "curl",
  GAWK_VERSION: "gawk",
  GIT_LFS_VERSION: "git-lfs",
  PYTHON_VENV_VERSION: "python3-venv",
  JQ_VERSION: "jq",
  YQ_VERSION: "yq",
});

export function recentSnapshot(now = new Date()) {
  // A seven-day delay gives the archive time to settle, without tracking today.
  const date = new Date(now.getTime() - 7 * 86400000);
  return date.toISOString().slice(0, 10).replaceAll("-", "") + "T000000Z";
}

export function resolvePackages({ image, snapshot, architecture }) {
  const program = `set -euo pipefail
printf '%s\\n' "deb [check-valid-until=no signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://snapshot.debian.org/archive/debian/$1 bookworm main" \
  "deb [check-valid-until=no signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://snapshot.debian.org/archive/debian/$1 bookworm-updates main" \
  "deb [check-valid-until=no signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://snapshot.debian.org/archive/debian-security/$1 bookworm-security main" > /etc/apt/sources.list
apt-get -o APT::Sandbox::User=root -o APT::Architecture="$2" -o APT::Update::Error-Mode=any update >&2
architecture="$2"
shift 2
for package in "$@"; do
  selected=""
  while IFS='|' read -r ignored version origin; do
    version="$(printf '%s' "$version" | tr -d ' ')"
    [[ -n "$version" ]] || continue
    if [[ -z "$selected" ]] || dpkg --compare-versions "$version" gt "$selected"; then selected="$version"; fi
  done < <(apt-cache -o APT::Architecture="$architecture" madison "$package")
  [[ -n "$selected" ]] || { printf 'No snapshot version for %s\\n' "$package" >&2; exit 1; }
  printf '%s=%s\\n' "$package" "$selected"
done
`;
  const result = spawnSync(
    "docker",
    [
      "run",
      "--interactive",
      "--rm",
      "--read-only",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--user=0",
      "--entrypoint=bash",
      "--tmpfs=/etc/apt",
      "--tmpfs=/var/lib/apt/lists",
      "--tmpfs=/var/cache/apt",
      "--tmpfs=/tmp",
      image,
      "-s",
      "--",
      snapshot,
      architecture,
      ...Object.values(packages),
    ],
    {
      input: program,
      encoding: "utf8",
      timeout: 300000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      `Debian ${architecture} resolution failed: ${result.error?.message ?? result.stderr.trim()}`,
    );
  const values = new Map(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => line.split("=")),
  );
  if (
    values.size !== Object.keys(packages).length
    || [...values].some(
      ([name, value]) =>
        !Object.values(packages).includes(name)
        || !/^[0-9][0-9A-Za-z.+:~_-]*$/u.test(value ?? ""),
    )
  )
    throw new Error("invalid Debian package resolution");
  return values;
}

export function updateDebianSnapshot({
  root = process.cwd(),
  snapshot,
  resolve = resolvePackages,
}) {
  if (!/^\d{8}T000000Z$/u.test(snapshot ?? ""))
    throw new Error("snapshot must use YYYYMMDDT000000Z");
  const iso = `${snapshot.slice(0, 4)}-${snapshot.slice(4, 6)}-${snapshot.slice(6, 8)}`;
  if (
    !Number.isFinite(Date.parse(iso))
    || new Date(iso).toISOString().slice(0, 10) !== iso
  )
    throw new Error("snapshot must be a valid UTC date");
  const filename = path.join(root, ".devcontainer/versions.env");
  const stat = fs.lstatSync(filename);
  if (!stat.isFile())
    throw new Error("version manifest must be a regular file");
  const before = fs.readFileSync(filename, "utf8");
  const previous = before.match(/^DEBIAN_SNAPSHOT=(.+)$/mu)?.[1];
  if (!previous || snapshot < previous)
    throw new Error("snapshot must not move backwards");
  const image = fs
    .readFileSync(path.join(root, ".devcontainer/Dockerfile"), "utf8")
    .match(
      /^FROM (mcr\.microsoft\.com\/devcontainers\/base:bookworm@sha256:[a-f0-9]{64})$/mu,
    )?.[1];
  if (!image)
    throw new Error(
      "snapshot resolver requires the pinned Debian Bookworm base image",
    );
  const amd64 = resolve({ image, snapshot, architecture: "amd64" });
  const arm64 = resolve({ image, snapshot, architecture: "arm64" });
  const replacements = { DEBIAN_SNAPSHOT: snapshot };
  for (const [key, name] of Object.entries(packages)) {
    const version = amd64.get(name);
    if (!version || version !== arm64.get(name))
      throw new Error(`architecture package-version mismatch: ${name}`);
    replacements[key] = version;
  }
  const candidate = Object.entries(replacements).reduce(
    (text, [name, value]) => {
      const pattern = new RegExp(`^${name}=.+$`, "gmu");
      if ([...text.matchAll(pattern)].length !== 1)
        throw new Error(`expected one ${name} assignment`);
      return text.replace(pattern, `${name}=${value}`);
    },
    before,
  );
  if (candidate === before) return false;
  const temporary = `${filename}.update-${randomUUID()}`;
  try {
    fs.writeFileSync(temporary, candidate, {
      mode: stat.mode & 0o777,
      flag: "wx",
    });
    if (fs.readFileSync(filename, "utf8") !== before)
      throw new Error("version manifest changed during resolution");
    fs.renameSync(temporary, filename);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return true;
}

if (
  process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    if (process.argv.length !== 3)
      throw new Error(
        "Usage: update-debian-snapshot.js YYYYMMDDT000000Z|--recent",
      );
    const current = fs
      .readFileSync(".devcontainer/versions.env", "utf8")
      .match(/^DEBIAN_SNAPSHOT=(.+)$/mu)?.[1];
    const selected =
      process.argv[2] === "--recent" ?
        [recentSnapshot(), current].sort().at(-1)
      : process.argv[2];
    console.log(
      updateDebianSnapshot({ snapshot: selected }) ?
        `Updated Debian snapshot to ${selected}`
      : "Debian snapshot/package pins unchanged",
    );
  } catch (error) {
    console.error(`Debian snapshot update failed: ${error.message}`);
    process.exitCode = 1;
  }
}
