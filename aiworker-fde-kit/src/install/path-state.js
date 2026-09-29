import { createHash } from "node:crypto";
import {
  lstat,
  readdir,
  readFile,
  readlink,
  rename,
} from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import {
  cleanupClaimedOwnedPath,
} from "../shared/owned-tree-cleanup.js";

async function maybeLstat(pathValue) {
  try {
    return await lstat(pathValue);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function identity(stat) {
  return {
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    size: stat.size,
  };
}

async function walk(absolutePath, relativePath, entries) {
  const stat = await lstat(absolutePath);
  const common = {
    identity: identity(stat),
    mode: stat.mode & 0o777,
    path: relativePath,
  };
  if (stat.isDirectory()) {
    entries.push({ ...common, type: "directory" });
    const children = (await readdir(absolutePath)).sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right))
    );
    for (const child of children) {
      await walk(
        path.join(absolutePath, child),
        relativePath === "." ? child : `${relativePath}/${child}`,
        entries,
      );
    }
  } else if (stat.isFile()) {
    entries.push({
      ...common,
      type: "file",
      sha256: createHash("sha256")
        .update(await readFile(absolutePath))
        .digest("hex"),
    });
  } else if (stat.isSymbolicLink()) {
    entries.push({
      ...common,
      type: "symlink",
      link_target: await readlink(absolutePath),
    });
  } else {
    entries.push({ ...common, type: "other" });
  }
}

export async function capturePathState(pathValue) {
  if (!(await maybeLstat(pathValue))) return null;
  const entries = [];
  await walk(pathValue, ".", entries);
  return { entries };
}

export function samePathState(left, right) {
  return isDeepStrictEqual(left, right);
}

export function semanticPathState(state) {
  if (!state) return null;
  return {
    entries: state.entries.map(({ identity: _identity, ...entry }) => entry),
  };
}

export function samePathContent(left, right) {
  return isDeepStrictEqual(
    semanticPathState(left),
    semanticPathState(right),
  );
}

export async function deleteClaimedIfUnchanged(
  pathValue,
  expectedState,
  options = {},
) {
  const current = await capturePathState(pathValue);
  if (!samePathState(current, expectedState)) return false;
  await cleanupClaimedOwnedPath(pathValue, expectedState, options);
  return true;
}

export async function claimAndVerify(livePath, quarantinePath, expectedState) {
  await rename(livePath, quarantinePath);
  const claimed = await capturePathState(quarantinePath);
  return { claimed, matches: samePathState(claimed, expectedState) };
}
