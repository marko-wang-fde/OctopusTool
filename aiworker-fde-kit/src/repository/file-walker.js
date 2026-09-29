import { readdir } from "node:fs/promises";
import path from "node:path";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".tmp",
  ".worktrees",
  "coverage",
  "node_modules",
  "test-output",
]);

function compareNames(left, right) {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

function entryType(entry) {
  if (entry.isFile()) return "file";
  if (entry.isSymbolicLink()) return "symlink";
  return "other";
}

export function toRepositoryPath(filePath) {
  return filePath.split(path.sep).join("/");
}

export async function walkRepositoryEntries(
  root,
  relativeDirectory = "",
  options = {},
) {
  const ignoredDirectories =
    options.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES;
  const directory = path.join(root, relativeDirectory);
  let directoryEntries;

  try {
    directoryEntries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT" && relativeDirectory !== "") return [];
    throw error;
  }

  const entries = [];
  for (const entry of directoryEntries.sort(compareNames)) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      entries.push(
        ...(await walkRepositoryEntries(root, relativePath, {
          ignoredDirectories,
        })),
      );
    } else {
      entries.push({
        path: toRepositoryPath(relativePath),
        type: entryType(entry),
      });
    }
  }

  return entries;
}
