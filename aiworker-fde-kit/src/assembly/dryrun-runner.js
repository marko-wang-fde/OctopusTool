import { randomUUID } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  chmod,
  cp,
  lstat,
  link,
  mkdtemp,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  unlink,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseSafeJson, parseSafeYaml } from "../contracts/safe-data.js";
import {
  canonicalBytes,
  normalizeMarkdown,
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import {
  isStrictSafeRelativePath,
} from "../shared/safe-relative-path.js";
import { issue } from "../shared/result.js";
import {
  claimFileForReplacement,
  removeIfOwned,
} from "../project/validation-report.js";
import { spawnCommand } from "./cli-runner.js";
import {
  buildOperationArgv,
  operationArgvMap,
} from "./dryrun-renderer.js";

const EXACT_ARTIFACTS = new Set([
  "fde-project.yaml",
  "assembly/operations.yaml",
  "assembly/octopus-cli-assemble.sh",
  "delivery-summary.md",
]);
const ARTIFACT_PREFIXES = [
  "discovery/",
  "design/",
  "employees/",
  "skills/",
  "arcubase/",
  "assembly/payloads/",
  "acceptance/",
];
const HASH_PATTERN = /^[a-f0-9]{64}$/u;
const CONTEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;

export class DryrunRunnerError extends Error {
  constructor(exitCode, code, message, details = {}, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "DryrunRunnerError";
    this.exitCode = exitCode;
    this.code = code;
    this.details = details;
  }
}

function isArtifactPath(relativePath) {
  return isStrictSafeRelativePath(relativePath) && (
    EXACT_ARTIFACTS.has(relativePath) ||
    ARTIFACT_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  );
}

function validateArtifactFileMap(files) {
  if (!(files instanceof Map)) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_ARTIFACT_PATH",
      "Prepared artifact files must be supplied as a path-to-bytes map.",
    );
  }
  for (const [relativePath, bytes] of files) {
    if (
      !isStrictSafeRelativePath(relativePath) ||
      !Buffer.isBuffer(bytes)
    ) {
      throw new DryrunRunnerError(
        3,
        "B_ASSEMBLY_ARTIFACT_PATH",
        "Prepared artifact files contain an unsafe path or non-byte value.",
        { artifact_path: String(relativePath) },
      );
    }
  }
  return files;
}

async function collectArtifactPaths(root, relativeDirectory = "") {
  const directory = relativeDirectory
    ? path.join(root, ...relativeDirectory.split("/"))
    : root;
  const metadata = await lstat(directory);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`Artifact directory is symbolic or unsafe: ${relativeDirectory || "."}`);
  }
  const found = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (
      relativePath === "generated" ||
      relativePath === "reports" ||
      relativePath === "delivery" ||
      relativePath === "inputs"
    ) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    const current = await lstat(absolutePath);
    if (current.isSymbolicLink()) {
      if (isArtifactPath(relativePath)) {
        throw new Error(`Artifact path must not be symbolic: ${relativePath}`);
      }
      continue;
    }
    if (current.isDirectory()) {
      if (
        ARTIFACT_PREFIXES.some((prefix) =>
          prefix.startsWith(`${relativePath}/`) ||
          relativePath.startsWith(prefix))
      ) {
        found.push(...await collectArtifactPaths(root, relativePath));
      }
    } else if (current.isFile() && isArtifactPath(relativePath)) {
      found.push(relativePath);
    }
  }
  return found;
}

function canonicalArtifactBytes(relativePath, bytes) {
  if (relativePath.endsWith(".yaml") || relativePath.endsWith(".yml")) {
    return canonicalBytes(parseSafeYaml(bytes.toString("utf8"), relativePath));
  }
  if (relativePath.endsWith(".json")) {
    return canonicalBytes(parseSafeJson(bytes.toString("utf8"), relativePath));
  }
  if (relativePath.endsWith(".md")) {
    return Buffer.from(normalizeMarkdown(bytes.toString("utf8")), "utf8");
  }
  return bytes;
}

export async function computeArtifactSetHash(projectRoot) {
  return computeArtifactSetHashFromFiles(
    await readArtifactSetFiles(projectRoot),
  );
}

async function readArtifactSetFiles(projectRoot) {
  const paths = sortRelativePaths(await collectArtifactPaths(projectRoot));
  const files = new Map();
  for (const relativePath of paths) {
    const absolutePath = path.join(projectRoot, ...relativePath.split("/"));
    const before = await lstat(absolutePath);
    if (before.isSymbolicLink() || !before.isFile()) {
      throw new Error(
        `Artifact must be a regular non-symbolic file: ${relativePath}`,
      );
    }
    const handle = await open(
      absolutePath,
      fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
    );
    try {
      const opened = await handle.stat();
      const bytes = await handle.readFile();
      const after = await lstat(absolutePath);
      if (
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        after.dev !== before.dev ||
        after.ino !== before.ino ||
        after.isSymbolicLink() ||
        !after.isFile()
      ) {
        throw new Error(`Artifact changed while reading: ${relativePath}`);
      }
      files.set(relativePath, bytes);
    } finally {
      await handle.close();
    }
  }
  return files;
}

export function computeArtifactSetHashFromFiles(files) {
  const paths = sortRelativePaths(
    [...files.keys()].filter(isArtifactPath),
  );
  const records = [];
  for (const relativePath of paths) {
    const bytes = files.get(relativePath);
    const fileHash = sha256Bytes(canonicalArtifactBytes(relativePath, bytes));
    records.push(Buffer.from(`${relativePath}\0${fileHash}\n`, "utf8"));
  }
  return sha256Bytes(Buffer.concat(records));
}

function classifyFailure(result) {
  if (result.signal || result.spawnError) return 3;
  if (result.exitCode === 0) return 0;
  const diagnostic = result.stderr.toString("utf8");
  if (
    /\b(?:usage|unknown[- ]option|invalid[- ]json|schema|payload)\b/iu
      .test(diagnostic)
  ) {
    return 1;
  }
  return 3;
}

function assertRunInvocation({
  projectRoot,
  cliPath,
  profile,
  team,
  operations,
  catalogById,
  contextProbe,
}) {
  if (
    !path.isAbsolute(projectRoot ?? "") ||
    !path.isAbsolute(cliPath ?? "") ||
    typeof profile !== "string" ||
    !CONTEXT_PATTERN.test(profile) ||
    typeof team !== "string" ||
    !CONTEXT_PATTERN.test(team) ||
    !Array.isArray(operations) ||
    operations.length === 0 ||
    !(catalogById instanceof Map) ||
    !optionsContextProbeSafe(contextProbe)
  ) {
    throw new DryrunRunnerError(
      2,
      "B_ASSEMBLY_INVOCATION",
      "Assembly requires absolute project/CLI paths, profile, team, operations, and catalog.",
    );
  }
}

function optionsContextProbeSafe(contextProbe) {
  return Boolean(
    contextProbe &&
    contextProbe.operation_kind === "read" &&
    contextProbe.executor === "octopus-cli" &&
    Array.isArray(contextProbe.command_path),
  );
}

async function resolveCliBinary(cliPath) {
  const resolved = await realpath(cliPath);
  const before = await lstat(resolved);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    (before.mode & 0o111) === 0
  ) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_CLI_BINARY",
      "Resolved CLI binary must be a regular file.",
      { cli_path: cliPath, binary_realpath: resolved },
    );
  }
  const handle = await open(
    resolved,
    fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
  );
  let bytes;
  let opened;
  try {
    opened = await handle.stat();
    bytes = await handle.readFile();
    const after = await lstat(resolved);
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      !after.isFile() ||
      after.isSymbolicLink()
    ) {
      throw new Error("CLI binary changed during identity snapshot.");
    }
  } finally {
    await handle.close();
  }
  return {
    realpath: resolved,
    sha256: sha256Bytes(bytes),
    dev: opened.dev,
    ino: opened.ino,
  };
}

async function assertCliBinaryUnchanged(binary) {
  const current = await resolveCliBinary(binary.realpath);
  if (
    current.realpath !== binary.realpath ||
    current.dev !== binary.dev ||
    current.ino !== binary.ino ||
    current.sha256 !== binary.sha256
  ) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_CLI_REPLACED",
      "CLI binary identity or bytes changed during the validation run.",
      {
        binary_realpath: binary.realpath,
        expected_sha256: binary.sha256,
        actual_sha256: current.sha256,
      },
    );
  }
}

export async function snapshotCliBinaryIdentity(cliPath) {
  return resolveCliBinary(cliPath);
}

export async function assertCliBinaryIdentity(binary) {
  await assertCliBinaryUnchanged(binary);
}

async function findCliPackageRoot(binaryPath) {
  let directory = path.dirname(binaryPath);
  while (true) {
    const packagePath = path.join(directory, "package.json");
    try {
      const metadata = await lstat(packagePath);
      if (metadata.isSymbolicLink() || !metadata.isFile()) return null;
      const document = parseSafeJson(
        await readFile(packagePath, "utf8"),
        packagePath,
      );
      if (document.name === "@syngy/octopus-cli") return directory;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

async function hashSnapshotTree(root, relativeDirectory = "") {
  const directory = relativeDirectory
    ? path.join(root, ...relativeDirectory.split("/"))
    : root;
  const entries = await readdir(directory, { withFileTypes: true });
  const records = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"))) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    const absolutePath = path.join(directory, entry.name);
    const before = await lstat(absolutePath);
    if (before.isSymbolicLink()) {
      throw new Error(`Private CLI snapshot contains a symlink: ${relativePath}`);
    }
    if (before.isDirectory()) {
      records.push(Buffer.from(
        `d\0${relativePath}\0${before.mode & 0o777}\n`,
        "utf8",
      ));
      records.push(await hashSnapshotTree(root, relativePath));
      continue;
    }
    if (!before.isFile()) {
      throw new Error(
        `Private CLI snapshot contains a non-regular entry: ${relativePath}`,
      );
    }
    const handle = await open(
      absolutePath,
      fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
    );
    let bytes;
    try {
      const opened = await handle.stat();
      bytes = await handle.readFile();
      const after = await lstat(absolutePath);
      if (
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        after.dev !== before.dev ||
        after.ino !== before.ino ||
        after.isSymbolicLink() ||
        !after.isFile()
      ) {
        throw new Error(
          `Private CLI snapshot changed while hashing: ${relativePath}`,
        );
      }
    } finally {
      await handle.close();
    }
    records.push(Buffer.from(
      `f\0${relativePath}\0${before.mode & 0o777}\0${sha256Bytes(bytes)}\n`,
      "utf8",
    ));
  }
  return Buffer.from(sha256Bytes(Buffer.concat(records)), "utf8");
}

async function createCliExecutionSnapshot(binary) {
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), "fde-cli-exec-"));
  await chmod(snapshotRoot, 0o700);
  try {
    const packageRoot = await findCliPackageRoot(binary.realpath);
    let executionPath;
    if (packageRoot) {
      const bundleRoot = path.join(snapshotRoot, "bundle");
      await cp(packageRoot, bundleRoot, {
        recursive: true,
        dereference: true,
      });
      executionPath = path.join(
        bundleRoot,
        path.relative(packageRoot, binary.realpath),
      );
    } else {
      executionPath = path.join(snapshotRoot, "octopus-cli");
      await cp(binary.realpath, executionPath, {
        dereference: true,
        force: false,
        errorOnExist: true,
      });
    }
    await chmod(executionPath, 0o700);
    const snapshotBinary = await resolveCliBinary(executionPath);
    if (snapshotBinary.sha256 !== binary.sha256) {
      throw new DryrunRunnerError(
        3,
        "B_ASSEMBLY_CLI_REPLACED",
        "Private CLI snapshot does not match the inspected binary.",
      );
    }
    const rootIdentity = await lstat(snapshotRoot);
    const treeSha256 = (await hashSnapshotTree(snapshotRoot)).toString("utf8");
    return {
      root: snapshotRoot,
      rootIdentity: {
        dev: rootIdentity.dev,
        ino: rootIdentity.ino,
      },
      binary: snapshotBinary,
      treeSha256,
    };
  } catch (error) {
    await rm(snapshotRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function createProjectExecutionSnapshot(files, artifactSetSha256) {
  validateArtifactFileMap(files);
  const artifactFiles = new Map(
    [...files].filter(([relativePath, bytes]) =>
      isArtifactPath(relativePath) && Buffer.isBuffer(bytes)),
  );
  if (
    artifactFiles.size === 0 ||
    computeArtifactSetHashFromFiles(artifactFiles) !== artifactSetSha256
  ) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_ARTIFACT_BINDING",
      "Project execution snapshot does not match the prepared artifact set.",
    );
  }
  const containerRoot = await mkdtemp(
    path.join(os.tmpdir(), "fde-project-exec-"),
  );
  await chmod(containerRoot, 0o700);
  const snapshotRoot = path.join(containerRoot, "project");
  await mkdir(snapshotRoot, { mode: 0o700 });
  const directories = new Set([snapshotRoot]);
  try {
    for (const relativePath of sortRelativePaths([...artifactFiles.keys()])) {
      const target = resolveSnapshotPath(
        snapshotRoot,
        relativePath,
      );
      const parent = await ensureSnapshotDirectoryChain(
        snapshotRoot,
        relativePath,
      );
      let current = parent;
      while (isContainedSnapshotPath(snapshotRoot, current)) {
        directories.add(current);
        if (current === snapshotRoot) break;
        current = path.dirname(current);
      }
      const mode = relativePath === "assembly/octopus-cli-assemble.sh"
        ? 0o500
        : 0o400;
      const handle = await open(target, "wx", mode);
      try {
        await handle.writeFile(artifactFiles.get(relativePath));
        await handle.chmod(mode);
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    for (const directory of [...directories].sort(
      (left, right) => right.length - left.length,
    )) {
      await chmod(directory, 0o500);
    }
    const rootIdentity = await lstat(snapshotRoot);
    const containerIdentity = await lstat(containerRoot);
    const cleanupRootInventory = ownedMetadataRecord(
      "",
      "directory",
      containerIdentity,
    );
    return {
      root: snapshotRoot,
      rootIdentity: { dev: rootIdentity.dev, ino: rootIdentity.ino },
      cleanupRoot: containerRoot,
      cleanupRootInventory,
      treeSha256: (await hashSnapshotTree(snapshotRoot)).toString("utf8"),
      inventory: await snapshotOwnedInventory(
        containerRoot,
        directories,
        [...artifactFiles.keys()].map((relativePath) =>
          resolveSnapshotPath(snapshotRoot, relativePath)),
      ),
    };
  } catch (error) {
    // Construction has not exposed this unpredictable private 0700 container
    // to the CLI. Runtime cleanup below never uses recursive removal.
    await makeSnapshotTreeRemovable(snapshotRoot).catch(() => {});
    await rm(containerRoot, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function snapshotOwnedInventory(root, directories, files) {
  const entries = [];
  const ownedPaths = [
    ...[...directories]
      .map((directory) => ({
        relativePath: path.relative(root, directory)
          .split(path.sep).join("/"),
        kind: "directory",
      })),
    ...files.map((file) => ({
      relativePath: path.relative(root, file)
        .split(path.sep).join("/"),
      kind: "file",
    })),
  ];
  for (const entry of ownedPaths.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath, "en"))) {
    const target = resolveSnapshotPath(root, entry.relativePath);
    const metadata = await lstat(target);
    if (
      metadata.isSymbolicLink() ||
      (
        entry.kind === "directory"
          ? !metadata.isDirectory()
          : !metadata.isFile()
      )
    ) {
      throw new Error(
        `Owned snapshot inventory changed: ${entry.relativePath}`,
      );
    }
    const record = ownedMetadataRecord(
      entry.relativePath,
      entry.kind,
      metadata,
    );
    if (entry.kind === "file") {
      record.hash = await hashOwnedFile(target, record);
    }
    entries.push(record);
  }
  return entries;
}

function ownedMetadataHash(relativePath, type, mode) {
  return sha256Bytes(
    Buffer.from(`${relativePath}\0${type}\0${mode}\n`, "utf8"),
  );
}

function ownedMetadataRecord(relativePath, type, metadata) {
  const mode = metadata.mode & 0o777;
  return {
    relativePath,
    type,
    dev: metadata.dev,
    ino: metadata.ino,
    mode,
    hash: ownedMetadataHash(relativePath, type, mode),
  };
}

function metadataMatchesOwned(metadata, entry) {
  return (
    !metadata.isSymbolicLink() &&
    metadata.dev === entry.dev &&
    metadata.ino === entry.ino &&
    (metadata.mode & 0o777) === entry.mode &&
    entry.hash === (
      entry.type === "directory"
        ? ownedMetadataHash(
          entry.relativePath,
          "directory",
          entry.mode,
        )
        : entry.hash
    ) &&
    (
      entry.type === "directory"
        ? metadata.isDirectory()
        : metadata.isFile()
    )
  );
}

async function hashOwnedFile(target, entry, fs = { lstat, open }) {
  const handle = await fs.open(
    target,
    fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (!metadataMatchesOwned(opened, entry)) {
      throw new Error(`Owned snapshot file changed: ${entry.relativePath}`);
    }
    const bytes = await handle.readFile();
    const after = await fs.lstat(target);
    if (!metadataMatchesOwned(after, entry)) {
      throw new Error(`Owned snapshot file changed: ${entry.relativePath}`);
    }
    return sha256Bytes(bytes);
  } finally {
    await handle.close();
  }
}

function resolveSnapshotPath(root, relativePath) {
  const target = path.resolve(root, ...relativePath.split("/"));
  if (
    !isStrictSafeRelativePath(relativePath) ||
    target === root ||
    !isContainedSnapshotPath(root, target)
  ) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_ARTIFACT_PATH",
      "Artifact path escapes the private project snapshot.",
      { artifact_path: String(relativePath) },
    );
  }
  return target;
}

async function ensureSnapshotDirectoryChain(root, relativePath) {
  let current = root;
  for (const segment of relativePath.split("/").slice(0, -1)) {
    current = path.resolve(current, segment);
    if (!isContainedSnapshotPath(root, current)) {
      throw new DryrunRunnerError(
        3,
        "B_ASSEMBLY_ARTIFACT_PATH",
        "Artifact ancestor escapes the private project snapshot.",
        { artifact_path: relativePath },
      );
    }
    await mkdir(current, { mode: 0o700 }).catch((error) => {
      if (error?.code !== "EEXIST") throw error;
    });
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new DryrunRunnerError(
        3,
        "B_ASSEMBLY_ARTIFACT_PATH",
        "Artifact ancestor is not an owned non-symbolic directory.",
        { artifact_path: relativePath },
      );
    }
  }
  return current;
}

function isContainedSnapshotPath(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    )
  );
}

async function makeSnapshotTreeRemovable(root) {
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink()) return;
  if (!metadata.isDirectory()) {
    await chmod(root, 0o600);
    return;
  }
  await chmod(root, 0o700);
  for (const entry of await readdir(root)) {
    await makeSnapshotTreeRemovable(path.join(root, entry));
  }
}

async function assertProjectExecutionSnapshotUnchanged(snapshot) {
  const root = await lstat(snapshot.root);
  if (
    root.isSymbolicLink() ||
    !root.isDirectory() ||
    root.dev !== snapshot.rootIdentity.dev ||
    root.ino !== snapshot.rootIdentity.ino ||
    (await hashSnapshotTree(snapshot.root)).toString("utf8") !==
      snapshot.treeSha256
  ) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_ARTIFACT_REPLACED",
      "Private project execution snapshot changed during the run.",
    );
  }
}

function projectCleanupError(message, recoveryPath, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = "E_PROJECT_SNAPSHOT_CLEANUP";
  error.recoveryPaths = recoveryPath ? [recoveryPath] : [];
  error.cleanupWarning = {
    code: "W_PROJECT_SNAPSHOT_CLEANUP",
    message,
  };
  return error;
}

async function assertOwnedMetadataAt(fs, target, entry) {
  const metadata = await fs.lstat(target);
  if (!metadataMatchesOwned(metadata, entry)) {
    throw new Error(
      `Owned snapshot identity changed: ${entry.relativePath || "."}`,
    );
  }
  return metadata;
}

function parentRelativePath(relativePath) {
  const segments = relativePath.split("/");
  segments.pop();
  return segments.join("/");
}

async function assertCleanupChain(
  fs,
  quarantine,
  rootEntry,
  inventory,
  relativePath,
) {
  await assertOwnedMetadataAt(fs, quarantine, rootEntry);
  if (!relativePath) return;
  const segments = relativePath.split("/");
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    const entry = inventory.get(current);
    if (!entry) {
      throw new Error(`Owned snapshot inventory is missing: ${current}`);
    }
    await assertOwnedMetadataAt(
      fs,
      resolveSnapshotPath(quarantine, current),
      entry,
    );
  }
}

async function assertPathAbsent(fs, target) {
  try {
    await fs.lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Removed snapshot path reappeared: ${target}`);
}

async function ensureOwnedDirectoryWritable(
  fs,
  quarantine,
  rootEntry,
  inventory,
  relativePath,
) {
  const entry = relativePath ? inventory.get(relativePath) : rootEntry;
  if (!entry || entry.type !== "directory") {
    throw new Error(
      `Owned snapshot parent is missing: ${relativePath || "."}`,
    );
  }
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    relativePath,
  );
  if (entry.mode === 0o700) return;
  const target = relativePath
    ? resolveSnapshotPath(quarantine, relativePath)
    : quarantine;
  const handle = await fs.open(
    target,
    fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    if (!metadataMatchesOwned(opened, entry)) {
      throw new Error(
        `Owned snapshot parent changed: ${relativePath || "."}`,
      );
    }
    await assertOwnedMetadataAt(fs, target, entry);
    await handle.chmod(0o700);
    entry.mode = 0o700;
    entry.hash = ownedMetadataHash(
      entry.relativePath,
      "directory",
      entry.mode,
    );
    const changed = await handle.stat();
    if (!metadataMatchesOwned(changed, entry)) {
      throw new Error(
        `Owned snapshot parent chmod drifted: ${relativePath || "."}`,
      );
    }
  } finally {
    await handle.close();
  }
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    relativePath,
  );
}

async function truncateAndRemoveOwnedFile(
  fs,
  quarantine,
  rootEntry,
  inventory,
  entry,
) {
  const target = resolveSnapshotPath(quarantine, entry.relativePath);
  const parent = parentRelativePath(entry.relativePath);
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    entry.relativePath,
  );
  await ensureOwnedDirectoryWritable(
    fs,
    quarantine,
    rootEntry,
    inventory,
    parent,
  );
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    entry.relativePath,
  );

  const reader = await fs.open(
    target,
    fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await reader.stat();
    if (!metadataMatchesOwned(opened, entry)) {
      throw new Error(`Owned snapshot file changed: ${entry.relativePath}`);
    }
    const bytes = await reader.readFile();
    if (sha256Bytes(bytes) !== entry.hash) {
      throw new Error(
        `Owned snapshot file hash changed: ${entry.relativePath}`,
      );
    }
    await assertOwnedMetadataAt(fs, target, entry);
    await reader.chmod(0o600);
    entry.mode = 0o600;
    const changed = await reader.stat();
    if (!metadataMatchesOwned(changed, entry)) {
      throw new Error(
        `Owned snapshot file chmod drifted: ${entry.relativePath}`,
      );
    }
  } finally {
    await reader.close();
  }
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    entry.relativePath,
  );

  const writer = await fs.open(
    target,
    fileConstants.O_RDWR | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await writer.stat();
    if (!metadataMatchesOwned(opened, entry)) {
      throw new Error(`Owned snapshot file changed: ${entry.relativePath}`);
    }
    await assertOwnedMetadataAt(fs, target, entry);
    await writer.truncate(0);
    await writer.sync();
    entry.hash = sha256Bytes(Buffer.alloc(0));
    const truncated = await writer.stat();
    if (
      !metadataMatchesOwned(truncated, entry) ||
      truncated.size !== 0
    ) {
      throw new Error(
        `Owned snapshot file truncate drifted: ${entry.relativePath}`,
      );
    }
  } finally {
    await writer.close();
  }
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    entry.relativePath,
  );

  // The final lstat -> unlink gap is a cooperative last-syscall boundary.
  // It is accepted only inside this unpredictable, already-claimed private
  // 0700 container after root, ancestor, inode, mode, and hash verification.
  await fs.unlink(target);
  inventory.delete(entry.relativePath);
  await assertPathAbsent(fs, target);
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    parent,
  );
}

async function removeOwnedDirectory(
  fs,
  quarantine,
  rootEntry,
  inventory,
  entry,
) {
  const target = resolveSnapshotPath(quarantine, entry.relativePath);
  const parent = parentRelativePath(entry.relativePath);
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    entry.relativePath,
  );
  await ensureOwnedDirectoryWritable(
    fs,
    quarantine,
    rootEntry,
    inventory,
    parent,
  );
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    entry.relativePath,
  );

  // rmdir is deliberately conditional on emptiness. The same cooperative
  // last-syscall boundary applies; recursive deletion is never used here.
  await fs.rmdir(target);
  inventory.delete(entry.relativePath);
  await assertPathAbsent(fs, target);
  await assertCleanupChain(
    fs,
    quarantine,
    rootEntry,
    inventory,
    parent,
  );
}

async function removeProjectExecutionSnapshot(snapshot, fsOverrides = {}) {
  const fs = {
    lstat,
    open,
    rename,
    rmdir,
    unlink,
    ...fsOverrides,
  };
  const quarantine = `${snapshot.cleanupRoot}.cleanup-${randomUUID()}`;
  let claimed = false;
  try {
    await fs.rename(snapshot.cleanupRoot, quarantine);
    claimed = true;
    if (
      !Array.isArray(snapshot.inventory) ||
      !snapshot.cleanupRootInventory
    ) {
      throw new Error("Private project snapshot has no cleanup inventory.");
    }
    const rootEntry = { ...snapshot.cleanupRootInventory };
    const inventory = new Map(
      snapshot.inventory.map((entry) => [
        entry.relativePath,
        { ...entry },
      ]),
    );
    try {
      await assertCleanupChain(
        fs,
        quarantine,
        rootEntry,
        inventory,
        "",
      );
    } catch (cause) {
      throw projectCleanupError(
        "Foreign project snapshot replacement was preserved during cleanup.",
        quarantine,
        cause,
      );
    }
    for (const entry of inventory.values()) {
      await assertCleanupChain(
        fs,
        quarantine,
        rootEntry,
        inventory,
        entry.relativePath,
      );
      if (
        entry.type === "file" &&
        await hashOwnedFile(
          resolveSnapshotPath(quarantine, entry.relativePath),
          entry,
          fs,
        ) !== entry.hash
      ) {
        throw new Error(
          `Owned snapshot file hash changed: ${entry.relativePath}`,
        );
      }
    }

    const files = [...inventory.values()]
      .filter(({ type }) => type === "file")
      .sort((left, right) =>
        right.relativePath.split("/").length -
          left.relativePath.split("/").length ||
        left.relativePath.localeCompare(right.relativePath, "en"));
    for (const entry of files) {
      await truncateAndRemoveOwnedFile(
        fs,
        quarantine,
        rootEntry,
        inventory,
        entry,
      );
    }
    const directories = [...inventory.values()]
      .filter(({ type }) => type === "directory")
      .sort((left, right) =>
        right.relativePath.split("/").length -
          left.relativePath.split("/").length ||
        left.relativePath.localeCompare(right.relativePath, "en"));
    for (const entry of directories) {
      await removeOwnedDirectory(
        fs,
        quarantine,
        rootEntry,
        inventory,
        entry,
      );
    }
    await assertOwnedMetadataAt(fs, quarantine, rootEntry);
    // The final empty-root rmdir has the same cooperative last-syscall
    // boundary, scoped to the unpredictable claimed 0700 container name.
    await fs.rmdir(quarantine);
    await assertPathAbsent(fs, quarantine);
  } catch (cause) {
    if (cause?.recoveryPaths) throw cause;
    throw projectCleanupError(
      claimed
        ? "Private project snapshot cleanup stopped on an ownership mismatch."
        : "Private project snapshot could not be claimed for cleanup.",
      claimed ? quarantine : snapshot.cleanupRoot,
      cause,
    );
  }
}

async function assertCliExecutionSnapshotUnchanged(snapshot) {
  const root = await lstat(snapshot.root);
  if (
    root.isSymbolicLink() ||
    !root.isDirectory() ||
    root.dev !== snapshot.rootIdentity.dev ||
    root.ino !== snapshot.rootIdentity.ino
  ) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_CLI_REPLACED",
      "Private CLI snapshot root changed during the validation run.",
    );
  }
  await assertCliBinaryUnchanged(snapshot.binary);
  const treeSha256 = (await hashSnapshotTree(snapshot.root)).toString("utf8");
  if (treeSha256 !== snapshot.treeSha256) {
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_CLI_REPLACED",
      "Private CLI snapshot bundle changed during the validation run.",
    );
  }
}

async function removeCliExecutionSnapshot(snapshot) {
  const current = await lstat(snapshot.root);
  if (
    current.isSymbolicLink() ||
    !current.isDirectory() ||
    current.dev !== snapshot.rootIdentity.dev ||
    current.ino !== snapshot.rootIdentity.ino
  ) {
    throw new Error("Private CLI snapshot root changed before cleanup.");
  }
  const quarantine = `${snapshot.root}.cleanup-${randomUUID()}`;
  await rename(snapshot.root, quarantine);
  const claimed = await lstat(quarantine);
  if (
    claimed.isSymbolicLink() ||
    !claimed.isDirectory() ||
    claimed.dev !== snapshot.rootIdentity.dev ||
    claimed.ino !== snapshot.rootIdentity.ino
  ) {
    throw new Error("Private CLI snapshot changed while being claimed.");
  }
  const treeSha256 = (await hashSnapshotTree(quarantine)).toString("utf8");
  if (treeSha256 !== snapshot.treeSha256) {
    const error = new Error(
      "Private CLI snapshot bundle changed before cleanup.",
    );
    error.recoveryPaths = [quarantine];
    throw error;
  }
  await rm(quarantine, { recursive: true, force: false });
}

function contextValue(document, segments) {
  let current = document;
  for (const segment of segments) {
    if (
      !current ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !Object.hasOwn(current, segment)
    ) return undefined;
    current = current[segment];
  }
  return current;
}

function contextProbeArgv(contextProbe, profile, team) {
  if (
    !contextProbe ||
    contextProbe.operation_kind !== "read" ||
    contextProbe.executor !== "octopus-cli" ||
    !Array.isArray(contextProbe.command_path) ||
    contextProbe.options?.output !== "--json"
  ) {
    throw new DryrunRunnerError(
      2,
      "B_ASSEMBLY_CONTEXT_CONTRACT",
      "A versioned read-only CLI context probe contract is required.",
    );
  }
  const argv = [...contextProbe.command_path, contextProbe.options.output];
  const explicit = contextProbe.explicit_context_argv;
  if (explicit !== null) {
    if (
      explicit?.profile_flag !== "--profile" ||
      Object.keys(explicit).join(",") !== "profile_flag"
    ) {
      throw new DryrunRunnerError(
        2,
        "B_ASSEMBLY_CONTEXT_CONTRACT",
        "Explicit context argv is outside the versioned allowlist.",
      );
    }
    argv.push(explicit.profile_flag, profile);
  }
  return argv;
}

async function ensureEvidenceDirectory(absoluteDirectory) {
  const missing = [];
  let existing = absoluteDirectory;
  while (true) {
    try {
      const metadata = await lstat(existing);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw new Error(
          `Evidence ancestor is not a regular directory: ${existing}`,
        );
      }
      break;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  }
  let current = await realpath(existing);
  for (const segment of missing) {
    current = path.join(current, segment);
    await mkdir(current, { mode: 0o700 });
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Evidence ancestor is unsafe: ${current}`);
    }
  }
  return current;
}

export async function runDryrunValidation(options) {
  assertRunInvocation(options);
  const {
    projectRoot,
    operations,
    catalogById,
    contextProbe,
    cliPath,
    profile,
    team,
    cliVersions = {},
    expectedCliIdentity,
    artifactSetSha256: requestedArtifactSetSha256,
    artifactFiles: requestedArtifactFiles,
    execute = spawnCommand,
    runId = randomUUID(),
    clock = () => new Date(),
    projectSnapshotFs,
  } = options;
  if (
    !RUN_ID_PATTERN.test(runId) ||
    (
      requestedArtifactSetSha256 !== undefined &&
      !HASH_PATTERN.test(requestedArtifactSetSha256)
    )
  ) {
    throw new DryrunRunnerError(
      2,
      "B_ASSEMBLY_INVOCATION",
      "Assembly run ID or artifact binding is outside the safe grammar.",
    );
  }
  let binary;
  let artifactFiles;
  let artifactSetSha256;
  try {
    [binary, artifactFiles] = await Promise.all([
      resolveCliBinary(cliPath),
      requestedArtifactFiles instanceof Map
        ? validateArtifactFileMap(new Map(requestedArtifactFiles))
        : readArtifactSetFiles(projectRoot),
    ]);
    artifactSetSha256 = computeArtifactSetHashFromFiles(artifactFiles);
    if (
      requestedArtifactSetSha256 !== undefined &&
      artifactSetSha256 !== requestedArtifactSetSha256
    ) {
      throw new DryrunRunnerError(
        3,
        "B_ASSEMBLY_ARTIFACT_BINDING",
        "Prepared artifact bytes do not match the requested artifact hash.",
      );
    }
    if (
      expectedCliIdentity &&
      (
        binary.realpath !== expectedCliIdentity.realpath ||
        binary.dev !== expectedCliIdentity.dev ||
        binary.ino !== expectedCliIdentity.ino ||
        binary.sha256 !== expectedCliIdentity.sha256
      )
    ) {
      throw new DryrunRunnerError(
        3,
        "B_ASSEMBLY_CLI_REPLACED",
        "CLI identity differs from the binary inspected for this run.",
      );
    }
  } catch (error) {
    if (error instanceof DryrunRunnerError) throw error;
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_ENVIRONMENT",
      "Assembly environment could not be bound.",
      { error: error instanceof Error ? error.message : String(error) },
      error,
    );
  }
  let executionSnapshot;
  let projectExecutionSnapshot;
  try {
    executionSnapshot = await createCliExecutionSnapshot(binary);
    projectExecutionSnapshot = await createProjectExecutionSnapshot(
      artifactFiles,
      artifactSetSha256,
    );
  } catch (error) {
    if (executionSnapshot) {
      await removeCliExecutionSnapshot(executionSnapshot).catch(() => {});
    }
    if (error instanceof DryrunRunnerError) throw error;
    throw new DryrunRunnerError(
      3,
      "B_ASSEMBLY_ENVIRONMENT",
      "Private CLI execution snapshot could not be created.",
      { error: error instanceof Error ? error.message : String(error) },
      error,
    );
  }

  const startedAt = clock().toISOString();
  const argvById = operationArgvMap(operations, catalogById);
  const results = [];
  const diagnostics = [];
  const probeArgv = contextProbeArgv(contextProbe, profile, team);

  async function executeBound(argv) {
    try {
      await assertCliExecutionSnapshotUnchanged(executionSnapshot);
      await assertProjectExecutionSnapshotUnchanged(
        projectExecutionSnapshot,
      );
      const raw = await execute(executionSnapshot.binary.realpath, [...argv], {
        shell: false,
        cwd: projectExecutionSnapshot.root,
      });
      await assertCliExecutionSnapshotUnchanged(executionSnapshot);
      await assertProjectExecutionSnapshotUnchanged(
        projectExecutionSnapshot,
      );
      return raw;
    } catch (error) {
      return {
        exitCode: 3,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from(
          error instanceof Error ? error.message : String(error),
        ),
        spawnError: true,
      };
    }
  }

  async function verifyContext(phase, operationId) {
    const raw = await executeBound(probeArgv);
    const diagnostic = {
      operation_id: contextProbe.operation_id,
      phase,
      for_operation: operationId,
      raw_exit_code: raw.exitCode,
      signal: raw.signal ?? null,
      stderr: raw.stderr.toString("utf8"),
    };
    diagnostics.push(diagnostic);
    if (classifyFailure(raw) !== 0) return false;
    let observedContext;
    try {
      observedContext = parseSafeJson(
        raw.stdout.toString("utf8"),
        "octopus-cli context probe",
      );
    } catch (error) {
      diagnostic.stderr = error instanceof Error
        ? error.message
        : String(error);
      return false;
    }
    const observedProfile = contextValue(
      observedContext,
      contextProbe.output_contract.profile_path,
    );
    const observedTeam = contextValue(
      observedContext,
      contextProbe.output_contract.team_path,
    );
    if (observedProfile !== profile || observedTeam !== team) {
      diagnostic.stderr =
        "Requested Profile/Team does not match the CLI context probe.";
      return false;
    }
    return true;
  }

  try {
    for (const operation of operations) {
      const argv = argvById.get(operation.operation_id);
      if (!(await verifyContext("before", operation.operation_id))) {
        if (results.length === 0) {
          return { exitCode: 3, runId, evidence: null, diagnostics };
        }
        results.push({
          operation_id: operation.operation_id,
          status: "failed",
          mapped_exit_code: 3,
          argv_sha256: sha256Bytes(canonicalBytes(argv)),
        });
        break;
      }
      const raw = await executeBound(argv);
      diagnostics.push({
        operation_id: operation.operation_id,
        raw_exit_code: raw.exitCode,
        signal: raw.signal ?? null,
        stderr: raw.stderr.toString("utf8"),
      });
      const operationExitCode = classifyFailure(raw);
      const contextStable = await verifyContext(
        "after",
        operation.operation_id,
      );
      const mappedExitCode = contextStable ? operationExitCode : 3;
      results.push({
        operation_id: operation.operation_id,
        status: mappedExitCode === 0 ? "passed" : "failed",
        mapped_exit_code: mappedExitCode,
        argv_sha256: sha256Bytes(canonicalBytes(argv)),
      });
      if (!contextStable) break;
    }
    const endedAt = clock().toISOString();
    const exitCode = results.some(({ mapped_exit_code: code }) => code === 3)
      ? 3
      : results.some(({ mapped_exit_code: code }) => code === 1)
        ? 1
        : 0;
    return {
      exitCode,
      runId,
      evidence: {
        schema_version: 1,
        run_id: runId,
        profile,
        team,
        cli: {
          npm_package_version: cliVersions.npm_package ?? null,
          reported_version: cliVersions.cli_self_reported ?? null,
          binary_realpath: binary.realpath,
          binary_sha256: binary.sha256,
        },
        artifact_set_sha256: artifactSetSha256,
        started_at: startedAt,
        ended_at: endedAt,
        operations: results,
      },
      diagnostics,
    };
  } finally {
    let cleanupError;
    try {
      await removeProjectExecutionSnapshot(
        projectExecutionSnapshot,
        projectSnapshotFs,
      );
    } catch (error) {
      cleanupError = error;
    }
    try {
      await removeCliExecutionSnapshot(executionSnapshot);
    } catch (error) {
      cleanupError ??= error;
    }
    if (cleanupError) throw cleanupError;
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

export async function writeDryrunEvidenceAtomic(
  target,
  evidence,
  options = {},
) {
  const parent = await ensureEvidenceDirectory(path.dirname(target));
  const canonicalTarget = path.join(parent, path.basename(target));
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const temporary = path.join(parent, `.${path.basename(target)}.${nonce}.tmp`);
  const backup = path.join(parent, `.${path.basename(target)}.${nonce}.bak`);
  const fs = {
    lstat,
    link,
    mkdir,
    open,
    rename,
    rmdir,
    unlink,
    ...options.fs,
  };
  const bytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  const handle = await open(temporary, "wx", 0o600);
  let temporaryIdentity;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    temporaryIdentity = await handle.stat();
  } finally {
    await handle.close();
  }
  let prior = null;
  try {
    prior = await lstat(canonicalTarget);
    if (prior.isSymbolicLink() || !prior.isFile()) {
      throw new Error("Existing evidence target is not a regular file.");
    }
    await claimFileForReplacement(
      fs,
      canonicalTarget,
      backup,
      prior,
    );
  } catch (error) {
    if (error?.recoveryPaths) {
      error.recoveryPaths = [
        ...new Set([...error.recoveryPaths, temporary]),
      ];
    }
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await link(temporary, canonicalTarget);
    const published = await lstat(canonicalTarget);
    if (
      !sameIdentity(published, temporaryIdentity) ||
      published.isSymbolicLink() ||
      !published.isFile()
    ) {
      const error = new Error(
        "Published assembly evidence changed before commit verification.",
      );
      error.recoveryPaths = [
        temporary,
        ...(prior ? [backup] : []),
        canonicalTarget,
      ];
      throw error;
    }
  } catch (error) {
    if (prior) {
      try {
        await link(backup, canonicalTarget);
      } catch {
        error.recoveryPaths = [backup, temporary];
      }
    }
    throw error;
  }
  await removeIfOwned(
    fs,
    temporary,
    temporaryIdentity,
  );
  if (prior) await removeIfOwned(
    fs,
    backup,
    prior,
  );
}

function evidenceIssue(code, message, details = {}) {
  return issue(
    "BLOCKER",
    code,
    "reports/cli-assemble-evidence.json",
    message,
    { stage: "validate", ...details },
  );
}

export function validateDryrunEvidence(evidence, expected) {
  const issues = [];
  const exactKeys = (value, keys) =>
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort());
  const shape =
    exactKeys(evidence, [
      "schema_version",
      "run_id",
      "profile",
      "team",
      "cli",
      "artifact_set_sha256",
      "started_at",
      "ended_at",
      "operations",
    ]) &&
    evidence?.schema_version === 1 &&
    RUN_ID_PATTERN.test(evidence.run_id ?? "") &&
    CONTEXT_PATTERN.test(evidence.profile ?? "") &&
    CONTEXT_PATTERN.test(evidence.team ?? "") &&
    HASH_PATTERN.test(evidence.artifact_set_sha256 ?? "") &&
    typeof evidence.cli?.binary_realpath === "string" &&
    exactKeys(evidence.cli, [
      "npm_package_version",
      "reported_version",
      "binary_realpath",
      "binary_sha256",
    ]) &&
    typeof evidence.cli.npm_package_version === "string" &&
    typeof evidence.cli.reported_version === "string" &&
    path.isAbsolute(evidence.cli.binary_realpath) &&
    HASH_PATTERN.test(evidence.cli.binary_sha256 ?? "") &&
    typeof evidence.started_at === "string" &&
    typeof evidence.ended_at === "string" &&
    !Number.isNaN(Date.parse(evidence.started_at)) &&
    !Number.isNaN(Date.parse(evidence.ended_at)) &&
    Date.parse(evidence.started_at) <= Date.parse(evidence.ended_at) &&
    Array.isArray(evidence.operations);
  if (!shape) {
    issues.push(evidenceIssue(
      "B_ASSEMBLY_EVIDENCE_INVALID",
      "CLI assembly evidence structure is invalid.",
    ));
    return { valid: false, issues };
  }
  if (
    evidence.artifact_set_sha256 !== expected.artifactSetSha256 ||
    evidence.cli.binary_realpath !== expected.cliRealpath ||
    evidence.cli.binary_sha256 !== expected.cliSha256
  ) {
    issues.push(evidenceIssue(
      "B_ASSEMBLY_EVIDENCE_STALE",
      "CLI assembly evidence is not bound to the current artifacts and binary.",
    ));
  }
  const byId = new Map();
  for (const result of evidence.operations) {
    if (
      !exactKeys(result, [
        "operation_id",
        "status",
        "mapped_exit_code",
        "argv_sha256",
      ]) ||
      typeof result?.operation_id !== "string" ||
      byId.has(result.operation_id) ||
      !HASH_PATTERN.test(result.argv_sha256 ?? "")
    ) {
      issues.push(evidenceIssue(
        "B_ASSEMBLY_EVIDENCE_RESULTS",
        "CLI assembly evidence contains duplicate or invalid operation results.",
      ));
      continue;
    }
    byId.set(result.operation_id, result);
  }
  if (
    byId.size !== expected.expectedOperations.length ||
    expected.expectedOperations.some(({ operationId, argvSha256 }) => {
      const result = byId.get(operationId);
      return (
        result?.status !== "passed" ||
        result?.mapped_exit_code !== 0 ||
        result?.argv_sha256 !== argvSha256
      );
    })
  ) {
    issues.push(evidenceIssue(
      "B_ASSEMBLY_EVIDENCE_RESULTS",
      "Every supported write must have exactly one successful argv-bound result in the same run.",
    ));
  }
  return { valid: issues.length === 0, issues };
}

export function expectedDryrunOperations(operations, catalogById) {
  const argv = operationArgvMap(operations, catalogById);
  return operations.map((operation) => ({
    operationId: operation.operation_id,
    argvSha256: sha256Bytes(canonicalBytes(argv.get(operation.operation_id))),
  }));
}

export { buildOperationArgv };
