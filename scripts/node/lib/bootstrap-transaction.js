/**
 * Durable recovery for the four coupled mise bootstrap files. A journal is
 * persisted before any replacement. Interrupted partial updates roll back only
 * when every file still matches a recorded old or new value.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

export const bootstrapFiles = Object.freeze({
  versions: ".devcontainer/versions.env",
  checksums: ".devcontainer/checksums.sha256",
  action: ".github/actions/setup-node-deps/action.yml",
  config: "mise.toml",
});
const journalName = ".devcontainer/.mise-bootstrap-update";
const names = Object.values(bootstrapFiles);
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function syncDirectory(directory) {
  // Node cannot open directories for fsync on Windows. Atomic renames remain,
  // but power-loss durability there depends on the filesystem/OS.
  if (process.platform === "win32") return;
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function writeDurably(filename, bytes, mode) {
  const descriptor = fs.openSync(filename, "wx", mode);
  try {
    fs.writeFileSync(descriptor, bytes);
    fs.fchmodSync(descriptor, mode);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function target(root, name) {
  if (!names.includes(name))
    throw new Error("unexpected bootstrap transaction path");
  const components = name.split("/");
  for (const index of components.keys()) {
    const filename = path.join(root, ...components.slice(0, index + 1));
    const stat = fs.lstatSync(filename);
    if (
      stat.isSymbolicLink()
      || !(index === components.length - 1 ? stat.isFile() : stat.isDirectory())
    )
      throw new Error(`unsafe bootstrap transaction path: ${name}`);
  }
  return path.join(root, name);
}

function processStart(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19];
  } catch {
    return null;
  }
}

function bootIdentity() {
  try {
    return fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
  } catch {
    return null;
  }
}

function namespaceIdentity() {
  try {
    return fs.readlinkSync("/proc/self/ns/pid");
  } catch {
    return null;
  }
}

function withLock(root, operation) {
  if (process.platform === "win32")
    throw new Error(
      "Durable bootstrap updates require flock in the Linux devcontainer",
    );
  const parent = path.join(root, ".devcontainer");
  const stat = fs.lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error("unsafe bootstrap recovery directory");
  const descriptor = fs.openSync(
    path.join(parent, ".mise-bootstrap-update.lock"),
    fs.constants.O_CREAT | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW,
    0o600,
  );
  try {
    if (!fs.fstatSync(descriptor).isFile())
      throw new Error("unsafe bootstrap lock");
    // flock uses the shared open-file description. Its helper exits, but this
    // descriptor keeps the lock held until close or process termination.
    const lock = spawnSync("flock", ["--exclusive", "--nonblock", "3"], {
      stdio: ["ignore", "pipe", "pipe", descriptor],
      encoding: "utf8",
      timeout: 5000,
    });
    if (lock.error)
      throw new Error(
        `Bootstrap locking requires flock: ${lock.error.message}`,
        { cause: lock.error },
      );
    if (lock.status === 1)
      throw new Error("a bootstrap update or recovery is still running");
    if (lock.status !== 0)
      throw new Error(`Bootstrap locking failed: ${lock.stderr.trim()}`);
    return operation();
  } finally {
    fs.closeSync(descriptor);
  }
}

function atomicReplace(filename, bytes, mode) {
  const temporary = path.join(
    path.dirname(filename),
    `.${path.basename(filename)}.mise-update-${randomUUID()}`,
  );
  try {
    writeDurably(temporary, bytes, mode);
    fs.renameSync(temporary, filename);
    syncDirectory(path.dirname(filename));
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function clearJournal(directory) {
  fs.unlinkSync(path.join(directory, "state.json"));
  fs.rmdirSync(directory);
  syncDirectory(path.dirname(directory));
}

function readState(directory) {
  if (fs.lstatSync(directory).isSymbolicLink())
    throw new Error("unsafe bootstrap recovery journal");
  const filename = path.join(directory, "state.json");
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
    throw new Error("invalid bootstrap recovery journal");
  const state = JSON.parse(fs.readFileSync(filename, "utf8"));
  if (
    state.format !== 2
    || !Array.isArray(state.entries)
    || state.entries.length !== names.length
    || new Set(state.entries.map((entry) => entry.name)).size !== names.length
    || !Number.isSafeInteger(state.owner?.pid)
    || state.owner.pid < 1
    || state.owner.pid > 2147483647
    || typeof state.owner.host !== "string"
    || !(state.owner.start === null || typeof state.owner.start === "string")
    || !(state.owner.boot === null || typeof state.owner.boot === "string")
    || !(
      state.owner.namespace === null
      || typeof state.owner.namespace === "string"
    )
  )
    throw new Error("invalid bootstrap recovery journal");
  for (const entry of state.entries) {
    if (
      !names.includes(entry.name)
      || !Number.isInteger(entry.mode)
      || entry.mode < 0
      || entry.mode > 0o777
    )
      throw new Error("invalid bootstrap recovery entry");
    for (const kind of ["before", "after"]) {
      if (typeof entry[kind] !== "string")
        throw new Error("invalid bootstrap recovery bytes");
      const bytes = Buffer.from(entry[kind], "base64");
      if (
        bytes.toString("base64") !== entry[kind]
        || digest(bytes) !== entry[`${kind}Hash`]
      )
        throw new Error("damaged bootstrap recovery bytes");
    }
  }
  return state;
}

function restore(root, directory, state, rollback = false) {
  // Check the complete set before writing anything. Never discard later edits.
  const current = state.entries.map((entry) => {
    const filename = target(root, entry.name);
    const bytes = fs.readFileSync(filename);
    if (
      (fs.statSync(filename).mode & 0o777) !== entry.mode
      || (!bytes.equals(Buffer.from(entry.before, "base64"))
        && !bytes.equals(Buffer.from(entry.after, "base64")))
    )
      throw new Error(
        `bootstrap recovery conflicts with edits to ${entry.name}; journal retained for review`,
      );
    return { entry, filename, bytes };
  });
  const completed =
    !rollback
    && current.every(({ entry, bytes }) =>
      bytes.equals(Buffer.from(entry.after, "base64")),
    );
  if (!completed) {
    for (const { entry, filename, bytes } of current) {
      const original = Buffer.from(entry.before, "base64");
      if (!bytes.equals(original)) {
        if (!fs.readFileSync(filename).equals(bytes))
          throw new Error(
            `file changed during recovery: ${entry.name}; journal retained`,
          );
        atomicReplace(filename, original, entry.mode);
      }
    }
  }
  clearJournal(directory);
  return completed ? "completed" : "rolled back";
}

export function recoverBootstrapUpdate(root = process.cwd()) {
  const directory = path.join(root, journalName);
  // The no-journal path needs neither subprocesses nor maintenance dependencies.
  try {
    fs.lstatSync(directory);
  } catch (error) {
    if (error.code === "ENOENT") return "none";
    throw error;
  }
  return withLock(root, () => recoverUnlocked(root));
}

function recoverUnlocked(root) {
  const directory = path.join(root, journalName);
  const parent = fs.lstatSync(path.dirname(directory));
  if (!parent.isDirectory() || parent.isSymbolicLink())
    throw new Error("unsafe bootstrap recovery directory");
  try {
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error("unsafe bootstrap recovery journal");
  } catch (error) {
    if (error.code === "ENOENT") return "none";
    throw error;
  }
  // A crash between journal unlink and directory removal leaves an empty lock.
  if (fs.readdirSync(directory).length === 0) {
    fs.rmdirSync(directory);
    syncDirectory(path.dirname(directory));
    return "completed cleanup";
  }
  if (fs.readdirSync(directory).some((name) => name !== "state.json"))
    throw new Error("unexpected bootstrap journal contents");
  const state = readState(directory);
  return restore(root, directory, state);
}

export function applyBootstrapChanges(root, originals, proposed) {
  return withLock(root, () => applyUnlocked(root, originals, proposed));
}

function applyUnlocked(root, originals, proposed) {
  if (
    proposed.size !== names.length
    || [...proposed.keys()].some((name) => !names.includes(name))
  )
    throw new Error("bootstrap transaction must include all four files");
  const directory = path.join(root, journalName);
  if (fs.existsSync(directory))
    throw new Error("unfinished bootstrap update; recover it first");
  const entries = [...proposed].map(([name, after]) => {
    const filename = target(root, name);
    const before = originals.get(name);
    if (!before || !fs.readFileSync(filename).equals(before))
      throw new Error(`file changed during update: ${name}`);
    return {
      name,
      mode: fs.statSync(filename).mode & 0o777,
      before: before.toString("base64"),
      after: Buffer.from(after).toString("base64"),
      beforeHash: digest(before),
      afterHash: digest(after),
    };
  });
  for (const [name, contents] of originals) {
    if (!fs.readFileSync(path.join(root, name)).equals(contents))
      throw new Error(
        `file changed during update: ${name}; retry after reviewing it`,
      );
  }
  const state = {
    format: 2,
    owner: {
      pid: process.pid,
      host: os.hostname(),
      start: processStart(process.pid),
      boot: bootIdentity(),
      namespace: namespaceIdentity(),
    },
    entries,
  };
  const preparing = fs.mkdtempSync(`${directory}.preparing-`);
  try {
    writeDurably(
      path.join(preparing, "state.json"),
      JSON.stringify(state),
      0o600,
    );
    syncDirectory(preparing);
    fs.renameSync(preparing, directory);
    syncDirectory(path.dirname(directory));
  } finally {
    fs.rmSync(preparing, { recursive: true, force: true });
  }
  try {
    for (const entry of entries) {
      const filename = target(root, entry.name);
      if (
        !fs.readFileSync(filename).equals(Buffer.from(entry.before, "base64"))
      )
        throw new Error(
          `file changed during update: ${entry.name}; journal retained for review`,
        );
      atomicReplace(filename, Buffer.from(entry.after, "base64"), entry.mode);
    }
  } catch (error) {
    try {
      restore(root, directory, state, true);
    } catch (recoveryError) {
      throw new Error(`${error.message}; ${recoveryError.message}`, {
        cause: recoveryError,
      });
    }
    throw error;
  }
  clearJournal(directory);
}
