import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { constants as fileConstants } from "node:fs";
import path from "node:path";

import { parseSafeJson } from "../contracts/safe-data.js";
import { sha256Bytes, sortRelativePaths } from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";
import { runCliProbes } from "./cli-runner.js";
import {
  buildCommandIndex,
  commandPathSlug,
  evaluateOperationCatalog,
  loadOperationCatalog,
  OperationCatalogError,
} from "./operation-catalog.js";

const GENERATED_BY = "aiworker-fde-kit/inspect-octopus-cli";
const INSTALLATION_GUIDANCE =
  "Install an administrator-approved @syngy/octopus-cli version, verify its absolute binary path, then rerun this read-only inspector. This command never installs software.";

export class CliInspectionError extends Error {
  constructor(exitCode, code, message, data = {}, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "CliInspectionError";
    this.exitCode = exitCode;
    this.code = code;
    this.data = data;
  }
}

class FixtureEvidenceError extends Error {
  constructor(message, details = {}, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "FixtureEvidenceError";
    this.code = "E_CLI_FIXTURE_EVIDENCE";
    this.details = details;
  }
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function probeResult(stdout, stderr = Buffer.alloc(0), exitCode = 0) {
  return {
    exitCode,
    stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout),
    stderr: Buffer.isBuffer(stderr) ? stderr : Buffer.from(stderr),
  };
}

async function readFixtureRegularFile(absolutePath) {
  try {
    return (await readRegularSnapshot(absolutePath)).bytes;
  } catch (caught) {
    throw new FixtureEvidenceError(
      `Fixture entry must be a regular non-symbolic-link file: ${absolutePath}`,
      { path: absolutePath },
      caught,
    );
  }
}

async function readFixtureDirectory(absolutePath, label) {
  let metadata;
  try {
    metadata = await lstat(absolutePath);
  } catch (caught) {
    throw new FixtureEvidenceError(
      `${label} is missing or unreadable: ${absolutePath}`,
      { path: absolutePath },
      caught,
    );
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new FixtureEvidenceError(
      `${label} must be a non-symbolic-link directory: ${absolutePath}`,
      { path: absolutePath },
    );
  }
  return metadata;
}

function invalidFixtureContract(sourceName, cause) {
  return new FixtureEvidenceError(
    `${sourceName} has an invalid fixture result contract.`,
    { path: sourceName },
    cause,
  );
}

function parseFixtureVersion(bytes, sourceName) {
  let value;
  try {
    value = parseSafeJson(bytes.toString("utf8"), sourceName);
  } catch (caught) {
    throw invalidFixtureContract(sourceName, caught);
  }
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.stdout !== "string" ||
    typeof value.stderr !== "string" ||
    !Number.isInteger(value.exit_code)
  ) {
    throw invalidFixtureContract(sourceName);
  }
  return {
    rawFixture: bytes,
    ...probeResult(value.stdout, value.stderr, value.exit_code),
  };
}

async function acquireFixture(fixtureDir, catalog) {
  await readFixtureDirectory(fixtureDir, "Fixture directory");
  const npmPath = path.join(fixtureDir, "npm-package-version.json");
  const cliPath = path.join(fixtureDir, "cli-version.json");
  const helpPath = path.join(fixtureDir, "help-json.json");
  const npmBytes = await readFixtureRegularFile(npmPath);
  const cliBytes = await readFixtureRegularFile(cliPath);
  const helpBytes = await readFixtureRegularFile(helpPath);
  const acquired = {
    npmPackageVersion: {
      rawFixture: npmBytes,
      ...probeResult(npmBytes),
    },
    cliVersion: parseFixtureVersion(cliBytes, cliPath),
    helpJson: {
      rawFixture: helpBytes,
      ...probeResult(helpBytes),
    },
    leafHelp: [],
    bodyProbes: [],
  };
  try {
    const help = parseSafeJson(helpBytes.toString("utf8"), helpPath);
    const present = new Set(
      buildCommandIndex(help).commands.map(({ path_text: pathText }) => pathText),
    );
    const probeOperations = [
      ...catalog.supported,
      ...(catalog.context_probe ? [catalog.context_probe] : []),
    ];
    const presentOperations = probeOperations.filter((operation) =>
      present.has(operation.command_path.join(" ")));
    if (presentOperations.length === 0) return acquired;
    const leafRoot = path.resolve(fixtureDir, "leaf-help");
    await readFixtureDirectory(leafRoot, "Fixture leaf-help directory");
    for (const operation of presentOperations) {
      const leafPath = path.resolve(
        leafRoot,
        `${commandPathSlug(operation.command_path)}.txt`,
      );
      if (path.dirname(leafPath) !== leafRoot) {
        throw new OperationCatalogError(
          "Fixture leaf help path escaped its contained directory.",
          { command_path: operation.command_path },
        );
      }
      const leafBytes = await readFixtureRegularFile(leafPath);
      acquired.leafHelp.push({
        commandPath: [...operation.command_path],
        rawFixture: leafBytes,
        ...probeResult(leafBytes),
      });
    }
  } catch (error) {
    error.diagnostics = acquired;
    error.probe = error.code === "E_CLI_FIXTURE_EVIDENCE"
      ? "fixture-evidence"
      : "help-json";
    throw error;
  }
  return acquired;
}

function selectPresentCommandPaths(helpBytes, commandPaths) {
  const help = parseSafeJson(helpBytes.toString("utf8"), "octopus-cli --help-json");
  const present = new Set(
    buildCommandIndex(help).commands.map(({ path_text: pathText }) => pathText),
  );
  return commandPaths.filter((commandPath) =>
    present.has(commandPath.join(" ")),
  );
}

function extractNpmVersion(rawBytes) {
  const npm = parseSafeJson(
    rawBytes.toString("utf8"),
    "npm-package-version.json",
  );
  const dependency = npm?.dependencies?.["@syngy/octopus-cli"];
  const version = dependency?.version ?? npm?.version;
  if (typeof version !== "string" || version.length === 0) return null;
  return version;
}

function extractCliVersion(bytes) {
  const version = bytes.toString("utf8").trim();
  if (version.length === 0 || version.includes("\u0000")) return null;
  return version;
}

function rawBytes(result) {
  return result?.rawFixture ?? result?.stdout;
}

async function writeProbeDiagnostics(staging, acquired) {
  const rawRoot = path.join(staging, "diagnostics/raw");
  const stderrRoot = path.join(staging, "diagnostics/stderr");
  await mkdir(path.join(rawRoot, "leaf-help"), { recursive: true, mode: 0o700 });
  await mkdir(path.join(stderrRoot, "leaf-help"), {
    recursive: true,
    mode: 0o700,
  });
  const probes = [
    [
      acquired?.npmPackageVersion,
      "npm-package-version.json",
      "npm-package-version.txt",
    ],
    [acquired?.cliVersion, "cli-version.json", "cli-version.txt"],
    [acquired?.helpJson, "help-json.json", "help-json.txt"],
  ];
  for (const [result, rawName, stderrName] of probes) {
    if (!result) continue;
    const bytes = rawBytes(result);
    if (bytes) {
      await writeFile(path.join(rawRoot, rawName), bytes, {
        flag: "wx",
        mode: 0o600,
      });
    }
    await writeFile(path.join(stderrRoot, stderrName), result.stderr, {
      flag: "wx",
      mode: 0o600,
    });
  }
  for (const result of acquired?.leafHelp ?? []) {
    const slug = commandPathSlug(result.commandPath);
    await writeFile(
      path.join(rawRoot, "leaf-help", `${slug}.txt`),
      rawBytes(result),
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      path.join(stderrRoot, "leaf-help", `${slug}.txt`),
      result.stderr,
      { flag: "wx", mode: 0o600 },
    );
  }
  if ((acquired?.bodyProbes ?? []).length > 0) {
    await mkdir(path.join(rawRoot, "body-probes"), {
      recursive: true,
      mode: 0o700,
    });
    await mkdir(path.join(stderrRoot, "body-probes"), {
      recursive: true,
      mode: 0o700,
    });
  }
  for (const result of acquired?.bodyProbes ?? []) {
    const slug = commandPathSlug(result.commandPath);
    await writeFile(
      path.join(rawRoot, "body-probes", `${slug}.json`),
      rawBytes(result),
      { flag: "wx", mode: 0o600 },
    );
    await writeFile(
      path.join(stderrRoot, "body-probes", `${slug}.txt`),
      result.stderr,
      { flag: "wx", mode: 0o600 },
    );
  }
}

async function writeJsonFile(staging, relativePath, value) {
  const target = path.join(staging, relativePath);
  await writeFile(target, jsonBytes(value), { flag: "wx", mode: 0o644 });
}

async function readRegularSnapshot(absolutePath) {
  const initial = await lstat(absolutePath);
  if (initial.isSymbolicLink() || !initial.isFile()) {
    throw new Error(`Path is not a regular file: ${absolutePath}`);
  }
  const handle = await open(
    absolutePath,
    fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
  );
  try {
    const opened = await handle.stat();
    const bytes = await handle.readFile();
    const current = await lstat(absolutePath);
    if (
      opened.dev !== initial.dev ||
      opened.ino !== initial.ino ||
      current.dev !== initial.dev ||
      current.ino !== initial.ino ||
      current.isSymbolicLink() ||
      !current.isFile()
    ) {
      throw new Error(`Regular file changed during snapshot: ${absolutePath}`);
    }
    return { bytes, metadata: current };
  } finally {
    await handle.close();
  }
}

async function outputTreeEntries(root, relativeDirectory = "") {
  const directory = path.join(root, relativeDirectory);
  const entries = [];
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) =>
    Buffer.compare(Buffer.from(left.name, "utf8"), Buffer.from(right.name, "utf8")),
  );
  for (const child of children) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${child.name}`
      : child.name;
    if (relativePath === ".inspection-owner.json") continue;
    const absolutePath = path.join(root, relativePath);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error(`Inspection output contains a symbolic link: ${relativePath}`);
    }
    if (metadata.isDirectory()) {
      entries.push({
        path: relativePath,
        type: "directory",
        mode: metadata.mode & 0o777,
      });
      entries.push(...await outputTreeEntries(root, relativePath));
    } else if (metadata.isFile()) {
      const file = await readRegularSnapshot(absolutePath);
      entries.push({
        path: relativePath,
        type: "file",
        mode: file.metadata.mode & 0o777,
        sha256: sha256Bytes(file.bytes),
      });
    } else {
      throw new Error(`Inspection output contains an unsafe entry: ${relativePath}`);
    }
  }
  const orderedPaths = sortRelativePaths(entries.map(({ path: entryPath }) =>
    entryPath));
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  return orderedPaths.map((entryPath) => byPath.get(entryPath));
}

async function writeOwnershipManifest(staging) {
  await writeJsonFile(staging, ".inspection-owner.json", {
    schema_version: 1,
    generated_by: GENERATED_BY,
    entries: await outputTreeEntries(staging),
  });
}

function versionDocument(acquired) {
  const packageVersion = extractNpmVersion(
    acquired.npmPackageVersion.stdout,
  );
  const cliVersion = extractCliVersion(acquired.cliVersion.stdout);
  return {
    schema_version: 1,
    generated_by: GENERATED_BY,
    npm_package: {
      name: "@syngy/octopus-cli",
      version: packageVersion,
    },
    cli_self_reported: { version: cliVersion },
    versions_match:
      packageVersion !== null &&
      cliVersion !== null &&
      packageVersion === cliVersion,
  };
}

async function captureOwnedOutput(output) {
  let metadata;
  try {
    metadata = await lstat(output);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return false;
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) return false;
  try {
    const markerPath = path.join(output, ".inspection-owner.json");
    const markerMetadata = await lstat(markerPath);
    if (markerMetadata.isSymbolicLink() || !markerMetadata.isFile()) {
      return false;
    }
    const marker = await readRegularSnapshot(markerPath);
    const parsed = parseSafeJson(marker.bytes.toString("utf8"), markerPath);
    if (
      parsed.generated_by !== GENERATED_BY ||
      !Array.isArray(parsed.entries)
    ) {
      return false;
    }
    const currentEntries = await outputTreeEntries(output);
    if (JSON.stringify(currentEntries) !== JSON.stringify(parsed.entries)) {
      return false;
    }
    const confirmedRoot = await lstat(output);
    if (!sameIdentity(confirmedRoot, {
      dev: metadata.dev,
      ino: metadata.ino,
    })) {
      return false;
    }
    return {
      root: {
        dev: metadata.dev,
        ino: metadata.ino,
      },
      marker_sha256: sha256Bytes(marker.bytes),
      entries: currentEntries,
    };
  } catch {
    return false;
  }
}

async function isOwnedOutput(output) {
  const snapshot = await captureOwnedOutput(output);
  return snapshot && typeof snapshot === "object" ? true : snapshot;
}

function sameOwnedSnapshot(left, right) {
  return Boolean(
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object" &&
    left.root.dev === right.root.dev &&
    left.root.ino === right.root.ino &&
    left.marker_sha256 === right.marker_sha256 &&
    JSON.stringify(left.entries) === JSON.stringify(right.entries),
  );
}

function sameIdentity(metadata, identity) {
  return (
    metadata.dev === identity.dev &&
    metadata.ino === identity.ino &&
    metadata.isDirectory() &&
    !metadata.isSymbolicLink()
  );
}

function sameFileIdentity(metadata, identity) {
  return (
    metadata.dev === identity.dev &&
    metadata.ino === identity.ino &&
    metadata.isFile() &&
    !metadata.isSymbolicLink()
  );
}

async function isolateLockMarker({
  lockPath,
  lockHandle,
  lockIdentity,
  parent,
  output,
  transactionHooks,
}) {
  const recoveryPaths = [];
  const foreignPaths = [];
  try {
    await lockHandle.close();
  } catch {
    return {
      recoveryPaths: [lockPath],
      foreignPaths,
    };
  }
  try {
    await transactionHooks?.beforeLockCleanup?.({ lockPath, output });
  } catch {
    return {
      recoveryPaths: [lockPath],
      foreignPaths,
    };
  }
  let quarantineRoot;
  try {
    quarantineRoot = await mkdtemp(
      path.join(parent, `.${path.basename(output)}.lock-recovery-`),
    );
    const claimedMarker = path.join(quarantineRoot, "marker");
    await rename(lockPath, claimedMarker);
    recoveryPaths.push(claimedMarker);
    const claimed = await lstat(claimedMarker);
    if (!sameFileIdentity(claimed, lockIdentity)) {
      foreignPaths.push(claimedMarker);
    }
  } catch {
    recoveryPaths.push(...[
      ...(quarantineRoot ? [quarantineRoot] : []),
      lockPath,
    ]);
  }
  return { recoveryPaths, foreignPaths };
}

function appendTransactionRecovery(result, recovery) {
  if (recovery.recoveryPaths.length === 0) return result;
  const recoveryPaths = [
    ...new Set([
      ...(result.data?.recovery_paths ?? []),
      ...recovery.recoveryPaths,
    ]),
  ];
  const foreignPaths = [
    ...new Set([
      ...(result.data?.foreign_paths ?? []),
      ...recovery.foreignPaths,
    ]),
  ];
  const warning = issue(
    "WARNING",
    "W_TRANSACTION_RECOVERY_RETAINED",
    recovery.recoveryPaths[0],
    "The transaction marker was isolated and retained; no pathname-based deletion was attempted.",
    {
      recovery_paths: recovery.recoveryPaths,
      foreign_paths: recovery.foreignPaths,
    },
  );
  return {
    ...commandResult([...result.issues, warning], {
      ...result.data,
      recovery_paths: recoveryPaths,
      foreign_paths: foreignPaths,
    }),
    exitCode: result.exitCode,
  };
}

function outputChanged(message, data) {
  return new CliInspectionError(
    1,
    "B_OUTPUT_CHANGED",
    message,
    data,
  );
}

async function publishStaging(
  staging,
  output,
  owned,
  stagingSnapshot,
  transactionHooks = {},
) {
  const currentOwned = await captureOwnedOutput(output);
  const unchanged =
    owned === null
      ? currentOwned === null
      : sameOwnedSnapshot(currentOwned, owned);
  if (!unchanged) {
    throw new CliInspectionError(
      1,
      "B_OUTPUT_CHANGED",
      "Output changed while inspection evidence was being prepared.",
      { output, recovery_paths: [staging] },
    );
  }

  await transactionHooks.afterStagingValidated?.({ staging, output });
  const stagingClaim = `${staging}-publish-claim`;
  if (await captureOwnedOutput(stagingClaim) !== null) {
    throw outputChanged(
      "A foreign staging-claim path already exists.",
      {
        output,
        recovery_paths: [staging, stagingClaim],
        foreign_paths: [stagingClaim],
      },
    );
  }
  try {
    await rename(staging, stagingClaim);
  } catch (error) {
    throw outputChanged(
      "Staging could not be atomically isolated for publication.",
      {
        output,
        recovery_paths: [staging, stagingClaim],
        foreign_paths: error?.code === "ENOENT" ? [] : [stagingClaim],
      },
    );
  }
  const claimedStaging = await captureOwnedOutput(stagingClaim);
  if (!sameOwnedSnapshot(claimedStaging, stagingSnapshot)) {
    throw outputChanged(
      "The claimed staging directory was foreign or concurrently replaced.",
      {
        output,
        recovery_paths: [stagingClaim],
        foreign_paths: [stagingClaim],
      },
    );
  }

  let previousOutput;
  if (owned !== null) {
    await transactionHooks.beforeExistingClaim?.({
      output,
      staging: stagingClaim,
    });
    previousOutput = `${stagingClaim}-previous`;
    if (await captureOwnedOutput(previousOutput) !== null) {
      throw outputChanged(
        "A foreign backup-claim path already exists.",
        {
          output,
          recovery_paths: [stagingClaim, previousOutput],
          foreign_paths: [previousOutput],
        },
      );
    }
    try {
      await rename(output, previousOutput);
    } catch (error) {
      throw outputChanged(
        "Existing output disappeared or changed before it could be claimed.",
        {
          output,
          recovery_paths: [stagingClaim],
          foreign_paths: error?.code === "ENOENT" ? [] : [output],
        },
      );
    }
    const claimed = await captureOwnedOutput(previousOutput);
    if (!sameOwnedSnapshot(claimed, owned)) {
      throw outputChanged(
        "The claimed output was a foreign or concurrently replaced tree.",
        {
          output,
          recovery_paths: [stagingClaim, previousOutput],
          foreign_paths: [previousOutput],
        },
      );
    }
    await transactionHooks.afterExistingClaim?.({
      output,
      staging: stagingClaim,
      previousOutput,
    });
  }

  await transactionHooks.beforeOutputClaim?.({
    output,
    staging: stagingClaim,
    previousOutput,
  });
  await transactionHooks.beforeStagingPublish?.({
    output,
    staging: stagingClaim,
    previousOutput,
  });
  if (await captureOwnedOutput(output) !== null) {
    throw outputChanged(
      "A concurrent output appeared before the validated staging rename.",
      {
        output,
        recovery_paths: [
          stagingClaim,
          ...(previousOutput ? [previousOutput] : []),
        ],
        foreign_paths: [output],
      },
    );
  }

  const renameStaging =
    transactionHooks.renameStaging ??
    (async (source, destination) => rename(source, destination));
  try {
    await renameStaging(stagingClaim, output);
  } catch (error) {
    let rollbackError;
    if (
      previousOutput &&
      sameOwnedSnapshot(await captureOwnedOutput(previousOutput), owned) &&
      await captureOwnedOutput(output) === null
    ) {
      try {
        await rename(previousOutput, output);
        previousOutput = undefined;
      } catch (caught) {
        rollbackError = caught;
      }
    }
    throw new CliInspectionError(
      3,
      "B_OUTPUT_COMMIT_FAILED",
      "The validated staging directory could not be atomically published.",
      {
        output,
        recovery_paths: [
          stagingClaim,
          ...(previousOutput ? [previousOutput] : []),
        ],
        error: error instanceof Error ? error.message : String(error),
        rollback_error:
          rollbackError instanceof Error
            ? rollbackError.message
            : rollbackError
              ? String(rollbackError)
              : null,
      },
      error,
    );
  }
  const published = await captureOwnedOutput(output);
  if (!sameOwnedSnapshot(published, stagingSnapshot)) {
    throw outputChanged(
      "The live output changed during atomic publication.",
      {
        output,
        recovery_paths: [
          output,
          ...(previousOutput ? [previousOutput] : []),
        ],
        foreign_paths: [output],
      },
    );
  }
  return { cleanupPaths: previousOutput ? [previousOutput] : [] };
}

async function validateStaging(staging, expectIndex) {
  const versionPath = path.join(staging, "octopus-cli-version.json");
  const version = parseSafeJson(await readFile(versionPath, "utf8"), versionPath);
  if (version.generated_by !== GENERATED_BY) {
    throw new Error("Generated version evidence failed ownership validation.");
  }
  const helpPath = path.join(staging, "octopus-cli-help.json");
  parseSafeJson(await readFile(helpPath, "utf8"), helpPath);
  if (expectIndex) {
    const indexPath = path.join(staging, "cli-command-index.json");
    const index = parseSafeJson(await readFile(indexPath, "utf8"), indexPath);
    if (!Array.isArray(index.commands) || !Array.isArray(index.operations)) {
      throw new Error("Generated command index failed validation.");
    }
  }
  if (await isOwnedOutput(staging) !== true) {
    throw new Error("Generated ownership manifest failed validation.");
  }
}

function resultForFailure(error, output, diagnosticsOutput) {
  const cliProbe = error?.probe !== "npm-package-version";
  const fixtureEvidence = error?.code === "E_CLI_FIXTURE_EVIDENCE";
  const cliMissing = !fixtureEvidence && error?.code === "ENOENT" && cliProbe;
  const malformed = error?.code === "E_CLI_HELP_CONTRACT" ||
    error?.code?.startsWith("E_PARSE_JSON") ||
    error?.name === "SafeDataError";
  const code = fixtureEvidence
    ? "B_CLI_FIXTURE_EVIDENCE_INVALID"
    : cliMissing
      ? "B_CLI_MISSING"
      : malformed && error?.probe === "help-json"
        ? "B_CLI_HELP_MALFORMED"
        : "B_CLI_PROBE_FAILED";
  const message = fixtureEvidence
    ? "Required offline CLI fixture evidence is missing or invalid."
    : cliMissing
      ? "octopus-cli was not found at the requested path."
      : code === "B_CLI_HELP_MALFORMED"
        ? "octopus-cli --help-json returned malformed JSON or an invalid help contract."
        : "A read-only CLI probe failed.";
  return {
    ...commandResult([issue("BLOCKER", code, ".", message, {
      error: error instanceof Error ? error.message : String(error),
      probe: error?.probe ?? null,
    })], {
      output,
      diagnostics_output: diagnosticsOutput,
      ...(cliMissing
        ? { installation_guidance: INSTALLATION_GUIDANCE }
        : {}),
    }),
    exitCode: 3,
  };
}

async function publishFailureStaging(staging, output, owned) {
  if (owned === null) {
    const snapshot = await captureOwnedOutput(staging);
    await publishStaging(staging, output, null, snapshot);
    return output;
  }
  return staging;
}

async function preserveFailureDiagnostics({
  staging,
  output,
  owned,
  acquired,
  error,
}) {
  await writeProbeDiagnostics(staging, acquired);
  await writeJsonFile(staging, "inspection-failure.json", {
    schema_version: 1,
    generated_by: GENERATED_BY,
    failed_probe: error?.probe ?? null,
    command_index_committed: false,
  });
  await writeOwnershipManifest(staging);
  return publishFailureStaging(staging, output, owned);
}

export async function inspectOctopusCli({
  fixtureDir,
  cliPath = "octopus-cli",
  output,
  catalogPath,
  spawnCommand,
  dependencies,
  transactionHooks,
}) {
  const parent = path.dirname(output);
  const parentMetadata = await lstat(parent);
  if (parentMetadata.isSymbolicLink() || !parentMetadata.isDirectory()) {
    throw new CliInspectionError(
      3,
      "B_OUTPUT_PARENT_INVALID",
      "Output parent must be an existing non-symbolic-link directory.",
      { output },
    );
  }
  let owned;
  const lockPath = path.join(
    parent,
    `.${path.basename(output)}.inspect-octopus-cli.lock`,
  );
  let lockHandle;
  let lockIdentity;
  let lockFinalized = false;
  let staging;
  const finalizeLock = async () => {
    if (lockFinalized || !lockHandle || !lockIdentity) {
      return { recoveryPaths: [], foreignPaths: [] };
    }
    lockFinalized = true;
    const handle = lockHandle;
    lockHandle = null;
    return isolateLockMarker({
      lockPath,
      lockHandle: handle,
      lockIdentity,
      parent,
      output,
      transactionHooks,
    });
  };
  const finishResult = async (result) =>
    appendTransactionRecovery(result, await finalizeLock());
  const finishError = async (error) => {
    const recovery = await finalizeLock();
    error.data = {
      ...(error.data ?? {}),
      recovery_paths: [
        ...new Set([
          ...(error.data?.recovery_paths ?? []),
          ...recovery.recoveryPaths,
        ]),
      ],
      foreign_paths: [
        ...new Set([
          ...(error.data?.foreign_paths ?? []),
          ...recovery.foreignPaths,
        ]),
      ],
    };
    return error;
  };
  try {
    lockHandle = await open(lockPath, "wx", 0o600);
    lockIdentity = await lockHandle.stat();
    await lockHandle.writeFile(`${JSON.stringify({
      command: "inspect-octopus-cli",
      pid: process.pid,
    })}\n`);
    await lockHandle.sync();
    owned = await captureOwnedOutput(output);
    if (owned === false) {
      throw new CliInspectionError(
        1,
        "B_OUTPUT_NOT_OWNED",
        "Output exists, was modified, or is not owned by inspect-octopus-cli.",
        { output },
      );
    }
    staging = await mkdtemp(
      path.join(parent, `.${path.basename(output)}.inspect-staging-`),
    );

    let catalog;
    try {
      catalog = await loadOperationCatalog(catalogPath);
    } catch (error) {
      throw new CliInspectionError(
        3,
        "B_CLI_CATALOG_INVALID",
        "The assembly operation catalog is missing, malformed, or violates its contract.",
        {
          output,
          recovery_paths: staging ? [staging] : [],
          error: error instanceof Error ? error.message : String(error),
        },
        error,
      );
    }
    let acquired;
    try {
      acquired = fixtureDir
        ? await acquireFixture(fixtureDir, catalog)
        : await runCliProbes({
          cliPath,
          commandPaths: [
            ...catalog.supported,
            ...(catalog.context_probe ? [catalog.context_probe] : []),
          ].map(
            ({ command_path: commandPath }) => [...commandPath],
          ),
          bodyProbeCommandPaths: catalog.supported.map((operation) => ({
            commandPath: [...operation.command_path],
            positionalValues: (operation.positional_args ?? []).map((label, index) =>
              label.includes("digi-employee")
                ? `de_aiworker_fde_probe_${index + 1}`
                : `sk_aiworker_fde_probe_${index + 1}`),
          })),
          spawnCommand: dependencies?.globalCli ?? spawnCommand,
          selectCommandPaths: selectPresentCommandPaths,
        });
    } catch (error) {
      const partial = error?.diagnostics ?? {};
      const diagnosticsOutput = await preserveFailureDiagnostics({
        staging,
        output,
        owned,
        acquired: partial,
        error,
      });
      staging = null;
      return await finishResult(
        resultForFailure(error, output, diagnosticsOutput),
      );
    }

    await writeProbeDiagnostics(staging, acquired);
    let help;
    let index;
    try {
      help = parseSafeJson(
        acquired.helpJson.stdout.toString("utf8"),
        "octopus-cli --help-json",
      );
      index = buildCommandIndex(help);
    } catch (error) {
      error.probe = "help-json";
      await writeJsonFile(staging, "inspection-failure.json", {
        schema_version: 1,
        generated_by: GENERATED_BY,
        failed_probe: "help-json",
        command_index_committed: false,
      });
      await writeOwnershipManifest(staging);
      if (owned === null) {
        const retainedOrOutput = await publishFailureStaging(
          staging,
          output,
          owned,
        );
        staging = null;
        return await finishResult(
          resultForFailure(error, output, retainedOrOutput),
        );
      }
      const retained = staging;
      staging = null;
      return await finishResult(resultForFailure(error, output, retained));
    }

    const versions = versionDocument(acquired);
    await writeJsonFile(staging, "octopus-cli-version.json", versions);
    await writeJsonFile(staging, "octopus-cli-help.json", {
      schema_version: 1,
      generated_by: GENERATED_BY,
      evidence_scope: "command-path-presence-only",
      help,
    });
    const leafHelp = new Map(
      acquired.leafHelp.flatMap((result) => {
        const operation = catalog.supported.find(({ command_path: commandPath }) =>
          commandPath.join(" ") === result.commandPath.join(" "),
        );
        return operation
          ? [[operation.operation_id, result.stdout.toString("utf8")]]
          : [];
      }),
    );
    const bodyProbes = new Map(
      (acquired.bodyProbes ?? []).flatMap((result) => {
        const operation = catalog.supported.find(({ command_path: commandPath }) =>
          commandPath.join(" ") === result.commandPath.join(" "),
        );
        if (!operation) return [];
        let parsed;
        try {
          parsed = parseSafeJson(
            result.stdout.toString("utf8"),
            `body-probe/${commandPathSlug(result.commandPath)}.json`,
          );
        } catch {
          parsed = null;
        }
        return [[operation.operation_id, parsed]];
      }),
    );
    const evaluated = evaluateOperationCatalog(
      catalog,
      index,
      leafHelp,
      bodyProbes,
    );
    const result = commandResult(evaluated.issues, {
      output,
      fixture_mode: Boolean(fixtureDir),
      versions: {
        npm_package: versions.npm_package.version,
        cli_self_reported: versions.cli_self_reported.version,
      },
    });
    await writeJsonFile(staging, "cli-command-index.json", {
      schema_version: 1,
      generated_by: GENERATED_BY,
      evidence_scope: "command-path-presence-with-catalog-overlay",
      catalog_version: catalog.catalog_version,
      source_revision: catalog.source_revision,
      commands: index.commands,
      operations: evaluated.operations,
      issues: result.issues,
    });
    await writeOwnershipManifest(staging);
    await validateStaging(staging, true);
    const stagingSnapshot = await captureOwnedOutput(staging);
    if (!stagingSnapshot || typeof stagingSnapshot !== "object") {
      throw new Error("Validated staging snapshot could not be bound.");
    }
    const published = await publishStaging(
      staging,
      output,
      owned,
      stagingSnapshot,
      transactionHooks,
    );
    staging = null;
    if (published.cleanupPaths.length > 0) {
      const warning = issue(
        "WARNING",
        "W_OUTPUT_RECOVERY_RETAINED",
        published.cleanupPaths[0],
        "New evidence was committed; prior or staging evidence was retained to avoid unsafe recursive deletion.",
        { recovery_paths: published.cleanupPaths },
      );
      return await finishResult({
        ...commandResult([...result.issues, warning], {
          ...result.data,
          recovery_paths: published.cleanupPaths,
        }),
        exitCode: result.exitCode,
      });
    }
    return await finishResult(result);
  } catch (error) {
    if (error instanceof CliInspectionError) {
      if (error.data?.recovery_paths?.includes(staging)) staging = null;
      throw await finishError(error);
    }
    const wrapped = new CliInspectionError(
      3,
      error?.code === "EEXIST"
        ? "B_INSPECTION_LOCKED"
        : "B_CLI_EVIDENCE_WRITE",
      "CLI evidence transaction failed.",
      {
        output,
        recovery_paths: staging ? [staging] : [],
        error: error instanceof Error ? error.message : String(error),
      },
      error,
    );
    if (staging) staging = null;
    throw await finishError(wrapped);
  } finally {
    await lockHandle?.close().catch(() => {});
  }
}
