import { constants as fileConstants } from "node:fs";
import path from "node:path";

import { parseSafeYaml } from "../contracts/safe-data.js";
import {
  canonicalBytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import {
  CONFIRMATION_HASH,
  MANIFEST_NAME,
  SAFE_SLUG,
  STAGES,
  assertDirectory,
  blocker,
  createDependencies,
  errorText,
  isoTime,
  loadTemplateManifest,
  makeResult,
  pathExists,
  projectTransactionLockPath,
  readContainedRegularFileNoFollow,
  readRegularFileNoFollow,
  safeInventoryPath,
  serializeYaml,
  warning,
} from "./project-runtime.js";

class MigrationRollbackError extends Error {
  constructor(
    migrationError,
    rollbackError,
    backupPath,
    quarantinePaths = [],
  ) {
    super(
      `${errorText(migrationError)} Rollback failed: ${errorText(rollbackError)}`,
    );
    this.name = "MigrationRollbackError";
    this.backupPath = backupPath;
    this.quarantinePaths = quarantinePaths;
  }
}

class MigrationConflictError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MigrationConflictError";
    this.code = code;
  }
}

class MigrationQuarantineError extends Error {
  constructor(message, quarantinePath, cause) {
    super(cause ? `${message}: ${errorText(cause)}` : message);
    this.name = "MigrationQuarantineError";
    this.quarantinePath = quarantinePath;
  }
}

async function listImportInventory(projectPath, deps, relativeDirectory = "") {
  const directory = path.join(projectPath, relativeDirectory);
  const entries = await deps.fs.readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name, "en"),
  )) {
    if (
      relativeDirectory === "" &&
      (entry.name === MANIFEST_NAME ||
        entry.name.startsWith(`.${MANIFEST_NAME}.`))
    ) {
      continue;
    }
    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;
    if (entry.isDirectory()) {
      paths.push(
        ...(await listImportInventory(projectPath, deps, relativePath)),
      );
    } else {
      paths.push(relativePath);
    }
  }
  return sortRelativePaths(paths);
}

function importedSlug(basename, hashBytes) {
  if (SAFE_SLUG.test(basename)) return basename;
  return `imported-${hashBytes(Buffer.from(basename, "utf8")).slice(0, 8)}-fde`;
}

async function importProposal(projectPath, deps) {
  const inventory = await listImportInventory(projectPath, deps);
  const projectManifest = await loadTemplateManifest(deps);
  const basename = path.basename(projectPath).normalize("NFC");
  projectManifest.project = {
    ...projectManifest.project,
    name: basename,
    slug: importedSlug(basename, deps.hashBytes),
    customer_name: "待确认",
    primary_scenario: "待确认",
    entry_mode: "resume",
  };
  const proposal = { inventory, manifest: projectManifest };
  return {
    proposal,
    proposalHash: deps.hashBytes(canonicalBytes(proposal)),
  };
}

async function prepareImportQuarantine(projectPath, deps) {
  let quarantineDirectory;
  try {
    quarantineDirectory = await deps.fs.mkdtemp(
      path.join(
        path.dirname(projectPath),
        `.${path.basename(projectPath)}.${MANIFEST_NAME}.import-quarantine-`,
      ),
    );
    await assertDirectory(
      deps.fs,
      quarantineDirectory,
      "import recovery directory",
    );
    return {
      path: quarantineDirectory,
      identity: await deps.fs.lstat(quarantineDirectory),
    };
  } catch (error) {
    if (quarantineDirectory) {
      error.quarantinePaths = [quarantineDirectory];
    }
    throw error;
  }
}

async function publishExclusive(
  filePath,
  bytes,
  deps,
  validateAsProject = false,
) {
  let handle;
  let identity;
  let publicationCreated = false;
  let writeCompleted = false;
  let publicationError;
  try {
    handle = await deps.fs.open(
      filePath,
      fileConstants.O_WRONLY |
        fileConstants.O_CREAT |
        fileConstants.O_EXCL |
        fileConstants.O_NOFOLLOW,
      0o600,
    );
    publicationCreated = true;
    identity = await handle.stat();
    await handle.writeFile(bytes);
    writeCompleted = true;
    await handle.sync();
  } catch (error) {
    publicationError = error;
  }
  try {
    await handle?.close();
  } catch (error) {
    publicationError ??= error;
  }
  if (publicationError) {
    if (publicationCreated && !identity) {
      try {
        identity = await deps.fs.lstat(filePath);
      } catch {
        // The live path is reported by the caller when ownership is uncertain.
      }
    }
    publicationError.publicationCreated = publicationCreated;
    publicationError.publicationIdentity = identity;
    publicationError.publicationWriteCompleted = writeCompleted;
    throw publicationError;
  }
  try {
    const publishedIdentity = await deps.fs.lstat(filePath);
  const publishedBytes = await readRegularFileNoFollow(deps.fs, filePath);
  if (
    !sameIdentity(publishedIdentity, identity) ||
    !publishedBytes.equals(bytes)
  ) {
    const error = new Error(
      "Exclusive publication changed before verification completed.",
    );
    error.code = "E_PUBLICATION_CHANGED";
    error.publicationIdentity = identity;
    error.publicationWriteCompleted = true;
    throw error;
  }
  if (validateAsProject) {
    try {
      const publishedValue = parseSafeYaml(
        publishedBytes.toString("utf8"),
        MANIFEST_NAME,
      );
      const validation = await deps.validateProject(publishedValue);
      if (!validation.valid) {
        throw new Error(
          "Exclusive publication failed project schema validation.",
        );
      }
    } catch (error) {
      error.code ??= "E_PUBLICATION_SCHEMA";
      error.publicationIdentity = identity;
      error.publicationWriteCompleted = true;
      throw error;
    }
  }
  const finalIdentity = await deps.fs.lstat(filePath);
  const finalBytes = await readRegularFileNoFollow(deps.fs, filePath);
  if (
    !sameIdentity(finalIdentity, identity) ||
    !finalBytes.equals(bytes)
  ) {
    const error = new Error(
      "Exclusive publication changed during schema validation.",
    );
    error.code = "E_PUBLICATION_CHANGED";
    error.publicationCreated = true;
    error.publicationIdentity = identity;
    error.publicationWriteCompleted = true;
    throw error;
  }
    return identity;
  } catch (error) {
    error.publicationValidationFailed = true;
    error.publicationCreated ??= publicationCreated;
    error.publicationIdentity ??= identity;
    error.publicationWriteCompleted ??= writeCompleted;
    throw error;
  }
}

async function quarantineImportTemporary(
  quarantine,
  temporaryPath,
  temporaryIdentity,
  expectedBytes,
  deps,
) {
  const quarantineDirectory = quarantine.path;
  const quarantinePath = path.join(
    quarantineDirectory,
    path.basename(temporaryPath),
  );
  try {
    await deps.fs.rename(temporaryPath, quarantinePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      try {
        await assertOwnedPath(
          quarantineDirectory,
          quarantine.identity,
          "import recovery directory",
          deps,
        );
        await deps.fs.rmdir(quarantineDirectory);
      } catch (cleanupError) {
        return {
          owned: false,
          quarantinePaths: [quarantineDirectory],
          cleanupWarning: errorText(cleanupError),
        };
      }
      return { owned: false, quarantinePaths: [] };
    }
    error.quarantinePaths = [temporaryPath, quarantineDirectory];
    throw error;
  }
  try {
    const movedIdentity = await deps.fs.lstat(quarantinePath);
    const movedBytes = await readRegularFileNoFollow(
      deps.fs,
      quarantinePath,
    );
    const owned =
      sameIdentity(movedIdentity, temporaryIdentity) &&
      movedBytes.equals(expectedBytes);
    return {
      owned,
      quarantinePaths: [quarantinePath],
    };
  } catch (error) {
    error.quarantinePaths ??= [quarantinePath];
    throw error;
  }
}

async function recoverPartialPublication(
  quarantine,
  manifestPath,
  bytes,
  deps,
) {
  const recoveryPaths = [];
  let recoveryError;
  let recoveryPath;
  try {
    const recoverySlot = await deps.fs.mkdtemp(
      path.join(quarantine.path, "partial-publication-"),
    );
    recoveryPath = path.join(recoverySlot, MANIFEST_NAME);
    await publishExclusive(recoveryPath, bytes, deps);
    recoveryPaths.push(recoveryPath);
  } catch (error) {
    recoveryError = error;
    if (recoveryPath && await pathExists(deps.fs, recoveryPath)) {
      recoveryPaths.push(recoveryPath);
    }
  }
  return {
    recoveryError,
    quarantinePaths: recoveryPaths,
    liveRecoveryPaths: [manifestPath],
    retainTransactionLock: true,
  };
}

function transactionLockPath(projectPath) {
  return projectTransactionLockPath(projectPath);
}

async function withTransactionLock(projectPath, deps, operation) {
  // Cooperative atomicity: every kit resume/validator checks this external
  // lock before reading a manifest that may still be an O_EXCL partial.
  const lockPath = transactionLockPath(projectPath);
  try {
    await deps.fs.mkdir(lockPath, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") {
      error.code = "E_PROJECT_TRANSACTION_LOCKED";
      error.lockPath = lockPath;
    }
    throw error;
  }
  let identity;
  try {
    identity = await deps.fs.lstat(lockPath);
  } catch (error) {
    // mkdir succeeded, but cleanup is unsafe until this exact inode is known.
    error.lockPath = lockPath;
    error.retainTransactionLock = true;
    throw error;
  }
  let result;
  let operationError;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
  }
  if (operationError?.retainTransactionLock) {
    operationError.lockPath = lockPath;
    throw operationError;
  }
  try {
    await assertOwnedPath(lockPath, identity, "transaction lock", deps);
    await deps.fs.rmdir(lockPath);
  } catch (cleanupError) {
    if (operationError) {
      operationError.cleanupWarning = errorText(cleanupError);
      operationError.lockPath = lockPath;
      throw operationError;
    }
    return {
      ...result,
      cleanupWarning: errorText(cleanupError),
      lockPath,
      lockIdentity: identity,
    };
  }
  if (operationError) throw operationError;
  return result;
}

async function atomicCreateManifestUnlocked(projectPath, value, proposalHash, deps) {
  const manifestPath = path.join(projectPath, MANIFEST_NAME);
  const temporaryPath = path.join(
    projectPath,
    `.${MANIFEST_NAME}.import-${proposalHash}.tmp`,
  );
  let createdTemporary = false;
  let temporaryIdentity;
  const temporaryBytes = Buffer.from(serializeYaml(value), "utf8");
  const quarantine = await prepareImportQuarantine(
    projectPath,
    deps,
  );
  let publicationError;
  let committed = false;
  let committedIdentity;
  const quarantinePaths = [];
  const liveRecoveryPaths = [];
  let retainTransactionLock = false;
  try {
    await deps.fs.writeFile(temporaryPath, temporaryBytes, {
      flag: "wx",
    });
    createdTemporary = true;
    temporaryIdentity = await deps.fs.lstat(temporaryPath);
    const publishedIdentity = await publishExclusive(
      manifestPath,
      temporaryBytes,
      deps,
      true,
    );
    if (sameIdentity(publishedIdentity, temporaryIdentity)) {
      throw new Error("Import publication reused the temporary inode.");
    }
    committed = true;
    committedIdentity = publishedIdentity;
  } catch (error) {
    publicationError = error;
    if (error.publicationCreated) {
      liveRecoveryPaths.push(manifestPath);
      retainTransactionLock = true;
    }
    if (error.publicationIdentity) {
      try {
        const currentIdentity = await deps.fs.lstat(manifestPath);
        if (sameIdentity(currentIdentity, error.publicationIdentity)) {
          const currentBytes = await readRegularFileNoFollow(
            deps.fs,
            manifestPath,
          );
          if (
            error.code !== "E_PUBLICATION_SCHEMA" &&
            !error.publicationValidationFailed &&
            error.publicationWriteCompleted &&
            currentBytes.equals(temporaryBytes)
          ) {
            committed = true;
            committedIdentity = currentIdentity;
          } else if (error.code === "E_PUBLICATION_CHANGED") {
            retainTransactionLock = true;
          } else if (
            !error.publicationWriteCompleted ||
            error.code === "E_PUBLICATION_SCHEMA" ||
            error.publicationValidationFailed
          ) {
            retainTransactionLock = true;
            const recovery = await recoverPartialPublication(
              quarantine,
              manifestPath,
              currentBytes,
              deps,
            );
            quarantinePaths.push(...recovery.quarantinePaths);
            for (const recoveryPath of recovery.liveRecoveryPaths) {
              if (!liveRecoveryPaths.includes(recoveryPath)) {
                liveRecoveryPaths.push(recoveryPath);
              }
            }
            retainTransactionLock ||= recovery.retainTransactionLock;
            if (recovery.recoveryError) {
              publicationError = new Error(
                `${errorText(error)} Detached recovery failed: ${errorText(recovery.recoveryError)}`,
              );
            }
          }
        }
      } catch (recoveryError) {
        publicationError = new Error(
          `${errorText(error)} Import partial recovery failed: ${errorText(recoveryError)}`,
        );
        quarantinePaths.push(
          ...(recoveryError.quarantinePaths ?? []),
        );
      }
    }
  }

  let cleanup;
  try {
    if (createdTemporary) {
      cleanup = await quarantineImportTemporary(
          quarantine,
          temporaryPath,
          temporaryIdentity,
          temporaryBytes,
          deps,
        );
    } else {
      await assertOwnedPath(
        quarantine.path,
        quarantine.identity,
        "import recovery directory",
        deps,
      );
      await deps.fs.rmdir(quarantine.path);
      cleanup = { quarantinePaths: [], cleanupWarning: undefined };
    }
    quarantinePaths.push(...cleanup.quarantinePaths);
  } catch (cleanupError) {
    cleanup = {
      cleanupWarning: errorText(cleanupError),
      quarantinePaths: cleanupError.quarantinePaths ?? [temporaryPath],
    };
    quarantinePaths.push(...cleanup.quarantinePaths);
  }

  if (committed) {
    return {
      quarantinePaths,
      manifestIdentity: committedIdentity,
      cleanupWarning:
        cleanup.cleanupWarning ??
        (publicationError ? errorText(publicationError) : undefined),
    };
  }
  publicationError ??= new Error("Import publication did not commit.");
  publicationError.quarantinePaths = quarantinePaths;
  publicationError.liveRecoveryPaths = liveRecoveryPaths;
  publicationError.retainTransactionLock = retainTransactionLock;
  publicationError.cleanupWarning = cleanup.cleanupWarning;
  throw publicationError;
}

async function atomicCreateManifest(projectPath, value, proposalHash, deps) {
  return withTransactionLock(projectPath, deps, () =>
    atomicCreateManifestUnlocked(projectPath, value, proposalHash, deps),
  );
}

function exactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

async function migrationPreview(legacy, deps) {
  // The supported v0 shape is intentionally narrow: root {schema_version,
  // project, sources}, an empty sources array, and project fields
  // {name, slug, customer, scenario, entry_mode}. Customer/scenario are renamed
  // to the v1 identity fields; all other v1 sections use official defaults.
  const rootKeys = ["project", "schema_version", "sources"];
  const projectKeys = [
    "customer",
    "entry_mode",
    "name",
    "scenario",
    "slug",
  ];
  if (
    !exactKeys(legacy, rootKeys) ||
    !exactKeys(legacy.project, projectKeys) ||
    !Array.isArray(legacy.sources) ||
    legacy.sources.length !== 0 ||
    !["new", "materials", "resume"].includes(legacy.project.entry_mode) ||
    !SAFE_SLUG.test(legacy.project.slug) ||
    [legacy.project.name, legacy.project.customer, legacy.project.scenario].some(
      (value) => typeof value !== "string" || value.trim().length === 0,
    )
  ) {
    return null;
  }

  const migrated = await loadTemplateManifest(deps);
  migrated.project = {
    ...migrated.project,
    name: legacy.project.name,
    slug: legacy.project.slug,
    customer_name: legacy.project.customer,
    primary_scenario: legacy.project.scenario,
    entry_mode: legacy.project.entry_mode,
  };
  const preview = {
    from_schema_version: 0,
    manifest: migrated,
    migration: "v0-to-v1",
    to_schema_version: 1,
  };
  return {
    preview,
    previewHash: deps.hashBytes(canonicalBytes(preview)),
  };
}

async function ensureTransactionDirectory(directory, deps) {
  try {
    await deps.fs.mkdir(directory, { mode: 0o700 });
    return {
      path: directory,
      identity: await deps.fs.lstat(directory),
    };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const metadata = await deps.fs.lstat(directory);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(
        `Migration transaction path is not a safe directory: ${directory}`,
      );
    }
    return null;
  }
}

async function cleanupOwnedDirectories(
  backupDirectory,
  backupDirectoryIdentity,
  parentClaims,
  deps,
) {
  const claims = backupDirectoryIdentity
    ? [{ path: backupDirectory, identity: backupDirectoryIdentity }]
    : [];
  claims.push(...[...parentClaims].reverse());
  for (const claim of claims) {
    try {
      const current = await deps.fs.lstat(claim.path);
      if (
        current.dev !== claim.identity.dev ||
        current.ino !== claim.identity.ino
      ) {
        throw new Error(
          `Migration cleanup refused a replaced directory: ${claim.path}`,
        );
      }
      await deps.fs.rmdir(claim.path);
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error?.code)) throw error;
    }
  }
}

async function assertOwnedPath(filePath, identity, kind, deps) {
  const current = await deps.fs.lstat(filePath);
  if (
    !identity ||
    current.dev !== identity.dev ||
    current.ino !== identity.ino
  ) {
    throw new Error(
      `Migration ${kind} path was replaced: ${filePath}`,
    );
  }
  return current;
}

function sameIdentity(left, right) {
  return Boolean(
    left &&
    right &&
    left.dev === right.dev &&
    left.ino === right.ino,
  );
}

async function readManifestSnapshot(manifestPath, deps) {
  const before = await deps.fs.lstat(manifestPath);
  const bytes = await readRegularFileNoFollow(deps.fs, manifestPath);
  const after = await deps.fs.lstat(manifestPath);
  if (!sameIdentity(before, after)) {
    const error = new Error(
      "Manifest changed while its snapshot was being read.",
    );
    error.code = "E_MANIFEST_SNAPSHOT_CHANGED";
    throw error;
  }
  return { bytes, identity: after };
}

async function manifestSnapshotMatches(snapshot, manifestPath, deps) {
  let current;
  try {
    current = await readManifestSnapshot(manifestPath, deps);
  } catch (error) {
    if (
      ["ENOENT", "E_UNSAFE_FILE", "E_MANIFEST_SNAPSHOT_CHANGED"].includes(
        error?.code,
      )
    ) {
      return false;
    }
    throw error;
  }
  return (
    sameIdentity(snapshot.identity, current.identity) &&
    snapshot.bytes.equals(current.bytes)
  );
}

async function missingManifestSnapshotStable(projectPath, manifestPath, deps) {
  const lockPath = transactionLockPath(projectPath);
  return (
    !(await pathExists(deps.fs, lockPath)) &&
    !(await pathExists(deps.fs, manifestPath)) &&
    !(await pathExists(deps.fs, lockPath)) &&
    !(await pathExists(deps.fs, manifestPath))
  );
}

async function manifestSnapshotStable(
  snapshot,
  projectPath,
  manifestPath,
  deps,
) {
  const lockPath = transactionLockPath(projectPath);
  return (
    !(await pathExists(deps.fs, lockPath)) &&
    await manifestSnapshotMatches(snapshot, manifestPath, deps) &&
    !(await pathExists(deps.fs, lockPath))
  );
}

async function lockStateAllows(lockPath, allowedIdentity, deps) {
  try {
    const current = await deps.fs.lstat(lockPath);
    return sameIdentity(current, allowedIdentity);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

async function publishedManifestStable(
  expectedIdentity,
  expectedBytes,
  projectPath,
  manifestPath,
  allowedLockIdentity,
  deps,
) {
  const lockPath = transactionLockPath(projectPath);
  if (!(await lockStateAllows(lockPath, allowedLockIdentity, deps))) {
    return false;
  }
  let current;
  try {
    current = await readManifestSnapshot(manifestPath, deps);
  } catch (error) {
    if (
      ["ENOENT", "E_UNSAFE_FILE", "E_MANIFEST_SNAPSHOT_CHANGED"].includes(
        error?.code,
      )
    ) {
      return false;
    }
    throw error;
  }
  return (
    sameIdentity(current.identity, expectedIdentity) &&
    current.bytes.equals(expectedBytes) &&
    await lockStateAllows(lockPath, allowedLockIdentity, deps)
  );
}

async function confirmMigrationUnlocked(
  projectPath,
  originalBytes,
  migrated,
  previewHash,
  deps,
) {
  const timestamp = isoTime(deps.clock).replace(/:/gu, "-");
  const reportsRoot = path.join(projectPath, "reports");
  const backupsRoot = path.join(projectPath, "reports/backups");
  const backupDirectory = path.join(backupsRoot, timestamp);
  const manifestPath = path.join(projectPath, MANIFEST_NAME);
  const backupManifestPath = path.join(backupDirectory, MANIFEST_NAME);
  const temporaryPath = path.join(backupDirectory, ".migrated-manifest.tmp");
  const lockPath = path.join(projectPath, `.${MANIFEST_NAME}.migration.lock`);
  let backupCreated = false;
  let temporaryCreated = false;
  let lockCreated = false;
  let backupDirectoryIdentity;
  let backupManifestIdentity;
  let claimedSourceIdentity;
  let lockIdentity;
  let temporaryIdentity;
  let publishedIdentity;
  let publicationPartial = false;
  const parentClaims = [];
  const migratedBytes = Buffer.from(serializeYaml(migrated), "utf8");
  const lockBytes = Buffer.from(`${previewHash}\n`, "utf8");
  const originalHash = deps.hashBytes(originalBytes);
  const pendingQuarantines = new Map();
  const retainedQuarantinePaths = new Set();
  let quarantineCounter = 0;
  let quarantineDirectory;
  let quarantineDirectoryIdentity;

  async function ensureQuarantineDirectory() {
    if (quarantineDirectory) return quarantineDirectory;
    try {
      quarantineDirectory = await deps.fs.mkdtemp(
        path.join(
          path.dirname(projectPath),
          `.${path.basename(projectPath)}.${MANIFEST_NAME}.migration-quarantine-`,
        ),
      );
      await assertDirectory(
        deps.fs,
        quarantineDirectory,
        "migration recovery directory",
      );
      quarantineDirectoryIdentity = await deps.fs.lstat(
        quarantineDirectory,
      );
      return quarantineDirectory;
    } catch (error) {
      if (quarantineDirectory) {
        error.quarantinePaths = [quarantineDirectory];
      }
      throw error;
    }
  }

  async function moveToQuarantine(sourcePath, label) {
    const directory = await ensureQuarantineDirectory();
    quarantineCounter += 1;
    const quarantinePath = path.join(
      directory,
      `${String(quarantineCounter).padStart(2, "0")}-${label}`,
    );
    try {
      await deps.fs.rename(sourcePath, quarantinePath);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
    try {
      return {
        path: quarantinePath,
        identity: await deps.fs.lstat(quarantinePath),
        bytes: await readRegularFileNoFollow(deps.fs, quarantinePath),
      };
    } catch (error) {
      retainedQuarantinePaths.add(quarantinePath);
      throw new MigrationQuarantineError(
        "A quarantined migration path could not be verified",
        quarantinePath,
        error,
      );
    }
  }

  function recordMatches(record, expectedIdentity, expectedBytes) {
    return (
      sameIdentity(record.identity, expectedIdentity) &&
      record.bytes.equals(expectedBytes)
    );
  }

  async function restoreQuarantineRecord(record, destination) {
    let restored = false;
    try {
      await publishExclusive(destination, record.bytes, deps);
      restored = true;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        retainedQuarantinePaths.add(record.path);
        throw new MigrationQuarantineError(
          "A quarantined concurrent file could not be restored",
          record.path,
          error,
        );
      }
    }
    if (restored) {
      const restoredIdentity = await deps.fs.lstat(destination);
      const restoredBytes = await readRegularFileNoFollow(
        deps.fs,
        destination,
      );
      if (
        sameIdentity(restoredIdentity, record.identity) ||
        !restoredBytes.equals(record.bytes)
      ) {
        throw new MigrationQuarantineError(
          "A concurrent target appeared while a quarantined file was restored",
          record.path,
        );
      }
    }
    retainedQuarantinePaths.add(record.path);
    return restored;
  }

  async function cleanupQuarantineRecord(record) {
    let current;
    let currentBytes;
    try {
      current = await deps.fs.lstat(record.path);
      currentBytes = await readRegularFileNoFollow(deps.fs, record.path);
    } catch (error) {
      if (error?.code === "ENOENT") {
        pendingQuarantines.delete(record.path);
        return;
      }
      throw error;
    }
    if (
      !sameIdentity(current, record.identity) ||
      !currentBytes.equals(record.bytes)
    ) {
      pendingQuarantines.delete(record.path);
      retainedQuarantinePaths.add(record.path);
      throw new MigrationQuarantineError(
        "A quarantine entry changed before cleanup and was preserved",
        record.path,
      );
    }
    pendingQuarantines.delete(record.path);
    retainedQuarantinePaths.add(record.path);
  }

  async function cleanupPendingQuarantines() {
    let cleanupError;
    for (const record of [...pendingQuarantines.values()]) {
      try {
        await cleanupQuarantineRecord(record);
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (cleanupError) throw cleanupError;
  }

  async function cleanupQuarantineDirectory() {
    if (
      !quarantineDirectory ||
      pendingQuarantines.size > 0 ||
      retainedQuarantinePaths.size > 0
    ) {
      return;
    }
    try {
      await assertOwnedPath(
        quarantineDirectory,
        quarantineDirectoryIdentity,
        "quarantine directory",
        deps,
      );
      await deps.fs.rmdir(quarantineDirectory);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    quarantineDirectory = undefined;
    quarantineDirectoryIdentity = undefined;
  }

  async function quarantineOwnedLivePath(
    sourcePath,
    expectedIdentity,
    expectedBytes,
    label,
  ) {
    const record = await moveToQuarantine(sourcePath, label);
    if (!record) return { moved: false };
    if (!recordMatches(record, expectedIdentity, expectedBytes)) {
      await restoreQuarantineRecord(record, sourcePath);
      throw new MigrationQuarantineError(
        "A concurrent file replaced an attempt-owned migration path",
        record.path,
      );
    }
    pendingQuarantines.set(record.path, record);
    await cleanupQuarantineRecord(record);
    return { moved: true };
  }

  async function removeAttemptFiles() {
    let cleanupError;
    if (temporaryCreated) {
      try {
        await quarantineOwnedLivePath(
          temporaryPath,
          temporaryIdentity,
          migratedBytes,
          ".migrated-manifest.tmp",
        );
        temporaryCreated = false;
      } catch (error) {
        if (error instanceof MigrationQuarantineError) {
          temporaryCreated = false;
        }
        cleanupError = error;
      }
    }
    if (lockCreated) {
      try {
        await quarantineOwnedLivePath(
          lockPath,
          lockIdentity,
          lockBytes,
          "migration.lock",
        );
        lockCreated = false;
      } catch (error) {
        if (error instanceof MigrationQuarantineError) lockCreated = false;
        cleanupError ??= error;
      }
    }
    try {
      await cleanupPendingQuarantines();
    } catch (error) {
      cleanupError ??= error;
    }
    try {
      await cleanupQuarantineDirectory();
    } catch (error) {
      cleanupError ??= error;
    }
    if (cleanupError) throw cleanupError;
  }

  async function recoverClaim(allowChangedClaim) {
    if (!backupCreated) {
      await cleanupOwnedDirectories(
        backupDirectory,
        undefined,
        parentClaims,
        deps,
      );
      await removeAttemptFiles();
      return;
    }
    await assertOwnedPath(
      backupDirectory,
      backupDirectoryIdentity,
      "backup directory",
      deps,
    );
    if (!(await pathExists(deps.fs, backupManifestPath))) {
      await removeAttemptFiles();
      await cleanupOwnedDirectories(
        backupDirectory,
        backupDirectoryIdentity,
        parentClaims,
        deps,
      );
      backupCreated = false;
      backupDirectoryIdentity = undefined;
      return;
    }

    if (!backupManifestIdentity) {
      const possibleClaim = await deps.fs.lstat(backupManifestPath);
      backupManifestIdentity = possibleClaim;
    }
    let recoveryError;
    let foreignTargetPreserved = false;
    const targetRecord = await moveToQuarantine(
      manifestPath,
      "published-manifest.yaml",
    );
    if (targetRecord) {
      if (
        sameIdentity(targetRecord.identity, publishedIdentity) &&
        (publicationPartial || targetRecord.bytes.equals(migratedBytes))
      ) {
        pendingQuarantines.set(targetRecord.path, targetRecord);
        try {
          await cleanupQuarantineRecord(targetRecord);
        } catch (error) {
          recoveryError = error;
        }
      } else {
        await restoreQuarantineRecord(targetRecord, manifestPath);
        foreignTargetPreserved = true;
      }
    }

    if (foreignTargetPreserved) {
      const recoveryRecord = await moveToQuarantine(
        backupManifestPath,
        "claimed-v0-recovery.yaml",
      );
      if (!recoveryRecord) {
        recoveryError ??= new Error(
          "The claimed v0 recovery copy disappeared.",
        );
      } else if (
        recordMatches(
          recoveryRecord,
          backupManifestIdentity,
          originalBytes,
        )
      ) {
        retainedQuarantinePaths.add(recoveryRecord.path);
      } else {
        try {
          await restoreQuarantineRecord(
            recoveryRecord,
            backupManifestPath,
          );
        } catch (error) {
          recoveryError ??= error;
        }
        recoveryError ??= new MigrationQuarantineError(
          "The claimed v0 recovery copy changed and was preserved",
          recoveryRecord.path,
        );
      }
    } else {
      const backupRecord = await moveToQuarantine(
        backupManifestPath,
        "original-manifest.yaml",
      );
      if (!backupRecord) {
        throw new Error(
          "The claimed manifest disappeared during rollback.",
        );
      }
      if (
        !recordMatches(
          backupRecord,
          backupManifestIdentity,
          originalBytes,
        )
      ) {
        await restoreQuarantineRecord(backupRecord, manifestPath);
        foreignTargetPreserved = true;
        if (!allowChangedClaim) {
          recoveryError ??= new MigrationQuarantineError(
            "A source replacement moved during claim was preserved",
            backupRecord.path,
          );
        }
      } else {
        let restored = false;
        try {
          await publishExclusive(manifestPath, backupRecord.bytes, deps);
          restored = true;
        } catch (error) {
          if (error?.code !== "EEXIST") {
            retainedQuarantinePaths.add(backupRecord.path);
            throw error;
          }
        }
        if (!restored) {
          await restoreQuarantineRecord(
            backupRecord,
            backupManifestPath,
          );
          throw new MigrationQuarantineError(
            "A concurrent manifest appeared before rollback restoration",
            backupRecord.path,
          );
        }
        const restoredBytes = await readRegularFileNoFollow(
          deps.fs,
          manifestPath,
        );
        if (!restoredBytes.equals(backupRecord.bytes)) {
          retainedQuarantinePaths.add(backupRecord.path);
          throw new MigrationQuarantineError(
            "The restored manifest changed during rollback",
            backupRecord.path,
          );
        }
        pendingQuarantines.set(backupRecord.path, backupRecord);
        try {
          await cleanupQuarantineRecord(backupRecord);
        } catch (error) {
          recoveryError ??= error;
        }
      }
    }
    backupManifestIdentity = undefined;
    backupCreated = false;

    try {
      await removeAttemptFiles();
    } catch (error) {
      recoveryError ??= error;
    }
    await cleanupOwnedDirectories(
      backupDirectory,
      backupDirectoryIdentity,
      parentClaims,
      deps,
    );
    backupDirectoryIdentity = undefined;
    try {
      await cleanupQuarantineDirectory();
    } catch (error) {
      recoveryError ??= error;
    }
    if (recoveryError) throw recoveryError;
    return { foreignTargetPreserved };
  }

  await ensureQuarantineDirectory();

  try {
    try {
      await deps.fs.writeFile(lockPath, `${previewHash}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      lockCreated = true;
      lockIdentity = await deps.fs.lstat(lockPath);
    } catch (error) {
      if (error?.code === "EEXIST") {
        throw new MigrationConflictError(
          "B_MIGRATION_LOCKED",
          "Another migration operation already holds the project lock.",
        );
      }
      throw error;
    }

    const reportsClaim = await ensureTransactionDirectory(reportsRoot, deps);
    if (reportsClaim) parentClaims.push(reportsClaim);
    const backupsClaim = await ensureTransactionDirectory(backupsRoot, deps);
    if (backupsClaim) parentClaims.push(backupsClaim);
    await deps.fs.mkdir(backupDirectory, { mode: 0o700 });
    backupCreated = true;
    backupDirectoryIdentity = await deps.fs.lstat(backupDirectory);
    await deps.fs.writeFile(temporaryPath, migratedBytes, {
      flag: "wx",
    });
    temporaryCreated = true;
    temporaryIdentity = await deps.fs.lstat(temporaryPath);

    claimedSourceIdentity = await deps.fs.lstat(manifestPath);
    try {
      await deps.rename(manifestPath, backupManifestPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new MigrationConflictError(
          "B_MIGRATION_SOURCE_CHANGED",
          "The manifest changed before it could be claimed for migration.",
        );
      }
      throw error;
    }
    backupManifestIdentity = await deps.fs.lstat(backupManifestPath);
    if (
      backupManifestIdentity.dev !== claimedSourceIdentity.dev ||
      backupManifestIdentity.ino !== claimedSourceIdentity.ino
    ) {
      throw new MigrationConflictError(
        "B_MIGRATION_SOURCE_CHANGED",
        "The manifest changed while it was being claimed for migration.",
      );
    }

    const claimedBytes = await readRegularFileNoFollow(
      deps.fs,
      backupManifestPath,
    );
    if (
      !claimedBytes.equals(originalBytes) ||
      deps.hashBytes(claimedBytes) !== originalHash
    ) {
      throw new MigrationConflictError(
        "B_MIGRATION_SOURCE_CHANGED",
        "The manifest changed after preview and was not migrated.",
      );
    }

    try {
      publishedIdentity = await publishExclusive(
        manifestPath,
        migratedBytes,
        deps,
        true,
      );
      if (sameIdentity(publishedIdentity, temporaryIdentity)) {
        throw new Error("Migration publication reused the temporary inode.");
      }
    } catch (error) {
      publishedIdentity = error.publicationIdentity;
      publicationPartial = Boolean(
        publishedIdentity && !error.publicationWriteCompleted,
      );
      if (error?.code === "EEXIST") {
        throw new MigrationConflictError(
          "B_MIGRATION_TARGET_RACE",
          "A concurrent manifest appeared before migration publication.",
        );
      }
      if (error.publicationCreated) {
        error.liveRecoveryPaths = [manifestPath];
        error.retainTransactionLock = true;
        error.backupPath = backupDirectory;
        error.skipRollback = true;
        try {
          const liveBytes = await readRegularFileNoFollow(
            deps.fs,
            manifestPath,
          );
          const recovery = await recoverPartialPublication(
            { path: quarantineDirectory },
            manifestPath,
            liveBytes,
            deps,
          );
          error.quarantinePaths = recovery.quarantinePaths;
        } catch (recoveryError) {
          error.quarantinePaths = recoveryError.quarantinePaths ?? [];
        }
        try {
          await removeAttemptFiles();
        } catch (cleanupError) {
          error.cleanupWarning = errorText(cleanupError);
        }
        throw error;
      }
      if (error?.code === "E_PUBLICATION_CHANGED") {
        throw new MigrationConflictError(
          "B_MIGRATION_TARGET_RACE",
          "The published manifest was changed concurrently.",
        );
      }
      throw error;
    }

    await removeAttemptFiles();
    return {
      backupDirectory,
      manifestIdentity: publishedIdentity,
      quarantinePaths: [...retainedQuarantinePaths],
    };
  } catch (error) {
    if (error.skipRollback) throw error;
    let recovery;
    try {
      recovery = await recoverClaim(
        error instanceof MigrationConflictError &&
        error.code === "B_MIGRATION_SOURCE_CHANGED",
      );
    } catch (rollbackError) {
      try {
        await removeAttemptFiles();
      } catch {
        // The retained backup is the recovery artifact when cleanup also fails.
      }
      throw new MigrationRollbackError(
        error,
        rollbackError,
        backupDirectory,
        [
          ...retainedQuarantinePaths,
          ...pendingQuarantines.keys(),
        ],
      );
    }
    const quarantinePaths = [
      ...retainedQuarantinePaths,
      ...pendingQuarantines.keys(),
    ];
    if (error instanceof MigrationConflictError) {
      error.quarantinePaths = quarantinePaths;
      throw error;
    }
    if (
      error instanceof MigrationQuarantineError ||
      recovery?.foreignTargetPreserved
    ) {
      throw new MigrationRollbackError(
        error,
        error,
        backupDirectory,
        quarantinePaths,
      );
    }
    error.quarantinePaths = quarantinePaths;
    error.backupPath = backupDirectory;
    throw error;
  }
}

async function confirmMigration(
  projectPath,
  originalBytes,
  migrated,
  previewHash,
  deps,
) {
  return withTransactionLock(projectPath, deps, () =>
    confirmMigrationUnlocked(
      projectPath,
      originalBytes,
      migrated,
      previewHash,
      deps,
    ),
  );
}

function sortPaths(paths) {
  return [...paths].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
}

async function inspectReferenceSources(projectManifest, deps) {
  const changed = [];
  const missing = [];
  for (const source of projectManifest.sources) {
    if (source.source_mode !== "reference") continue;
    try {
      const bytes = await readRegularFileNoFollow(
        deps.fs,
        source.original_path,
      );
      if (deps.hashBytes(bytes) !== source.sha256) {
        changed.push(source.original_path);
      }
    } catch (error) {
      if (error?.code === "ENOENT") {
        missing.push(source.original_path);
      } else if (error?.code === "E_UNSAFE_FILE") {
        changed.push(source.original_path);
      } else {
        throw error;
      }
    }
  }
  return { changed, missing };
}

async function inspectStageHashes(projectPath, projectManifest, deps) {
  const changed = new Set();
  const missing = new Set();
  const affectedStages = new Set();

  for (const stage of STAGES) {
    const record = projectManifest.stage_status[stage];
    const hashes = { ...record.input_hashes, ...record.output_hashes };
    for (const [relativePath, expected] of Object.entries(hashes)) {
      if (!safeInventoryPath(relativePath)) {
        changed.add(relativePath);
        affectedStages.add(stage);
        continue;
      }
      const absolutePath = path.join(projectPath, ...relativePath.split("/"));
      try {
        const actual = deps.hashBytes(
          await readContainedRegularFileNoFollow(
            deps.fs,
            projectPath,
            relativePath,
          ),
        );
        if (actual !== expected) {
          changed.add(relativePath);
          affectedStages.add(stage);
        }
      } catch (error) {
        if (error?.code === "ENOENT") {
          missing.add(relativePath);
        } else if (error?.code === "E_UNSAFE_FILE") {
          changed.add(relativePath);
        } else {
          throw error;
        }
        affectedStages.add(stage);
      }
    }
  }

  const references = await inspectReferenceSources(projectManifest, deps);
  if (references.changed.length > 0 || references.missing.length > 0) {
    affectedStages.add("initialize");
  }
  const closest =
    STAGES.find((stage) => affectedStages.has(stage)) ??
    STAGES.find(
      (stage) => projectManifest.stage_status[stage].status !== "complete",
    ) ??
    "validate";
  return {
    changedPaths: sortPaths([...changed, ...references.changed]),
    missingPaths: sortPaths([...missing, ...references.missing]),
    closest,
  };
}

function validateResumeOptions(options) {
  if (typeof options.project !== "string" || !path.isAbsolute(options.project)) {
    return "project must be an absolute path.";
  }
  if (
    options.confirmImport !== undefined &&
    !CONFIRMATION_HASH.test(options.confirmImport)
  ) {
    return "confirmImport must be a lowercase 64-character SHA-256 value.";
  }
  if (
    options.confirmMigration !== undefined &&
    !CONFIRMATION_HASH.test(options.confirmMigration)
  ) {
    return "confirmMigration must be a lowercase 64-character SHA-256 value.";
  }
  if (
    options.confirmImport !== undefined &&
    options.confirmMigration !== undefined
  ) {
    return "Import and migration confirmations are mutually exclusive.";
  }
  return null;
}

export async function resumeProject(options, dependencyOverrides = {}) {
  const deps = createDependencies(dependencyOverrides);
  const invocationError = validateResumeOptions(options);
  if (invocationError) {
    return makeResult(2, [
      blocker("B_ARGUMENT_INVALID", ".", invocationError),
    ]);
  }
  const projectPath = path.resolve(options.project);
  const manifestPath = path.join(projectPath, MANIFEST_NAME);

  if (await pathExists(deps.fs, transactionLockPath(projectPath))) {
    return makeResult(1, [
      blocker(
        "B_PROJECT_TRANSACTION_LOCKED",
        projectPath,
        "Another project transaction is publishing; retry after it completes.",
      ),
    ], { project_path: projectPath });
  }

  try {
    await assertDirectory(deps.fs, projectPath, "project", {
      writable: false,
    });
  } catch (error) {
    return makeResult(3, [
      blocker("B_PROJECT_UNAVAILABLE", projectPath, "Project directory is unavailable.", {
        error: errorText(error),
      }),
    ]);
  }

  if (!(await pathExists(deps.fs, manifestPath))) {
    if (options.confirmMigration !== undefined) {
      return makeResult(1, [
        blocker(
          "B_MIGRATION_NOT_APPLICABLE",
          MANIFEST_NAME,
          "A migration confirmation requires a legacy manifest.",
        ),
      ]);
    }
    try {
      const { proposal, proposalHash } = await importProposal(projectPath, deps);
      if (
        !(await missingManifestSnapshotStable(
          projectPath,
          manifestPath,
          deps,
        ))
      ) {
        return makeResult(1, [
          blocker(
            "B_PROJECT_TRANSACTION_LOCKED",
            projectPath,
            "A project transaction started during inspection; the snapshot was discarded.",
          ),
        ], { project_path: projectPath });
      }
      const data = {
        project_path: projectPath,
        inventory: proposal.inventory,
        proposal,
        proposal_sha256: proposalHash,
        requires_confirmation: options.confirmImport === undefined,
      };
      if (options.confirmImport === undefined) return makeResult(0, [], data);
      if (options.confirmImport !== proposalHash) {
        return makeResult(1, [
          blocker(
            "B_IMPORT_PROPOSAL_MISMATCH",
            MANIFEST_NAME,
            "Import proposal changed or the supplied confirmation hash is stale.",
          ),
        ], data);
      }
      const validation = await deps.validateProject(proposal.manifest);
      if (!validation.valid) {
        return makeResult(1, [
          blocker(
            "B_PROJECT_SCHEMA_INVALID",
            MANIFEST_NAME,
            "Import proposal failed the official project schema.",
            { errors: validation.errors },
          ),
        ], data);
      }
      await assertDirectory(deps.fs, projectPath, "project");
      const importCleanup = await atomicCreateManifest(
        projectPath,
        proposal.manifest,
        proposalHash,
        deps,
      );
      if (
        !(await publishedManifestStable(
          importCleanup.manifestIdentity,
          Buffer.from(serializeYaml(proposal.manifest), "utf8"),
          projectPath,
          manifestPath,
          importCleanup.lockIdentity,
          deps,
        ))
      ) {
        return makeResult(1, [
          blocker(
            "B_PROJECT_TRANSACTION_LOCKED",
            projectPath,
            "The imported manifest changed before completion; retry with a fresh snapshot.",
          ),
        ], { project_path: projectPath });
      }
      const cleanupIssues = importCleanup.cleanupWarning
        ? [
            warning(
              "W_IMPORT_CLEANUP_DEFERRED",
              projectPath,
              "Import succeeded, but temporary recovery artifacts were retained.",
              {
                error: importCleanup.cleanupWarning,
                quarantine_paths: importCleanup.quarantinePaths,
                lock_path: importCleanup.lockPath,
              },
            ),
          ]
        : [];
      return makeResult(0, cleanupIssues, {
        ...data,
        requires_confirmation: false,
        imported: true,
        quarantine_paths: importCleanup.quarantinePaths,
        ...(importCleanup.lockPath
          ? { lock_path: importCleanup.lockPath }
          : {}),
      });
    } catch (error) {
      const quarantinePaths = error.quarantinePaths ?? [];
      const liveRecoveryPaths = error.liveRecoveryPaths ?? [];
      const cleanupIssues = error.cleanupWarning
        ? [
            warning(
              "W_IMPORT_CLEANUP_DEFERRED",
              projectPath,
              "Import cleanup was deferred; recovery artifacts were retained.",
              {
                error: error.cleanupWarning,
                quarantine_paths: quarantinePaths,
                lock_path: error.lockPath,
              },
            ),
          ]
        : [];
      if (error?.code === "E_PROJECT_TRANSACTION_LOCKED") {
        return makeResult(1, [
          blocker(
            "B_PROJECT_TRANSACTION_LOCKED",
            projectPath,
            "Another project transaction is publishing; retry after it completes.",
            { lock_path: error.lockPath },
          ),
        ], {
          project_path: projectPath,
          lock_path: error.lockPath,
        });
      }
      if (error?.code === "EEXIST") {
        return makeResult(1, [
          blocker(
            "B_IMPORT_TARGET_EXISTS",
            MANIFEST_NAME,
            "Manifest appeared before import confirmation completed.",
            { quarantine_paths: quarantinePaths },
          ),
          ...cleanupIssues,
        ], {
          project_path: projectPath,
          quarantine_paths: quarantinePaths,
          live_recovery_paths: liveRecoveryPaths,
          ...(error.lockPath ? { lock_path: error.lockPath } : {}),
        });
      }
      return makeResult(3, [
        blocker("B_IMPORT_RUNTIME", projectPath, "Project import failed.", {
          error: errorText(error),
          quarantine_paths: quarantinePaths,
          live_recovery_paths: liveRecoveryPaths,
          lock_path: error.lockPath,
        }),
        ...cleanupIssues,
      ], {
        project_path: projectPath,
        quarantine_paths: quarantinePaths,
        live_recovery_paths: liveRecoveryPaths,
        ...(error.lockPath ? { lock_path: error.lockPath } : {}),
      });
    }
  }

  if (options.confirmImport !== undefined) {
    return makeResult(1, [
      blocker(
        "B_IMPORT_NOT_APPLICABLE",
        MANIFEST_NAME,
        "Import confirmation is only valid when the manifest is missing.",
      ),
    ]);
  }

  let originalSnapshot;
  try {
    originalSnapshot = await readManifestSnapshot(manifestPath, deps);
  } catch (error) {
    if (
      ["ENOENT", "E_MANIFEST_SNAPSHOT_CHANGED"].includes(error?.code)
    ) {
      return makeResult(1, [
        blocker(
          "B_PROJECT_TRANSACTION_LOCKED",
          projectPath,
          "The project changed during inspection; retry with a fresh snapshot.",
        ),
      ], { project_path: projectPath });
    }
    if (error?.code !== "E_UNSAFE_FILE") {
      return makeResult(3, [
        blocker(
          "B_MANIFEST_UNREADABLE",
          MANIFEST_NAME,
          "Manifest could not be read from the project filesystem.",
          { error: errorText(error) },
        ),
      ]);
    }
    return makeResult(1, [
      blocker(
        "B_MANIFEST_CORRUPT",
        MANIFEST_NAME,
        "Manifest is corrupt or cannot be parsed safely.",
        { error: errorText(error) },
      ),
    ]);
  }
  const originalBytes = originalSnapshot.bytes;
  if (await pathExists(deps.fs, transactionLockPath(projectPath))) {
    return makeResult(1, [
      blocker(
        "B_PROJECT_TRANSACTION_LOCKED",
        projectPath,
        "A project transaction started during inspection; the snapshot was discarded.",
      ),
    ], { project_path: projectPath });
  }
  let projectManifest;
  let parseError;
  try {
    projectManifest = parseSafeYaml(
      originalBytes.toString("utf8"),
      MANIFEST_NAME,
    );
  } catch (error) {
    parseError = error;
  }
  if (await pathExists(deps.fs, transactionLockPath(projectPath))) {
    return makeResult(1, [
      blocker(
        "B_PROJECT_TRANSACTION_LOCKED",
        projectPath,
        "A project transaction started during parsing; the snapshot was discarded.",
      ),
    ], { project_path: projectPath });
  }
  let snapshotMatches;
  try {
    snapshotMatches = await manifestSnapshotMatches(
      originalSnapshot,
      manifestPath,
      deps,
    );
  } catch (error) {
    return makeResult(3, [
      blocker(
        "B_MANIFEST_UNREADABLE",
        MANIFEST_NAME,
        "Manifest could not be re-read from the project filesystem.",
        { error: errorText(error) },
      ),
    ]);
  }
  if (
    !snapshotMatches ||
    await pathExists(deps.fs, transactionLockPath(projectPath))
  ) {
    return makeResult(1, [
      blocker(
        "B_PROJECT_TRANSACTION_LOCKED",
        projectPath,
        "The project changed during inspection; retry with a fresh snapshot.",
      ),
    ], { project_path: projectPath });
  }
  if (parseError) {
    return makeResult(1, [
      blocker(
        "B_MANIFEST_CORRUPT",
        MANIFEST_NAME,
        "Manifest is corrupt or cannot be parsed safely.",
        { error: errorText(parseError) },
      ),
    ]);
  }

  if (
    !Number.isInteger(projectManifest.schema_version) ||
    projectManifest.schema_version < 0
  ) {
    return makeResult(1, [
      blocker(
        "B_MANIFEST_CORRUPT",
        MANIFEST_NAME,
        "Manifest schema_version must be a non-negative integer.",
      ),
    ]);
  }
  if (projectManifest.schema_version > 1) {
    return makeResult(1, [
      blocker(
        "B_SCHEMA_VERSION_UNSUPPORTED",
        MANIFEST_NAME,
        "Manifest schema_version is newer than this CLI supports.",
        { schema_version: projectManifest.schema_version },
      ),
    ]);
  }

  if (projectManifest.schema_version === 0) {
    let migration;
    try {
      migration = await migrationPreview(projectManifest, deps);
    } catch (error) {
      return makeResult(3, [
        blocker("B_MIGRATION_RUNTIME", MANIFEST_NAME, "Migration preview failed.", {
          error: errorText(error),
        }),
      ]);
    }
    if (!migration) {
      return makeResult(1, [
        blocker(
          "B_MIGRATION_AMBIGUOUS",
          MANIFEST_NAME,
          "Legacy manifest contains unsupported or ambiguous v0 fields.",
        ),
      ]);
    }
    const validation = await deps.validateProject(migration.preview.manifest);
    if (!validation.valid) {
      return makeResult(1, [
        blocker(
          "B_PROJECT_SCHEMA_INVALID",
          MANIFEST_NAME,
          "Migration preview failed the official project schema.",
          { errors: validation.errors },
        ),
      ]);
    }
    const data = {
      project_path: projectPath,
      migration: "v0-to-v1",
      preview: migration.preview,
      preview_sha256: migration.previewHash,
      requires_confirmation: options.confirmMigration === undefined,
    };
    if (
      !(await manifestSnapshotStable(
        originalSnapshot,
        projectPath,
        manifestPath,
        deps,
      ))
    ) {
      return makeResult(1, [
        blocker(
          "B_PROJECT_TRANSACTION_LOCKED",
          projectPath,
          "The project changed during migration preview; retry with a fresh snapshot.",
        ),
      ], { project_path: projectPath });
    }
    if (options.confirmMigration === undefined) return makeResult(0, [], data);
    if (options.confirmMigration !== migration.previewHash) {
      return makeResult(1, [
        blocker(
          "B_MIGRATION_PREVIEW_MISMATCH",
          MANIFEST_NAME,
          "Migration preview changed or the supplied confirmation hash is stale.",
        ),
      ], data);
    }
    try {
      await assertDirectory(deps.fs, projectPath, "project");
      const migrationResult = await confirmMigration(
        projectPath,
        originalBytes,
        migration.preview.manifest,
        migration.previewHash,
        deps,
      );
      if (
        !(await publishedManifestStable(
          migrationResult.manifestIdentity,
          Buffer.from(serializeYaml(migration.preview.manifest), "utf8"),
          projectPath,
          manifestPath,
          migrationResult.lockIdentity,
          deps,
        ))
      ) {
        return makeResult(1, [
          blocker(
            "B_PROJECT_TRANSACTION_LOCKED",
            projectPath,
            "The migrated manifest changed before completion; retry with a fresh snapshot.",
          ),
        ], { project_path: projectPath });
      }
      const cleanupIssues = migrationResult.cleanupWarning
        ? [
            warning(
              "W_MIGRATION_CLEANUP_DEFERRED",
              projectPath,
              "Migration committed, but transaction lock cleanup was deferred.",
              {
                error: migrationResult.cleanupWarning,
                lock_path: migrationResult.lockPath,
              },
            ),
          ]
        : [];
      return makeResult(0, cleanupIssues, {
        ...data,
        requires_confirmation: false,
        migrated: true,
        backup_path: migrationResult.backupDirectory,
        quarantine_paths: migrationResult.quarantinePaths,
        ...(migrationResult.lockPath
          ? { lock_path: migrationResult.lockPath }
          : {}),
      });
    } catch (error) {
      if (error?.code === "E_PROJECT_TRANSACTION_LOCKED") {
        return makeResult(1, [
          blocker(
            "B_PROJECT_TRANSACTION_LOCKED",
            projectPath,
            "Another project transaction is publishing; retry after it completes.",
            { lock_path: error.lockPath },
          ),
        ], { ...data, lock_path: error.lockPath });
      }
      if (error instanceof MigrationConflictError) {
        const conflictData =
          error.quarantinePaths?.length > 0
            ? {
                ...data,
                quarantine_paths: error.quarantinePaths,
              }
            : data;
        return makeResult(1, [
          blocker(
            error.code,
            MANIFEST_NAME,
            error.message,
            error.quarantinePaths?.length > 0
              ? { quarantine_paths: error.quarantinePaths }
              : {},
          ),
        ], conflictData);
      }
      if (error instanceof MigrationRollbackError) {
        return makeResult(3, [
          blocker(
            "B_MIGRATION_ROLLBACK_FAILED",
            MANIFEST_NAME,
            "Migration failed and preservation is uncertain; recovery artifacts were retained.",
            {
              error: errorText(error),
              backup_path: error.backupPath,
              quarantine_paths: error.quarantinePaths,
              live_recovery_paths: error.liveRecoveryPaths ?? [],
              lock_path: error.lockPath,
            },
          ),
        ], {
          ...data,
          backup_path: error.backupPath,
          quarantine_paths: error.quarantinePaths,
          live_recovery_paths: error.liveRecoveryPaths ?? [],
          ...(error.lockPath ? { lock_path: error.lockPath } : {}),
        });
      }
      return makeResult(3, [
        blocker(
          "B_MIGRATION_RUNTIME",
          MANIFEST_NAME,
          "Migration failed; the original manifest was preserved.",
          {
            error: errorText(error),
            backup_path: error.backupPath,
            quarantine_paths: error.quarantinePaths ?? [],
            live_recovery_paths: error.liveRecoveryPaths ?? [],
            lock_path: error.lockPath,
          },
        ),
      ], {
        ...data,
        backup_path: error.backupPath,
        quarantine_paths: error.quarantinePaths ?? [],
        live_recovery_paths: error.liveRecoveryPaths ?? [],
        ...(error.lockPath ? { lock_path: error.lockPath } : {}),
      });
    }
  }

  if (options.confirmMigration !== undefined) {
    return makeResult(1, [
      blocker(
        "B_MIGRATION_NOT_APPLICABLE",
        MANIFEST_NAME,
        "Migration confirmation is only valid for schema_version 0.",
      ),
    ]);
  }

  try {
    const validation = await deps.validateProject(projectManifest);
    if (!validation.valid) {
      return makeResult(1, [
        blocker(
          "B_PROJECT_SCHEMA_INVALID",
          MANIFEST_NAME,
          "Manifest failed the official project schema.",
          { errors: validation.errors },
        ),
      ]);
    }
    const inspection = await inspectStageHashes(
      projectPath,
      projectManifest,
      deps,
    );
    const issues = [
      ...inspection.changedPaths.map((relativePath) =>
        warning(
          "W_USER_MODIFICATION",
          relativePath,
          "Recorded content hash differs from the current user file.",
        ),
      ),
      ...inspection.missingPaths.map((relativePath) =>
        warning(
          "W_RECORDED_PATH_MISSING",
          relativePath,
          "A path recorded in stage hashes is missing.",
        ),
      ),
    ];
    if (
      !(await manifestSnapshotStable(
        originalSnapshot,
        projectPath,
        manifestPath,
        deps,
      ))
    ) {
      return makeResult(1, [
        blocker(
          "B_PROJECT_TRANSACTION_LOCKED",
          projectPath,
          "The project changed during resume inspection; retry with a fresh snapshot.",
        ),
      ], { project_path: projectPath });
    }
    return makeResult(0, issues, {
      project_path: projectPath,
      closest_resumable_stage: inspection.closest,
      changed_paths: inspection.changedPaths,
      missing_paths: inspection.missingPaths,
      manifest_valid: true,
    });
  } catch (error) {
    return makeResult(3, [
      blocker("B_RESUME_RUNTIME", projectPath, "Project resume inspection failed.", {
        error: errorText(error),
      }),
    ]);
  }
}
