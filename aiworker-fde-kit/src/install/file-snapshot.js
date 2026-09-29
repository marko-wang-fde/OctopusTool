import { createHash } from "node:crypto";
import { lstat, readdir, readFile, readlink } from "node:fs/promises";
import path from "node:path";

import { sortRelativePaths } from "../shared/canonical.js";

const EXACT_FILES = ["LICENSE", "SKILL.md"];
const TRACKED_ROOTS = [
  "agents",
  "assets/examples",
  "assets/project-template",
  "catalog",
  "references",
  "schemas",
  "scripts",
];

export class SkillSnapshotError extends Error {
  constructor(code, relativePath, message) {
    super(message);
    this.name = "SkillSnapshotError";
    this.code = code;
    this.path = relativePath;
  }
}

function modeString(stat) {
  return `0${(stat.mode & 0o777).toString(8).padStart(3, "0")}`.slice(-4);
}

async function maybeLstat(absolutePath) {
  try {
    return await lstat(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function inspect(root, relativePath, entries) {
  const absolutePath = path.join(root, relativePath);
  const stat = await lstat(absolutePath);
  if (stat.isDirectory()) {
    const children = sortRelativePaths(await readdir(absolutePath));
    for (const child of children) {
      await inspect(root, `${relativePath}/${child}`, entries);
    }
    return;
  }
  if (stat.isFile()) {
    const bytes = await readFile(absolutePath);
    entries.set(relativePath, {
      type: "file",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      mode: modeString(stat),
      link_target: null,
    });
    return;
  }
  if (stat.isSymbolicLink()) {
    entries.set(relativePath, {
      type: "symlink",
      sha256: null,
      mode: modeString(stat),
      link_target: await readlink(absolutePath),
    });
    return;
  }
  throw new SkillSnapshotError(
    "E_SKILL_UNSUPPORTED_TYPE",
    relativePath,
    `Unsupported filesystem object in Skill source: ${relativePath}`,
  );
}

function treeBytes(files) {
  return Buffer.from(Object.entries(files).map(([relativePath, entry]) =>
    `${relativePath}\0${entry.type}\0${entry.mode}\0` +
    `${entry.sha256 ?? ""}\0${entry.link_target ?? ""}\n`
  ).join(""), "utf8");
}

export function computeSkillTreeHash(files) {
  return createHash("sha256").update(treeBytes(files)).digest("hex");
}

export async function snapshotSkillTree(root) {
  const absoluteRoot = path.resolve(root);
  const entries = new Map();
  for (const relativePath of EXACT_FILES) {
    if (await maybeLstat(path.join(absoluteRoot, relativePath))) {
      await inspect(absoluteRoot, relativePath, entries);
    }
  }
  for (const relativePath of TRACKED_ROOTS) {
    if (await maybeLstat(path.join(absoluteRoot, relativePath))) {
      await inspect(absoluteRoot, relativePath, entries);
    }
  }
  const sortedFiles = Object.fromEntries(
    sortRelativePaths([...entries.keys()]).map((relativePath) => [
      relativePath,
      entries.get(relativePath),
    ]),
  );
  return {
    files: sortedFiles,
    source_tree_hash: computeSkillTreeHash(sortedFiles),
  };
}

function entryIdentity(entry) {
  return JSON.stringify([
    entry.type,
    entry.mode,
    entry.sha256,
    entry.link_target,
  ]);
}

export function compareSkillSnapshots(before, after) {
  const beforeFiles = before?.files ?? {};
  const afterFiles = after?.files ?? {};
  const deleted = [];
  const added = [];
  const changes = [];
  for (const [relativePath, oldEntry] of Object.entries(beforeFiles)) {
    const newEntry = afterFiles[relativePath];
    if (!newEntry) {
      deleted.push([relativePath, oldEntry]);
    } else if (oldEntry.type !== newEntry.type) {
      changes.push({ kind: "type", path: relativePath });
    } else {
      if (oldEntry.mode !== newEntry.mode) {
        changes.push({ kind: "mode", path: relativePath });
      }
      if (
        oldEntry.sha256 !== newEntry.sha256 ||
        oldEntry.link_target !== newEntry.link_target
      ) {
        changes.push({ kind: "content", path: relativePath });
      }
    }
  }
  for (const [relativePath, entry] of Object.entries(afterFiles)) {
    if (!beforeFiles[relativePath]) added.push([relativePath, entry]);
  }
  const used = new Set();
  for (const [oldPath, oldEntry] of deleted) {
    const found = added.findIndex(([, newEntry], index) =>
      !used.has(index) && entryIdentity(oldEntry) === entryIdentity(newEntry)
    );
    if (found >= 0) {
      used.add(found);
      changes.push({
        kind: "renamed",
        from: oldPath,
        path: added[found][0],
      });
    } else {
      changes.push({ kind: "deleted", path: oldPath });
    }
  }
  added.forEach(([relativePath], index) => {
    if (!used.has(index)) changes.push({ kind: "added", path: relativePath });
  });
  changes.sort((left, right) =>
    Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)) ||
    left.kind.localeCompare(right.kind)
  );
  return { equal: changes.length === 0, changes };
}

export function canonicalSkillPaths() {
  return {
    exact_files: [...EXACT_FILES],
    roots: [...TRACKED_ROOTS],
  };
}
