import {
  lstat,
  open,
  readdir,
} from "node:fs/promises";
import path from "node:path";

import { sortRelativePaths } from "../shared/canonical.js";

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".cache",
  "backup",
  "backups",
  "cache",
  "generated",
  "node_modules",
  "temp",
  "tmp",
]);
const AUTH_FILE_PARTS = new Set([
  "auth",
  "cookie",
  "credentials",
  "profile",
  "session",
  "token",
]);

export function deliveryExclusionReason(relativePath, includeSources) {
  const parts = relativePath.split("/");
  const basename = parts.at(-1).toLowerCase();
  const lowerParts = parts.map((part) => part.toLowerCase());
  if (
    !includeSources &&
    parts[0] === "inputs" &&
    parts[1] === "source-files"
  ) {
    return "source-material";
  }
  const excludedPart = lowerParts.find((part) =>
    EXCLUDED_DIRECTORY_NAMES.has(part));
  if (excludedPart) {
    return excludedPart;
  }
  if (parts.some((part) => part.startsWith(".tmp"))) return "temporary";
  if (parts.some((part) =>
    part.startsWith(".") && part !== ".gitignore")) {
    return "temporary";
  }
  if (basename === ".env" || basename.startsWith(".env.")) return "environment";
  const basenameParts = basename.split(/[._-]+/u);
  if (
    basenameParts.some((part) => AUTH_FILE_PARTS.has(part)) ||
    /secret-store|private-key/u.test(basename)
  ) {
    return "credentials";
  }
  if (/\.(?:bak|backup|tmp|swp)$/u.test(basename) || basename.endsWith("~")) {
    return "temporary";
  }
  if (
    basename.endsWith(".zip") &&
    !(
      includeSources &&
      parts[0] === "inputs" &&
      parts[1] === "source-files"
    )
  ) {
    return "existing-archive";
  }
  if (
    basenameParts.includes("stderr") ||
    (
      basenameParts.includes("raw") &&
      basenameParts.some((part) =>
        part === "diagnostic" || part === "diagnostics")
    )
  ) {
    return "raw-diagnostics";
  }
  return null;
}

async function readStableRegularFile(absolutePath) {
  const before = await lstat(absolutePath);
  if (before.isSymbolicLink()) {
    const error = new Error(`Delivery input is a symlink: ${absolutePath}`);
    error.code = "E_DELIVERY_SYMLINK";
    throw error;
  }
  if (!before.isFile()) {
    const error = new Error(`Delivery input is not a regular file: ${absolutePath}`);
    error.code = "E_DELIVERY_FILE_TYPE";
    throw error;
  }
  const handle = await open(absolutePath, "r");
  try {
    const opened = await handle.stat();
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      !opened.isFile()
    ) {
      throw new Error(`Delivery input changed before it was opened: ${absolutePath}`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== bytes.length
    ) {
      throw new Error(`Delivery input changed while it was read: ${absolutePath}`);
    }
    const confirmed = await lstat(absolutePath);
    if (
      confirmed.dev !== after.dev ||
      confirmed.ino !== after.ino ||
      confirmed.isSymbolicLink() ||
      !confirmed.isFile()
    ) {
      throw new Error(`Delivery input changed after it was read: ${absolutePath}`);
    }
    return { bytes, identity: confirmed };
  } finally {
    await handle.close();
  }
}

async function snapshotAncestors(projectRoot, relativePath) {
  const ancestors = [];
  const parts = relativePath.split("/").slice(0, -1);
  let current = projectRoot;
  const relativeParts = [];
  for (const part of ["", ...parts]) {
    if (part) {
      relativeParts.push(part);
      current = path.join(current, part);
    }
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Delivery ancestor is unsafe: ${relativePath}`);
    }
    ancestors.push({
      path: relativeParts.join("/"),
      type: "directory",
      dev: metadata.dev,
      ino: metadata.ino,
      mode: metadata.mode & 0o777,
    });
  }
  return ancestors;
}

export async function selectDeliveryFiles(projectRoot, options = {}) {
  if (!path.isAbsolute(projectRoot)) {
    const error = new Error("Project root must be absolute.");
    error.code = "E_DELIVERY_PROJECT_PATH";
    throw error;
  }
  const rootMetadata = await lstat(projectRoot);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    const error = new Error("Project root must be a non-symbolic directory.");
    error.code = "E_DELIVERY_PROJECT_TYPE";
    throw error;
  }
  const selected = new Map();
  const snapshots = new Map();
  const excluded = [];
  const stack = [""];
  while (stack.length > 0) {
    const relativeDirectory = stack.pop();
    const absoluteDirectory = relativeDirectory
      ? path.join(projectRoot, ...relativeDirectory.split("/"))
      : projectRoot;
    const before = await lstat(absoluteDirectory);
    if (before.isSymbolicLink() || !before.isDirectory()) {
      const error = new Error(`Delivery directory is unsafe: ${relativeDirectory}`);
      error.code = "E_DELIVERY_SYMLINK";
      throw error;
    }
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    const after = await lstat(absoluteDirectory);
    if (after.dev !== before.dev || after.ino !== before.ino) {
      throw new Error(`Delivery directory changed while walking: ${relativeDirectory}`);
    }
    for (const entry of entries) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        const error = new Error(`Delivery tree contains a symlink: ${relativePath}`);
        error.code = "E_DELIVERY_SYMLINK";
        throw error;
      }
      const reason = deliveryExclusionReason(
        relativePath,
        options.includeSources === true,
      );
      if (metadata.isDirectory()) {
        if (reason) {
          const descendants = [relativePath];
          while (descendants.length > 0) {
            const childDirectory = descendants.pop();
            const children = await readdir(path.join(
              projectRoot,
              ...childDirectory.split("/"),
            ), { withFileTypes: true });
            for (const child of children) {
              const childPath = `${childDirectory}/${child.name}`;
              const childMetadata = await lstat(path.join(
                projectRoot,
                ...childPath.split("/"),
              ));
              if (childMetadata.isSymbolicLink()) {
                const error = new Error(
                  `Excluded delivery tree contains a symlink: ${childPath}`,
                );
                error.code = "E_DELIVERY_SYMLINK";
                throw error;
              }
              if (childMetadata.isDirectory()) descendants.push(childPath);
              else excluded.push({ path: childPath, reason });
            }
          }
        } else {
          stack.push(relativePath);
        }
      } else if (metadata.isFile()) {
        if (reason) excluded.push({ path: relativePath, reason });
        else {
          const ancestors = await snapshotAncestors(
            projectRoot,
            relativePath,
          );
          const captured = await readStableRegularFile(absolutePath);
          const confirmedAncestors = await snapshotAncestors(
            projectRoot,
            relativePath,
          );
          if (
            ancestors.some((ancestor, index) =>
              ancestor.dev !== confirmedAncestors[index]?.dev ||
              ancestor.ino !== confirmedAncestors[index]?.ino)
          ) {
            throw new Error(
              `Delivery ancestors changed while reading: ${relativePath}`,
            );
          }
          selected.set(relativePath, captured.bytes);
          snapshots.set(relativePath, {
            path: relativePath,
            type: "file",
            dev: captured.identity.dev,
            ino: captured.identity.ino,
            mode: captured.identity.mode & 0o777,
            bytes: captured.bytes,
            ancestors,
          });
        }
      } else {
        const error = new Error(`Delivery tree contains an unsafe entry: ${relativePath}`);
        error.code = "E_DELIVERY_FILE_TYPE";
        throw error;
      }
    }
  }
  const files = new Map(
    sortRelativePaths([...selected.keys()]).map((relativePath) => [
      relativePath,
      selected.get(relativePath),
    ]),
  );
  excluded.sort((left, right) =>
    Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  return { files, excluded, snapshots };
}
