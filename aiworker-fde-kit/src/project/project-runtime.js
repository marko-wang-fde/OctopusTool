import { constants as fileConstants } from "node:fs";
import * as defaultFs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";

import {
  SCHEMA_IDS,
  createOfficialSchemaRegistry,
  validateSchema,
} from "../contracts/schema-registry.js";
import { parseSafeYaml } from "../contracts/safe-data.js";
import { sha256Bytes } from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";

const MODULE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const TEMPLATE_ROOT = path.join(MODULE_ROOT, "assets/project-template");

export const MANIFEST_NAME = "fde-project.yaml";
export const STAGES = [
  "initialize",
  "discover",
  "team-design",
  "foundation-design",
  "author",
  "assemble",
  "validate",
];
export const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const CONFIRMATION_HASH = /^[a-f0-9]{64}$/u;

export function projectTransactionLockPath(projectPath) {
  return path.join(
    path.dirname(projectPath),
    `.${path.basename(projectPath)}.${MANIFEST_NAME}.transaction.lock`,
  );
}

let officialRegistryPromise;

export function makeResult(exitCode, issues = [], data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

export function blocker(code, pathValue, message, details = {}) {
  return issue("BLOCKER", code, pathValue, message, details);
}

export function warning(code, pathValue, message, details = {}) {
  return issue("WARNING", code, pathValue, message, details);
}

export function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function validateOfficialProject(value) {
  officialRegistryPromise ??= createOfficialSchemaRegistry();
  const registry = await officialRegistryPromise;
  return validateSchema(registry, SCHEMA_IDS.project, value);
}

export function createDependencies(overrides = {}) {
  const fs = { ...defaultFs, ...(overrides.fs ?? {}) };
  return {
    fs,
    clock: overrides.clock ?? (() => new Date()),
    hashBytes: overrides.hashBytes ?? sha256Bytes,
    rename: overrides.rename ?? fs.rename,
    link: overrides.link ?? fs.link,
    templateRoot: overrides.templateRoot ?? TEMPLATE_ROOT,
    validateProject: overrides.validateProject ?? validateOfficialProject,
  };
}

export function isoTime(clock) {
  const value = clock();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error("Injected clock returned an invalid date.");
  }
  return date.toISOString();
}

export async function pathExists(fs, absolutePath) {
  try {
    await fs.lstat(absolutePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function assertDirectory(
  fs,
  absolutePath,
  label,
  options = {},
) {
  const metadata = await fs.lstat(absolutePath);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${label} must be a non-symbolic-link directory.`);
  }
  const accessMode =
    fileConstants.R_OK |
    (options.writable === false ? 0 : fileConstants.W_OK);
  await fs.access(absolutePath, accessMode);
}

export async function readRegularFileNoFollow(fs, absolutePath) {
  let handle;
  try {
    const initial = await fs.lstat(absolutePath);
    if (initial.isSymbolicLink() || !initial.isFile()) {
      throw Object.assign(
        new Error("Path is not a regular non-symbolic-link file."),
        { code: "E_UNSAFE_FILE" },
      );
    }
    handle = await fs.open(
      absolutePath,
      fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
    );
    const opened = await handle.stat();
    const current = await fs.lstat(absolutePath);
    if (
      !opened.isFile() ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino
    ) {
      throw Object.assign(new Error("Path changed while it was being opened."), {
        code: "E_UNSAFE_FILE",
      });
    }
    return await handle.readFile();
  } finally {
    await handle?.close();
  }
}

export function sameFilesystemIdentity(left, right) {
  return Boolean(
    left &&
    right &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.mode === right.mode,
  );
}

function directoryIdentity(metadata) {
  return {
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
    type: "directory",
  };
}

function fileIdentity(metadata) {
  return {
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
    type: "file",
  };
}

export async function assertDirectoryIdentity(
  fs,
  absolutePath,
  identity,
) {
  const current = await fs.lstat(absolutePath);
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    (identity?.type !== undefined && identity.type !== "directory") ||
    !sameFilesystemIdentity(current, identity)
  ) {
    throw Object.assign(
      new Error(`Contained directory identity changed: ${absolutePath}`),
      { code: "E_UNSAFE_FILE" },
    );
  }
  return current;
}

export async function snapshotContainedDirectoryChain(
  fs,
  root,
  relativePath,
) {
  if (relativePath && !safeInventoryPath(relativePath)) {
    throw Object.assign(new Error("Contained path is unsafe."), {
      code: "E_UNSAFE_FILE",
    });
  }
  const entries = [];
  let current = root;
  const directories = relativePath
    ? relativePath.split("/").slice(0, -1)
    : [];
  for (const relativeDirectory of ["", ...directories.map(
    (_part, index) => directories.slice(0, index + 1).join("/"),
  )]) {
    current = relativeDirectory
      ? path.join(root, ...relativeDirectory.split("/"))
      : root;
    const metadata = await fs.lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw Object.assign(
        new Error(`Contained ancestor is unsafe: ${current}`),
        { code: "E_UNSAFE_FILE" },
      );
    }
    entries.push({
      relativePath: relativeDirectory,
      identity: directoryIdentity(metadata),
    });
  }
  return { root: path.resolve(root), entries };
}

export async function assertContainedDirectoryChain(
  fs,
  snapshot,
) {
  for (const entry of snapshot.entries) {
    const absolutePath = entry.relativePath
      ? path.join(snapshot.root, ...entry.relativePath.split("/"))
      : snapshot.root;
    await assertDirectoryIdentity(fs, absolutePath, entry.identity);
  }
}

export async function readContainedRegularFileSnapshotNoFollow(
  fs,
  root,
  relativePath,
) {
  if (!safeInventoryPath(relativePath)) {
    throw Object.assign(new Error("Contained file path is unsafe."), {
      code: "E_UNSAFE_FILE",
    });
  }
  const ancestors = await snapshotContainedDirectoryChain(
    fs,
    root,
    relativePath,
  );
  const absolutePath = path.join(root, ...relativePath.split("/"));
  let handle;
  try {
    const initial = await fs.lstat(absolutePath);
    if (initial.isSymbolicLink() || !initial.isFile()) {
      throw Object.assign(
        new Error("Contained path is not a regular file."),
        { code: "E_UNSAFE_FILE" },
      );
    }
    handle = await fs.open(
      absolutePath,
      fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
    );
    const opened = await handle.stat();
    await assertContainedDirectoryChain(fs, ancestors);
    const current = await fs.lstat(absolutePath);
    if (
      !opened.isFile() ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      !sameFilesystemIdentity(initial, opened) ||
      !sameFilesystemIdentity(opened, current)
    ) {
      throw Object.assign(
        new Error("Contained file identity changed while opening."),
        { code: "E_UNSAFE_FILE" },
      );
    }
    const bytes = await handle.readFile();
    const after = await handle.stat();
    const final = await fs.lstat(absolutePath);
    await assertContainedDirectoryChain(fs, ancestors);
    if (
      !sameFilesystemIdentity(opened, after) ||
      !sameFilesystemIdentity(after, final) ||
      final.isSymbolicLink() ||
      !final.isFile()
    ) {
      throw Object.assign(
        new Error("Contained file identity changed while reading."),
        { code: "E_UNSAFE_FILE" },
      );
    }
    return {
      path: relativePath,
      type: "file",
      ...fileIdentity(final),
      bytes,
      sha256: sha256Bytes(bytes),
      ancestors,
    };
  } finally {
    await handle?.close();
  }
}

export async function readContainedRegularFileNoFollow(
  fs,
  root,
  relativePath,
) {
  const snapshot = await readContainedRegularFileSnapshotNoFollow(
    fs,
    root,
    relativePath,
  );
  return snapshot.bytes;
}

export function safeInventoryPath(relativePath) {
  return (
    typeof relativePath === "string" &&
    relativePath.length > 0 &&
    !path.posix.isAbsolute(relativePath) &&
    !path.win32.isAbsolute(relativePath) &&
    !relativePath.includes("\\") &&
    !relativePath.includes("\u0000") &&
    !relativePath.split("/").some((part) => part === "." || part === "..")
  );
}

export async function loadTemplateInventory(deps) {
  const inventoryPath = path.join(deps.templateRoot, "template-inventory.yaml");
  const inventory = parseSafeYaml(
    await deps.fs.readFile(inventoryPath, "utf8"),
    "template-inventory.yaml",
  );
  if (
    inventory.schema_version !== 1 ||
    !Array.isArray(inventory.fixed) ||
    new Set(inventory.fixed).size !== inventory.fixed.length ||
    inventory.fixed.some((entry) => !safeInventoryPath(entry))
  ) {
    throw new Error("Template inventory has an invalid fixed file list.");
  }
  return inventory;
}

export async function copyFixedTemplate(stagingPath, inventory, deps) {
  for (const relativePath of inventory.fixed) {
    const sourcePath = path.join(deps.templateRoot, relativePath);
    const metadata = await deps.fs.lstat(sourcePath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Template source is not a regular file: ${relativePath}`);
    }
    const targetPath = path.join(stagingPath, ...relativePath.split("/"));
    await deps.fs.mkdir(path.dirname(targetPath), { recursive: true });
    await deps.fs.writeFile(targetPath, await deps.fs.readFile(sourcePath));
  }
}

export async function validateStagedInventory(
  stagingPath,
  inventory,
  deps,
) {
  for (const relativePath of inventory.fixed) {
    const metadata = await deps.fs.lstat(
      path.join(stagingPath, ...relativePath.split("/")),
    );
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Staged fixed file is invalid: ${relativePath}`);
    }
  }
  for (const entry of Object.values(inventory.conditional ?? {})) {
    if (await pathExists(deps.fs, path.join(stagingPath, entry.target))) {
      throw new Error(`Conditional template was copied: ${entry.target}`);
    }
  }
}

export async function loadTemplateManifest(deps) {
  return parseSafeYaml(
    await deps.fs.readFile(
      path.join(deps.templateRoot, MANIFEST_NAME),
      "utf8",
    ),
    MANIFEST_NAME,
  );
}

export function serializeYaml(value) {
  return stringify(value, { lineWidth: 0 });
}

export async function removeStaging(stagingPath, stagingIdentity, deps) {
  if (!stagingPath) return { owned: false, recoveryPaths: [] };
  let recoveryRoot;
  try {
    recoveryRoot = await deps.fs.mkdtemp(
      path.join(
        path.dirname(path.dirname(stagingPath)),
        `.${path.basename(stagingPath)}.recovery-`,
      ),
    );
  } catch (error) {
    error.recoveryPaths = [stagingPath];
    throw error;
  }
  const recoveryPath = path.join(recoveryRoot, "staging");
  try {
    await deps.fs.rename(stagingPath, recoveryPath);
  } catch (error) {
    try {
      await deps.fs.rmdir(recoveryRoot);
    } catch (cleanupError) {
      if (error?.code === "ENOENT") {
        return {
          owned: false,
          recoveryPaths: [recoveryRoot],
          cleanupWarning: errorText(cleanupError),
        };
      }
      error.recoveryPaths = [stagingPath, recoveryRoot];
      throw error;
    }
    if (error?.code === "ENOENT") {
      return { owned: false, recoveryPaths: [] };
    }
    error.recoveryPaths = [stagingPath];
    throw error;
  }
  try {
    const movedIdentity = await deps.fs.lstat(recoveryPath);
    return {
      owned:
        Boolean(stagingIdentity) &&
        movedIdentity.dev === stagingIdentity.dev &&
        movedIdentity.ino === stagingIdentity.ino,
      recoveryPaths: [recoveryPath],
    };
  } catch (error) {
    error.recoveryPaths = [recoveryPath];
    throw error;
  }
}
