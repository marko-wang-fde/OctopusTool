import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  readdir,
  readFile,
  readlink,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

const DEFAULT_FS = {
  lstat,
  readdir,
  readFile,
  readlink,
  rename,
  rmdir,
  unlink,
};

function entryIdentity(entry) {
  return entry.identity ?? entry;
}

function metadataType(metadata) {
  if (metadata.isDirectory()) return "directory";
  if (metadata.isFile()) return "file";
  if (metadata.isSymbolicLink()) return "symlink";
  return "other";
}

function sameMetadata(metadata, entry) {
  const expected = entryIdentity(entry);
  return metadata.dev === expected.dev &&
    metadata.ino === expected.ino &&
    metadataType(metadata) === entry.type &&
    (metadata.mode & 0o777) === entry.mode;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function resolveEntry(root, relativePath) {
  return relativePath === "."
    ? root
    : path.join(root, ...relativePath.split("/"));
}

function parentEntryPath(relativePath) {
  if (relativePath === ".") return null;
  const segments = relativePath.split("/");
  segments.pop();
  return segments.length === 0 ? "." : segments.join("/");
}

function entryDepth(relativePath) {
  return relativePath === "." ? 0 : relativePath.split("/").length;
}

function validateInventory(expectedState) {
  if (!expectedState || !Array.isArray(expectedState.entries)) {
    throw new Error("Owned cleanup requires an entry inventory.");
  }
  const inventory = new Map();
  for (const entry of expectedState.entries) {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      (
        entry.path !== "." &&
        (
          entry.path.length === 0 ||
          path.isAbsolute(entry.path) ||
          entry.path.split("/").some((part) =>
            part === "" || part === "." || part === "..")
        )
      ) ||
      !["directory", "file", "symlink"].includes(entry.type) ||
      inventory.has(entry.path)
    ) {
      throw new Error("Owned cleanup inventory is invalid.");
    }
    inventory.set(entry.path, entry);
  }
  if (!inventory.has(".")) {
    throw new Error("Owned cleanup inventory has no root entry.");
  }
  for (const [relativePath] of inventory) {
    const parent = parentEntryPath(relativePath);
    if (
      parent !== null &&
      (
        inventory.get(parent)?.type !== "directory" ||
        entryDepth(parent) >= entryDepth(relativePath)
      )
    ) {
      throw new Error(`Owned cleanup inventory has no parent: ${relativePath}`);
    }
  }
  return inventory;
}

async function verifyEntry(fs, target, entry) {
  const before = await fs.lstat(target);
  if (!sameMetadata(before, entry)) {
    throw new Error(`Owned cleanup identity drifted: ${entry.path}`);
  }
  if (entry.type === "file") {
    const bytes = await fs.readFile(target);
    const after = await fs.lstat(target);
    if (
      !sameMetadata(after, entry) ||
      typeof entry.sha256 !== "string" ||
      sha256(bytes) !== entry.sha256
    ) {
      throw new Error(`Owned cleanup file drifted: ${entry.path}`);
    }
  } else if (entry.type === "symlink") {
    const linkTarget = await fs.readlink(target);
    const after = await fs.lstat(target);
    if (!sameMetadata(after, entry) || linkTarget !== entry.link_target) {
      throw new Error(`Owned cleanup symlink drifted: ${entry.path}`);
    }
  }
}

function directChildren(inventory, relativeDirectory) {
  return [...inventory.values()]
    .filter((entry) => parentEntryPath(entry.path) === relativeDirectory)
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}

async function verifyDirectoryNames(fs, target, expectedChildren) {
  const actual = (await fs.readdir(target)).sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const expected = expectedChildren.map(({ path: relativePath }) =>
    relativePath.split("/").at(-1));
  if (
    actual.length !== expected.length ||
    actual.some((name, index) => name !== expected[index])
  ) {
    throw new Error(`Owned cleanup directory entries drifted: ${target}`);
  }
}

async function verifyInventory(fs, root, inventory) {
  for (const entry of [...inventory.values()].sort((left, right) =>
    entryDepth(left.path) - entryDepth(right.path) ||
    Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)))) {
    await verifyEntry(fs, resolveEntry(root, entry.path), entry);
    if (entry.type === "directory") {
      await verifyDirectoryNames(
        fs,
        resolveEntry(root, entry.path),
        directChildren(inventory, entry.path),
      );
    }
  }
}

async function removeEntry({
  actualPath,
  entry,
  fs,
  hooks,
  inventory,
  isRoot,
  recoveryRoot,
}) {
  let claimedPath = actualPath;
  if (!isRoot) {
    claimedPath = `${actualPath}.cleanup-${randomUUID()}`;
    await fs.rename(actualPath, claimedPath);
    await hooks?.afterEntryClaimed?.({
      claimedPath,
      recoveryRoot,
      relativePath: entry.path,
      type: entry.type,
    });
  }
  await verifyEntry(fs, claimedPath, entry);

  if (entry.type === "directory") {
    const children = directChildren(inventory, entry.path);
    await verifyDirectoryNames(fs, claimedPath, children);
    for (const child of children) {
      await removeEntry({
        actualPath: path.join(
          claimedPath,
          child.path.split("/").at(-1),
        ),
        entry: child,
        fs,
        hooks,
        inventory,
        isRoot: false,
        recoveryRoot,
      });
    }
    await verifyEntry(fs, claimedPath, entry);
    await hooks?.afterEntryVerified?.({
      claimedPath,
      recoveryRoot,
      relativePath: entry.path,
      type: entry.type,
    });
    await verifyEntry(fs, claimedPath, entry);
    if ((await fs.readdir(claimedPath)).length !== 0) {
      throw new Error(`Owned cleanup directory is no longer empty: ${entry.path}`);
    }
    // Node cannot make the final pathname lookup and rmdir inode-atomic.
    // This cooperative same-UID boundary is scoped to an already-claimed,
    // verified directory; rmdir remains conditional on emptiness.
    await fs.rmdir(claimedPath);
    return;
  }

  await hooks?.afterEntryVerified?.({
    claimedPath,
    recoveryRoot,
    relativePath: entry.path,
    type: entry.type,
  });
  await verifyEntry(fs, claimedPath, entry);
  // Node cannot bind unlink to the verified inode portably. The final
  // lstat/read/lstat -> unlink gap is therefore a cooperative same-UID
  // boundary inside an unpredictable claim name, not a fully atomic claim.
  await fs.unlink(claimedPath);
}

export async function cleanupClaimedOwnedPath(
  claimedPath,
  expectedState,
  options = {},
) {
  const fs = { ...DEFAULT_FS, ...options.fs };
  let inventory;
  try {
    inventory = validateInventory(expectedState);
    await verifyInventory(fs, claimedPath, inventory);
    await options.hooks?.afterInventoryVerified?.({ claimedPath });
    await removeEntry({
      actualPath: claimedPath,
      entry: inventory.get("."),
      fs,
      hooks: options.hooks,
      inventory,
      isRoot: true,
      recoveryRoot: claimedPath,
    });
  } catch (cause) {
    const error = new Error(
      "Owned cleanup stopped because the claimed path changed or could not be removed.",
      { cause },
    );
    error.code = "E_OWNED_CLEANUP_DRIFT";
    error.recoveryPaths = [claimedPath];
    throw error;
  }
}
