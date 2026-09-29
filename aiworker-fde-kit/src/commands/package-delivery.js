import { randomUUID } from "node:crypto";
import {
  chmod,
  copyFile,
  lstat,
  link,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

import { stringify } from "yaml";

import { renderDryrunScript } from "../assembly/dryrun-renderer.js";
import { inspectRenderedDryrunScript } from "../assembly/shell-safety.js";
import { validateProjectDirectory } from "../contracts/project-validator.js";
import { parseSafeJson, parseSafeYaml } from "../contracts/safe-data.js";
import {
  createPackageManifest,
  verifyPackageManifest,
} from "../delivery/package-manifest.js";
import { selectDeliveryFiles } from "../delivery/file-selection.js";
import {
  projectSanitizedProjection,
  scanSensitiveFiles,
} from "../delivery/sensitive-scan.js";
import {
  validateDeliveryFileScanability,
  validateSourceScanability,
} from "../delivery/source-scan-policy.js";
import { isPassingPackageReport } from "../delivery/package-report.js";
import {
  readAndVerifyZip,
  writeDeterministicZip,
} from "../delivery/zip-writer.js";
import { prepareStageAcceptance } from "../project/stage-state.js";
import {
  assertValidationSnapshot,
} from "../project/validation-report.js";
import {
  canonicalBytes,
  normalizeMarkdown,
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";
import {
  resolveAuthoritativeKitCommit,
} from "../shared/kit-commit.js";
import {
  cleanupClaimedOwnedPath,
} from "../shared/owned-tree-cleanup.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const USAGE =
  "Usage: package-delivery <absolute-project-dir> " +
  "[--include-sources --confirm-source-risk] " +
  "[--confirm-personal-data] [--output <absolute-zip>]";
const CORE_EXACT = new Set([
  "fde-project.yaml",
  "assembly/operations.yaml",
  "assembly/octopus-cli-assemble.sh",
  "delivery-summary.md",
]);
const CORE_PREFIXES = [
  "discovery/",
  "design/",
  "employees/",
  "skills/",
  "arcubase/",
  "assembly/payloads/",
  "acceptance/",
];

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function argumentError(code, message) {
  return {
    error: withExit(2, [issue("BLOCKER", code, ".", message)], {
      usage: USAGE,
    }),
  };
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length === 0 || args[0].startsWith("--")) {
    return argumentError(
      "B_ARGUMENT_MISSING",
      "An absolute project directory is required.",
    );
  }
  if (!path.isAbsolute(args[0])) {
    return argumentError(
      "B_ARGUMENT_INVALID",
      "Project directory must be absolute.",
    );
  }
  const parsed = { project: args[0] };
  const booleans = new Map([
    ["--include-sources", "includeSources"],
    ["--confirm-source-risk", "confirmSourceRisk"],
    ["--confirm-personal-data", "confirmPersonalData"],
  ]);
  const seen = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index];
    if (seen.has(flag)) {
      return argumentError(
        "B_ARGUMENT_CONFLICT",
        `${flag} may only be specified once.`,
      );
    }
    seen.add(flag);
    if (booleans.has(flag)) {
      parsed[booleans.get(flag)] = true;
      continue;
    }
    if (flag === "--output") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        return argumentError(
          "B_ARGUMENT_MISSING",
          "--output requires an absolute ZIP path.",
        );
      }
      if (!path.isAbsolute(value) || !value.toLowerCase().endsWith(".zip")) {
        return argumentError(
          "B_ARGUMENT_INVALID",
          "--output must be an absolute .zip path.",
        );
      }
      parsed.output = value;
      index += 1;
      continue;
    }
    return argumentError("B_ARGUMENT_UNKNOWN", `Unknown argument: ${flag}`);
  }
  if (parsed.includeSources !== parsed.confirmSourceRisk) {
    return argumentError(
      "B_ARGUMENT_CONFLICT",
      "--include-sources and --confirm-source-risk must be supplied together.",
    );
  }
  return parsed;
}

function parseClock(options) {
  if (options.clock) return options.clock;
  const epoch = options.sourceDateEpoch ?? process.env.SOURCE_DATE_EPOCH;
  if (epoch === undefined) return () => new Date();
  if (!/^(?:0|[1-9]\d*)$/u.test(epoch)) {
    const error = new Error("SOURCE_DATE_EPOCH must be whole epoch seconds.");
    error.code = "E_SOURCE_DATE_EPOCH";
    throw error;
  }
  const milliseconds = Number(epoch) * 1000;
  const date = new Date(milliseconds);
  if (!Number.isSafeInteger(milliseconds) || Number.isNaN(date.getTime())) {
    const error = new Error("SOURCE_DATE_EPOCH is outside the supported range.");
    error.code = "E_SOURCE_DATE_EPOCH";
    throw error;
  }
  return () => new Date(date);
}

function isCorePath(relativePath) {
  return CORE_EXACT.has(relativePath) ||
    CORE_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function coreFiles(files) {
  return new Map(sortRelativePaths(
    [...files.keys()].filter(isCorePath),
  ).map((relativePath) => [relativePath, files.get(relativePath)]));
}

function sourceFiles(files) {
  return new Map(sortRelativePaths(
    [...files.keys()].filter((relativePath) =>
      relativePath.startsWith("inputs/source-files/")),
  ).map((relativePath) => [relativePath, files.get(relativePath)]));
}

function deliveryManifestFiles(files) {
  const excluded = new Set([
    ".gitignore",
    "package-manifest.json",
    "reports/validation-report.json",
    "reports/validation-report.md",
  ]);
  return new Map(sortRelativePaths(
    [...files.keys()].filter((relativePath) => !excluded.has(relativePath)),
  ).map((relativePath) => [relativePath, files.get(relativePath)]));
}

function createDeliverySelectionSnapshot(selection, includeSources) {
  const selectedFiles = deliveryManifestFiles(selection.files);
  return {
    includeSources,
    paths: sortRelativePaths([...selectedFiles.keys()]),
    files: new Map([...selectedFiles.keys()].map((relativePath) => [
      relativePath,
      selection.snapshots.get(relativePath),
    ])),
  };
}

function sameSelectionFile(left, right) {
  return Boolean(
    left &&
    right &&
    left.type === "file" &&
    right.type === "file" &&
    sameIdentity(left, right) &&
    left.mode === right.mode &&
    left.bytes.equals(right.bytes) &&
    isDeepStrictEqual(left.ancestors, right.ancestors)
  );
}

async function assertDeliverySelectionSnapshot(
  projectRoot,
  snapshot,
  ignoredPaths,
) {
  if (!snapshot) return;
  const current = await selectDeliveryFiles(projectRoot, {
    includeSources: snapshot.includeSources,
  });
  const currentFiles = deliveryManifestFiles(current.files);
  const expectedPaths = snapshot.paths.filter(
    (relativePath) => !ignoredPaths.has(relativePath),
  );
  const currentPaths = sortRelativePaths(
    [...currentFiles.keys()].filter(
      (relativePath) => !ignoredPaths.has(relativePath),
    ),
  );
  const expectedSet = new Set(expectedPaths);
  const currentSet = new Set(currentPaths);
  const driftPaths = [
    ...expectedPaths.filter((relativePath) => !currentSet.has(relativePath)),
    ...currentPaths.filter((relativePath) => !expectedSet.has(relativePath)),
  ];
  for (const relativePath of expectedPaths) {
    if (
      currentSet.has(relativePath) &&
      !sameSelectionFile(
        snapshot.files.get(relativePath),
        current.snapshots.get(relativePath),
      )
    ) {
      driftPaths.push(relativePath);
    }
  }
  if (driftPaths.length > 0) {
    const error = new Error(
      "Selected delivery files changed after packaging validation.",
    );
    error.code = "E_DELIVERY_SELECTION_DRIFT";
    error.driftPaths = [...new Set(driftPaths)];
    throw error;
  }
}

function canonicalPackageBytes(relativePath, bytes) {
  if (relativePath === "fde-project.yaml") {
    const manifest = structuredClone(
      parseSafeYaml(bytes.toString("utf8"), relativePath),
    );
    delete manifest.project?.status;
    delete manifest.stage_status?.validate;
    return canonicalBytes(manifest);
  }
  if (relativePath === "assembly/operations.yaml") {
    const operations = structuredClone(
      parseSafeYaml(bytes.toString("utf8"), relativePath),
    );
    return canonicalBytes(operations);
  }
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

function packageInputHash(files) {
  return sha256Bytes(Buffer.concat(sortRelativePaths([...files.keys()]).map(
    (relativePath) => Buffer.from(
      `${relativePath}\0${sha256Bytes(
        canonicalPackageBytes(relativePath, files.get(relativePath)),
      )}\n`,
      "utf8",
    ),
  )));
}

function customerManifestWithDerivedState(originalBytes, acceptedBytes) {
  const original = parseSafeYaml(
    originalBytes.toString("utf8"),
    "fde-project.yaml",
  );
  const accepted = parseSafeYaml(
    acceptedBytes.toString("utf8"),
    "fde-project.yaml",
  );
  original.project.status = accepted.project.status;
  original.stage_status.validate = accepted.stage_status.validate;
  return Buffer.from(stringify(original, { lineWidth: 0 }), "utf8");
}

async function recordStagingFile(
  root,
  relativePath,
  bytes,
  mode,
  inventory,
) {
  const parts = relativePath.split("/");
  let relativeDirectory = "";
  for (const part of parts.slice(0, -1)) {
    relativeDirectory = relativeDirectory
      ? `${relativeDirectory}/${part}`
      : part;
    const metadata = await lstat(path.join(
      root,
      ...relativeDirectory.split("/"),
    ));
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`Unsafe owned staging directory: ${relativeDirectory}`);
    }
    const priorDirectory = inventory.get(relativeDirectory);
    if (
      priorDirectory &&
      (
        priorDirectory.type !== "directory" ||
        !sameIdentity(priorDirectory, metadata)
      )
    ) {
      throw new Error(`Owned staging directory changed: ${relativeDirectory}`);
    }
    inventory.set(relativeDirectory, {
      path: relativeDirectory,
      type: "directory",
      dev: metadata.dev,
      ino: metadata.ino,
      mode: metadata.mode & 0o777,
    });
  }
  const target = path.join(root, ...parts);
  const metadata = await lstat(target);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`Unsafe owned staging file: ${relativePath}`);
  }
  const observedBytes = await readFile(target);
  const confirmed = await lstat(target);
  if (
    !sameIdentity(metadata, confirmed) ||
    !observedBytes.equals(bytes)
  ) {
    throw new Error(`Owned staging file changed: ${relativePath}`);
  }
  const priorFile = inventory.get(relativePath);
  if (
    priorFile &&
    (
      priorFile.type !== "file" ||
      !sameIdentity(priorFile, confirmed)
    )
  ) {
    throw new Error(`Owned staging file identity changed: ${relativePath}`);
  }
  inventory.set(relativePath, {
    path: relativePath,
    type: "file",
    dev: confirmed.dev,
    ino: confirmed.ino,
    mode: confirmed.mode & 0o777,
    sha256: sha256Bytes(bytes),
    size: bytes.length,
  });
  if ((confirmed.mode & 0o777) !== mode) {
    throw new Error(`Owned staging file mode drifted: ${relativePath}`);
  }
}

function stagingInventoryValues(inventory) {
  return [...inventory.values()].sort((left, right) =>
    Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}

async function writeTree(root, files, inventory) {
  for (const relativePath of sortRelativePaths([...files.keys()])) {
    const target = path.join(root, ...relativePath.split("/"));
    const mode = relativePath === "assembly/octopus-cli-assemble.sh"
      ? 0o755
      : 0o644;
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, files.get(relativePath), {
      flag: "wx",
      mode,
    });
    await recordStagingFile(
      root,
      relativePath,
      files.get(relativePath),
      mode,
      inventory,
    );
  }
}

async function readExistingReport(projectRoot) {
  try {
    const bytes = await readFile(
      path.join(projectRoot, "reports/package-validation.json"),
    );
    return { bytes, value: parseSafeJson(bytes.toString("utf8")) };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return null;
  }
}

function reportKey(report) {
  return [
    report?.package_input_hash,
    report?.scan_policy_hash,
    report?.kit_commit,
  ].join("\0");
}

async function writeExclusiveSynced(target, bytes, mode) {
  const handle = await open(target, "wx", mode);
  let identity;
  try {
    await handle.writeFile(bytes);
    await handle.chmod(mode);
    await handle.sync();
    identity = await handle.stat();
  } finally {
    await handle.close();
  }
  return {
    dev: identity.dev,
    ino: identity.ino,
    mode: identity.mode & 0o777,
    bytes,
  };
}

function sameIdentity(left, right) {
  return Boolean(
    left &&
    right &&
    left.dev === right.dev &&
    left.ino === right.ino
  );
}

async function verifyOwnedFile(target, expected, expectedMode) {
  const before = await lstat(target);
  if (
    before.isSymbolicLink() ||
    !before.isFile() ||
    !sameIdentity(before, expected) ||
    (before.mode & 0o777) !== expectedMode
  ) {
    return null;
  }
  const bytes = await readFile(target);
  const after = await lstat(target);
  if (
    !sameIdentity(before, after) ||
    after.isSymbolicLink() ||
    !after.isFile() ||
    !bytes.equals(expected.bytes)
  ) {
    return null;
  }
  return { identity: after, bytes };
}

async function quarantineOwnedFile(
  target,
  expected,
  expectedMode,
  transactionHooks,
) {
  const quarantine = `${target}.cleanup-${randomUUID()}`;
  try {
    await rename(target, quarantine);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    error.recoveryPaths = [target];
    throw error;
  }
  try {
    await cleanupClaimedOwnedPath(quarantine, {
      entries: [{
        identity: {
          dev: expected.dev,
          ino: expected.ino,
        },
        mode: expectedMode,
        path: ".",
        sha256: sha256Bytes(expected.bytes),
        type: "file",
      }],
    }, {
      hooks: {
        afterEntryVerified: async (details) => {
          await transactionHooks?.afterTransactionCleanupEntryVerified?.(
            details,
          );
        },
      },
    });
    return null;
  } catch (cause) {
    const error = new Error(
      `A foreign file was preserved while cleaning ${target}.`,
      { cause },
    );
    error.code = "E_PACKAGE_TRANSACTION_FOREIGN";
    error.recoveryPaths = cause?.recoveryPaths ?? [quarantine];
    throw error;
  }
}

async function transactionalCommit(outputs, options) {
  const prepared = [];
  const backups = [];
  const committed = [];
  const recoveryPaths = new Set();
  const transactionOutputPaths = new Set(
    outputs.map(({ target }) =>
      path.relative(options.projectRoot, target)
        .split(path.sep).join("/"))
      .filter((relativePath) =>
        relativePath !== "" &&
        relativePath !== ".." &&
        !relativePath.startsWith("../")),
  );
  let committedAll = false;
  try {
    for (const output of outputs) {
      await mkdir(path.dirname(output.target), { recursive: true });
      const temporary = path.join(
        path.dirname(output.target),
        `.tmp-${path.basename(output.target)}-${randomUUID()}`,
      );
      const temporaryIdentity = await writeExclusiveSynced(
        temporary,
        output.bytes,
        output.mode,
      );
      prepared.push({
        ...output,
        temporary,
        temporaryIdentity,
        temporaryPresent: true,
        claim: null,
      });
    }
    for (const output of prepared) {
      await options.transactionHooks?.beforeTarget?.({
        target: output.target,
        failAt: output.failAt,
        temporary: output.temporary,
      });
      try {
        await assertCustomerPackageManifestAbsent(options.projectRoot);
        await assertValidationSnapshot(
          {
            lstat,
            open,
            readdir,
          },
          options.projectRoot,
          options.validationSnapshot,
          transactionOutputPaths,
        );
        await assertDeliverySelectionSnapshot(
          options.projectRoot,
          options.deliverySelectionSnapshot,
          transactionOutputPaths,
        );
      } catch (error) {
        error.transactionBoundary = output.failAt;
        throw error;
      }
      output.claim = `${output.temporary}.claim-${randomUUID()}`;
      await rename(output.temporary, output.claim);
      output.temporaryPresent = false;
      const claimedTemporary = await verifyOwnedFile(
        output.claim,
        output.temporaryIdentity,
        output.mode,
      );
      if (!claimedTemporary) {
        const error = new Error(
          `Prepared transaction output changed before claim: ${output.target}`,
        );
        error.code = "E_PACKAGE_TRANSACTION_DRIFT";
        error.recoveryPaths = [output.claim];
        throw error;
      }
      let existing = null;
      let outputBackup = null;
      try {
        existing = await lstat(output.target);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (!existing && output.expectedBytes !== null) {
        throw new Error(`Transaction target disappeared: ${output.target}`);
      }
      if (existing) {
        if (output.expectedBytes === null || output.mustNotExist) {
          throw new Error(
            `Transaction target appeared during the transaction: ${output.target}`,
          );
        }
        if (existing.isSymbolicLink() || !existing.isFile()) {
          throw new Error(`Transaction target is unsafe: ${output.target}`);
        }
        const backup = path.join(
          path.dirname(output.target),
          `.tmp-backup-${path.basename(output.target)}-${randomUUID()}`,
        );
        await rename(output.target, backup);
        const backupRecord = {
          target: output.target,
          backup,
          identity: existing,
          bytes: output.expectedBytes,
          mode: existing.mode & 0o777,
        };
        outputBackup = backupRecord;
        backups.push(backupRecord);
        const claimed = await lstat(backup);
        const claimedBytes = await readFile(backup);
        if (
          claimed.dev !== existing.dev ||
          claimed.ino !== existing.ino ||
          !claimed.isFile() ||
          !claimedBytes.equals(output.expectedBytes)
        ) {
          throw new Error(
            `Transaction target changed before it was claimed: ${output.target}`,
          );
        }
        backupRecord.identity = claimed;
        backupRecord.bytes = claimedBytes;
        backupRecord.mode = claimed.mode & 0o777;
      }
      if (options.failAt === output.failAt) {
        throw new Error(`Injected package transaction failure: ${output.failAt}`);
      }
      await link(output.claim, output.target);
      committed.push({
        target: output.target,
        identity: claimedTemporary.identity,
        bytes: output.bytes,
        mode: output.mode,
        backup: outputBackup,
      });
      await options.transactionHooks?.afterTargetLinked?.({
        target: output.target,
        failAt: output.failAt,
      });
      const committedIdentity = await lstat(output.target);
      const committedBytes = await readFile(output.target);
      if (
        !sameIdentity(committedIdentity, claimedTemporary.identity) ||
        committedIdentity.isSymbolicLink() ||
        !committedIdentity.isFile() ||
        (committedIdentity.mode & 0o777) !== output.mode ||
        !committedBytes.equals(output.bytes)
      ) {
        const error = new Error(
          `Published transaction output failed verification: ${output.target}`,
        );
        error.code = "E_PACKAGE_TRANSACTION_DRIFT";
        error.recoveryPaths = [output.claim, output.target];
        throw error;
      }
      await quarantineOwnedFile(
        output.claim,
        output.temporaryIdentity,
        output.mode,
        options.transactionHooks,
      );
      output.claim = null;
    }
    await options.transactionHooks?.afterAllTargetsPublished?.();
    try {
      await assertCustomerPackageManifestAbsent(options.projectRoot);
      await assertValidationSnapshot(
        {
          lstat,
          open,
          readdir,
        },
        options.projectRoot,
        options.validationSnapshot,
        transactionOutputPaths,
      );
      await assertDeliverySelectionSnapshot(
        options.projectRoot,
        options.deliverySelectionSnapshot,
        transactionOutputPaths,
      );
    } catch (error) {
      error.transactionBoundary = "commit-final-verification";
      throw error;
    }
    for (const output of committed) {
      const verified = await verifyOwnedFile(
        output.target,
        { ...output.identity, bytes: output.bytes },
        output.mode,
      );
      if (!verified) {
        const error = new Error(
          `Published transaction output changed before final commit: ${output.target}`,
        );
        error.code = "E_PACKAGE_TRANSACTION_DRIFT";
        error.transactionBoundary = "commit-final-verification";
        error.recoveryPaths = [output.target];
        throw error;
      }
    }
    committedAll = true;
  } catch (error) {
    for (const output of [...committed].reverse()) {
      try {
        await quarantineOwnedFile(
          output.target,
          { ...output.identity, bytes: output.bytes },
          output.mode,
          options.transactionHooks,
        );
      } catch (cleanupError) {
        for (const item of cleanupError.recoveryPaths ?? []) {
          recoveryPaths.add(item);
        }
      }
    }
    for (const backup of [...backups].reverse()) {
      try {
        const verified = await verifyOwnedFile(
          backup.backup,
          { ...backup.identity, bytes: backup.bytes },
          backup.mode,
        );
        if (!verified) throw new Error("Package backup identity changed.");
        await link(backup.backup, backup.target);
        const restored = await verifyOwnedFile(
          backup.target,
          { ...backup.identity, bytes: backup.bytes },
          backup.mode,
        );
        if (!restored) throw new Error("Package backup restoration failed.");
        await quarantineOwnedFile(
          backup.backup,
          { ...backup.identity, bytes: backup.bytes },
          backup.mode,
          options.transactionHooks,
        );
      } catch (restoreError) {
        recoveryPaths.add(backup.backup);
        if (restoreError?.code === "EEXIST") {
          recoveryPaths.add(backup.target);
        }
      }
    }
    for (const output of prepared) {
      for (const candidate of [
        output.claim
          ? {
            path: output.claim,
            identity: output.temporaryIdentity,
          }
          : null,
        output.temporaryPresent
          ? {
            path: output.temporary,
            identity: output.temporaryIdentity,
          }
          : null,
      ].filter(Boolean)) {
        try {
          await quarantineOwnedFile(
            candidate.path,
            candidate.identity,
            output.mode,
            options.transactionHooks,
          );
        } catch (cleanupError) {
          for (const item of cleanupError.recoveryPaths ?? []) {
            recoveryPaths.add(item);
          }
        }
      }
    }
    error.recoveryPaths = [
      ...new Set([
        ...(error.recoveryPaths ?? []),
        ...recoveryPaths,
      ]),
    ];
    throw error;
  }

  const cleanupPaths = [];
  if (committedAll) {
    for (const backup of backups) {
      try {
        await options.transactionHooks?.beforeBackupCleanup?.({
          target: backup.target,
          backup: backup.backup,
        });
        await quarantineOwnedFile(
          backup.backup,
          { ...backup.identity, bytes: backup.bytes },
          backup.mode,
          options.transactionHooks,
        );
      } catch (error) {
        cleanupPaths.push(...(
          error.recoveryPaths?.length > 0
            ? error.recoveryPaths
            : [backup.backup]
        ));
      }
    }
  }
  return { cleanupPaths: [...new Set(cleanupPaths)] };
}

async function cleanupStaging(
  stagingRoot,
  stagingIdentity,
  expectedInventory,
  options,
) {
  try {
    await options.transactionHooks?.beforeStagingCleanup?.({ stagingRoot });
  } catch (error) {
    error.recoveryPaths = [stagingRoot];
    throw error;
  }
  const claim = `${stagingRoot}.cleanup-${randomUUID()}`;
  try {
    await rename(stagingRoot, claim);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    error.recoveryPaths = [stagingRoot];
    throw error;
  }
  const claimedIdentity = await lstat(claim).catch(() => null);
  if (
    !claimedIdentity ||
    !sameIdentity(claimedIdentity, stagingIdentity) ||
    claimedIdentity.isSymbolicLink() ||
    !claimedIdentity.isDirectory()
  ) {
    const error = new Error(
      "A foreign staging directory was claimed and preserved during cleanup.",
    );
    error.code = "E_PACKAGE_STAGING_FOREIGN";
    error.recoveryPaths = [claim];
    throw error;
  }
  try {
    await cleanupClaimedOwnedPath(claim, {
      entries: [
        {
          identity: {
            dev: stagingIdentity.dev,
            ino: stagingIdentity.ino,
          },
          mode: stagingIdentity.mode & 0o777,
          path: ".",
          type: "directory",
        },
        ...expectedInventory,
      ],
    }, {
      hooks: {
        afterEntryClaimed: async (details) => {
          await options.transactionHooks
            ?.afterStagingCleanupEntryClaimed?.({
              ...details,
              stagingClaim: claim,
            });
        },
        afterEntryVerified: async (details) => {
          await options.transactionHooks
            ?.afterStagingCleanupEntryVerified?.({
              ...details,
              stagingClaim: claim,
            });
        },
        afterInventoryVerified: async () => {
          await options.transactionHooks
            ?.afterStagingInventoryVerified?.({
              stagingClaim: claim,
            });
        },
      },
    });
  } catch (cause) {
    const error = new Error(
      "Staging contents changed during cleanup and were preserved.",
      { cause },
    );
    error.code = "E_PACKAGE_STAGING_DRIFT";
    error.recoveryPaths = cause?.recoveryPaths ?? [claim];
    throw error;
  }
}

function businessFailure(issues, data = {}) {
  return withExit(1, issues, data);
}

function packageManifestPresentIssue() {
  return issue(
    "BLOCKER",
    "B_PACKAGE_MANIFEST_PRESENT",
    "package-manifest.json",
    "Remove the extracted package manifest from the customer project before packaging.",
  );
}

async function assertCustomerPackageManifestAbsent(projectRoot) {
  try {
    await lstat(path.join(projectRoot, "package-manifest.json"));
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const error = new Error(
    "The customer project contains package-manifest.json.",
  );
  error.code = "B_PACKAGE_MANIFEST_PRESENT";
  throw error;
}

function isRefreshablePackageReportIssue({ code, path: issuePath }) {
  return (
    code === "B_PACKAGE_EVIDENCE_INVALID" &&
    issuePath === "reports/package-validation.json"
  );
}

function packageInputSnapshot(snapshot, includeSources) {
  if (!snapshot || includeSources) return snapshot;
  const isSource = (relativePath) =>
    relativePath.startsWith("inputs/source-files/");
  return {
    ...snapshot,
    files: snapshot.files.filter(({ path: relativePath }) =>
      !isSource(relativePath)),
    authoritative: {
      patterns: snapshot.authoritative.patterns.filter((pattern) =>
        pattern !== "inputs/source-files/**"),
      paths: snapshot.authoritative.paths.filter((relativePath) =>
        !isSource(relativePath)),
    },
  };
}

async function packageProject(parsed, options, clock) {
  const output = parsed.output ?? path.join(
    path.dirname(parsed.project),
    `${path.basename(parsed.project)}-offline-delivery.zip`,
  );
  try {
    await assertCustomerPackageManifestAbsent(parsed.project);
  } catch (error) {
    if (error?.code === "B_PACKAGE_MANIFEST_PRESENT") {
      return businessFailure([packageManifestPresentIssue()]);
    }
    throw error;
  }
  try {
    await lstat(output);
    return businessFailure([issue(
      "BLOCKER",
      "B_PACKAGE_OUTPUT_EXISTS",
      output,
      "The target ZIP already exists and V1 never overwrites archives.",
    )]);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const preliminary = await validateProjectDirectory(parsed.project, {
    stageId: "validate",
    dependencies: options.dependencies,
  });
  const preliminaryBlockers = preliminary.issues.filter(
    (candidate) =>
      candidate.severity === "BLOCKER" &&
      !isRefreshablePackageReportIssue(candidate) &&
      !(
        candidate.code === "B_PROJECT_STATUS_DRIFT" &&
        preliminary.context.manifest?.stage_status?.validate?.status ===
          "complete"
      ),
  );
  const firstSix = [
    "initialize",
    "discover",
    "team-design",
    "foundation-design",
    "author",
    "assemble",
  ];
  if (
    preliminaryBlockers.length > 0 ||
    firstSix.some((stage) =>
      preliminary.data.stage_states[stage] !== "complete")
  ) {
    return businessFailure([
      ...preliminaryBlockers,
      ...firstSix.filter((stage) =>
        preliminary.data.stage_states[stage] !== "complete").map((stage) =>
        issue(
          "BLOCKER",
          "B_PACKAGE_STAGE_INCOMPLETE",
          `stage_status.${stage}`,
          "The first six stages must be complete before packaging.",
          { stage },
        )),
    ], { stage_states: preliminary.data.stage_states });
  }

  const selected = await selectDeliveryFiles(parsed.project, {
    includeSources: parsed.includeSources,
  });
  const filesToScan = deliveryManifestFiles(selected.files);
  filesToScan.delete("reports/package-validation.json");
  const scanabilityIssues = [
    ...validateSourceScanability(selected, {
      includeSources: parsed.includeSources,
    }),
    ...validateDeliveryFileScanability(filesToScan),
  ];
  if (scanabilityIssues.length > 0) {
    return businessFailure(scanabilityIssues);
  }
  const deliverySelectionSnapshot = createDeliverySelectionSnapshot(
    selected,
    parsed.includeSources,
  );
  const projected = projectSanitizedProjection(
    selected.files.get("fde-project.yaml"),
  );
  selected.files.set("fde-project.yaml", projected.bytes);
  const scanPolicyPath = "reports/package-scan-policy.yaml";
  const policyBytes = selected.files.get(scanPolicyPath);
  if (!policyBytes) {
    return businessFailure([issue(
      "BLOCKER",
      "B_SCAN_POLICY_MISSING",
      scanPolicyPath,
      "Packaging requires an explicit scan policy.",
    )]);
  }
  let policy;
  try {
    policy = parseSafeYaml(policyBytes.toString("utf8"), scanPolicyPath);
  } catch (error) {
    return businessFailure([issue(
      "BLOCKER",
      "B_SCAN_POLICY_INVALID",
      scanPolicyPath,
      "Packaging scan policy is invalid.",
      { error: error instanceof Error ? error.message : String(error) },
    )]);
  }
  const manifest = parseSafeYaml(
    projected.bytes.toString("utf8"),
    "fde-project.yaml",
  );
  const scan = scanSensitiveFiles(filesToScan, {
    policy,
    customerName: manifest.project.customer_name,
    currentTenant: options.currentTenant,
    allowedTenants: options.allowedTenants,
    confirmPersonalData: parsed.confirmPersonalData,
  });
  const scanBlockers = scan.issues.filter(
    ({ severity }) => severity === "BLOCKER",
  );
  if (scanBlockers.length > 0) {
    return businessFailure(scan.issues, { redactions: projected.redactions });
  }

  const supportedWrites =
    preliminary.context.assemblyValidation?.supportedWrites ?? [];
  const scriptPath = "assembly/octopus-cli-assemble.sh";
  if (supportedWrites.length > 0) {
    const catalogById = new Map(
      preliminary.context.assemblyCatalog.supported.map((entry) => [
        entry.operation_id,
        entry,
      ]),
    );
    const expected = renderDryrunScript(supportedWrites, catalogById);
    const inspection = inspectRenderedDryrunScript(
      selected.files.get(scriptPath),
      expected,
      { processAdapter: options.dependencies?.localProcess },
    );
    if (!inspection.valid) {
      return businessFailure([issue(
        "BLOCKER",
        inspection.code,
        scriptPath,
        "Assembly Shell did not pass an independent rerender and bash -n check.",
      )]);
    }
  } else if (selected.files.has(scriptPath)) {
    return businessFailure([issue(
      "BLOCKER",
      "B_ASSEMBLY_SCRIPT_UNEXPECTED",
      scriptPath,
      "Projects without supported writes must not deliver an assembly Shell.",
    )]);
  }

  const stagingRoot = await mkdtemp(path.join(
    path.dirname(parsed.project),
    ".aiworker-package-",
  ));
  const stagingIdentity = await lstat(stagingRoot);
  const stagingInventory = new Map();
  try {
    const core = coreFiles(selected.files);
    const packageInputs = new Map(core);
    if (parsed.includeSources) {
      for (const entry of sourceFiles(selected.files)) {
        packageInputs.set(...entry);
      }
    }
    const inputHash = packageInputHash(packageInputs);
    const policyHash = sha256Bytes(canonicalBytes(policy));
    const kitCommit = await resolveAuthoritativeKitCommit({
      kitRoot: options.kitRoot ?? ROOT,
      env: options.env ?? process.env,
    });
    if (!kitCommit) {
      throw new Error(
        "An authoritative Kit commit is unavailable for this checkout or clean copy installation.",
      );
    }
    const existingReport = await readExistingReport(parsed.project);
    const currentKey = [inputHash, policyHash, kitCommit].join("\0");
    const packagedAt = clock().toISOString();
    const buildReportValue = (validatedAt) => ({
      schema_version: 1,
      project_slug: manifest.project.slug,
      package_input_hash: inputHash,
      scan_policy_hash: policyHash,
      kit_commit: kitCommit,
      validated_at: validatedAt,
      status: "passed",
      validation_result: {
        status: "passed",
        blocker_count: 0,
        redactions: projected.redactions,
      },
    });
    const expectedExistingReport = buildReportValue(
      existingReport?.value?.validated_at,
    );
    const reusableReport = Boolean(
      existingReport &&
      reportKey(existingReport.value) === currentKey &&
      isPassingPackageReport(existingReport.value) &&
      isDeepStrictEqual(existingReport.value, expectedExistingReport),
    );
    const reportValue = reusableReport
      ? existingReport.value
      : buildReportValue(packagedAt);
    const freshReportBytes = Buffer.from(
      `${JSON.stringify(reportValue, null, 2)}\n`,
      "utf8",
    );
    const reportBytes =
      reusableReport
        ? existingReport.bytes
        : freshReportBytes;
    const stagingFiles = new Map(selected.files);
    stagingFiles.set(scanPolicyPath, policyBytes);
    stagingFiles.set(
      "reports/package-validation.json",
      reportBytes,
    );
    const manifestFiles = deliveryManifestFiles(stagingFiles);
    let packageManifest = createPackageManifest(manifestFiles, {
      packageInputHash: inputHash,
      packagedAt,
      projectSlug: manifest.project.slug,
      sourcesIncluded: parsed.includeSources,
    });
    let packageManifestBytes = Buffer.from(
      `${JSON.stringify(packageManifest, null, 2)}\n`,
      "utf8",
    );
    stagingFiles.set("package-manifest.json", packageManifestBytes);
    await writeTree(stagingRoot, stagingFiles, stagingInventory);
    if (options.failAt === "scan" || options.failAt === "render") {
      throw new Error(`Injected package failure: ${options.failAt}`);
    }

    const stagedValidation = await validateProjectDirectory(stagingRoot, {
      stageId: "validate",
      dependencies: options.dependencies,
    });
    const acceptance = prepareStageAcceptance(stagedValidation, "validate");
    if (acceptance.result.exitCode !== 0) {
      return businessFailure(acceptance.result.issues, {
        failed_stage: "validate",
      });
    }
    const acceptedManifestBytes =
      acceptance.manifestBytes ?? stagingFiles.get("fde-project.yaml");
    stagingFiles.set("fde-project.yaml", acceptedManifestBytes);
    await writeFile(
      path.join(stagingRoot, "fde-project.yaml"),
      acceptedManifestBytes,
    );
    await recordStagingFile(
      stagingRoot,
      "fde-project.yaml",
      acceptedManifestBytes,
      0o644,
      stagingInventory,
    );
    packageManifest = createPackageManifest(
      deliveryManifestFiles(stagingFiles),
      {
        packageInputHash: inputHash,
        packagedAt,
        projectSlug: manifest.project.slug,
        sourcesIncluded: parsed.includeSources,
      },
    );
    packageManifestBytes = Buffer.from(
      `${JSON.stringify(packageManifest, null, 2)}\n`,
      "utf8",
    );
    stagingFiles.set("package-manifest.json", packageManifestBytes);
    await writeFile(
      path.join(stagingRoot, "package-manifest.json"),
      packageManifestBytes,
    );
    await recordStagingFile(
      stagingRoot,
      "package-manifest.json",
      packageManifestBytes,
      0o644,
      stagingInventory,
    );

    const finalValidation = await validateProjectDirectory(stagingRoot, {
      dependencies: options.dependencies,
    });
    const finalBlockers = finalValidation.issues.filter(
      ({ severity }) => severity === "BLOCKER",
    );
    if (finalBlockers.length > 0) {
      return businessFailure(finalBlockers, { failed_stage: "validate" });
    }
    const manifestVerification = verifyPackageManifest(
      packageManifest,
      deliveryManifestFiles(stagingFiles),
    );
    if (manifestVerification.exitCode !== 0) {
      return businessFailure(manifestVerification.issues);
    }
    if (options.failAt === "reverse-manifest") {
      throw new Error("Injected package failure: reverse-manifest");
    }

    const archiveFiles = deliveryManifestFiles(stagingFiles);
    archiveFiles.set("reports/package-validation.json", reportBytes);
    archiveFiles.set("package-manifest.json", packageManifestBytes);
    const stagedArchive = path.join(stagingRoot, "delivery.zip");
    if (options.failAt === "zip-write") {
      throw new Error("Injected package failure: zip-write");
    }
    await writeDeterministicZip(stagedArchive, archiveFiles);
    const archiveBytes = await readFile(stagedArchive);
    await recordStagingFile(
      stagingRoot,
      "delivery.zip",
      archiveBytes,
      0o600,
      stagingInventory,
    );
    const zipVerification = await readAndVerifyZip(stagedArchive, archiveFiles);
    if (zipVerification.exitCode !== 0) {
      return businessFailure(zipVerification.issues);
    }
    if (options.failAt === "zip-verify") {
      throw new Error("Injected package failure: zip-verify");
    }
    const customerManifestBytes = customerManifestWithDerivedState(
      preliminary.context.files.get("fde-project.yaml"),
      acceptedManifestBytes,
    );
    let transaction;
    try {
      transaction = await transactionalCommit([
        {
          target: path.join(parsed.project, "fde-project.yaml"),
          bytes: customerManifestBytes,
          mode: 0o644,
          failAt: "commit-manifest",
          expectedBytes: preliminary.context.files.get("fde-project.yaml"),
        },
        {
          target: path.join(
            parsed.project,
            "reports/package-validation.json",
          ),
          bytes: reportBytes,
          mode: 0o644,
          failAt: "commit-report",
          expectedBytes:
            preliminary.context.files.get(
              "reports/package-validation.json",
            ) ?? null,
        },
        {
          target: output,
          bytes: archiveBytes,
          mode: 0o644,
          failAt: "commit-zip",
          mustNotExist: true,
          expectedBytes: null,
        },
      ], {
        ...options,
        projectRoot: parsed.project,
        validationSnapshot: packageInputSnapshot(
          preliminary.context.validationSnapshot,
          parsed.includeSources,
        ),
        deliverySelectionSnapshot,
      });
    } catch (error) {
      if (
        error?.code === "B_PACKAGE_MANIFEST_PRESENT" &&
        (error.recoveryPaths?.length ?? 0) === 0
      ) {
        return businessFailure([packageManifestPresentIssue()]);
      }
      throw error;
    }
    const finalManifest = parseSafeYaml(
      acceptedManifestBytes.toString("utf8"),
      "fde-project.yaml",
    );
    const cleanupIssues = transaction.cleanupPaths.length > 0
      ? [issue(
        "WARNING",
        "W_TRANSACTION_CLEANUP_DEFERRED",
        ".",
        "Package outputs were committed, but old backups remain available for safe recovery.",
      )]
      : [];
    return withExit(0, [...scan.issues, ...cleanupIssues], {
      output,
      packaged_files: archiveFiles.size,
      package_input_hash: inputHash,
      scan_policy_hash: policyHash,
      kit_commit: kitCommit,
      project_status: finalManifest.project.status,
      baseline_revision:
        finalManifest.stage_status.validate.baseline_revision,
      redactions: projected.redactions,
      excluded_file_count: selected.excluded.length,
      excluded_categories: [...new Set(
        selected.excluded.map(({ reason }) => reason),
      )].sort(),
      recovery_paths: transaction.cleanupPaths,
    });
  } finally {
    await cleanupStaging(
      stagingRoot,
      stagingIdentity,
      stagingInventoryValues(stagingInventory),
      options,
    );
  }
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args);
  let result;
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.error) {
      result = parsed.error;
    } else {
      const clock = parseClock(options);
      result = await packageProject(parsed, options, clock);
    }
  } catch (error) {
    const exitCode = error?.code === "E_SOURCE_DATE_EPOCH" ? 2 : 3;
    result = withExit(exitCode, [issue(
      "BLOCKER",
      exitCode === 2 ? "B_ARGUMENT_INVALID" : "B_PACKAGE_RUNTIME",
      ".",
      exitCode === 2
        ? error.message
        : "Offline packaging could not complete.",
      exitCode === 2
        ? {}
        : {
          error: error instanceof Error ? error.message : String(error),
          error_code: error?.code,
          drift_paths: error?.driftPaths ?? [],
          transaction_boundary: error?.transactionBoundary,
        },
    )], exitCode === 2
      ? { usage: USAGE }
      : { recovery_paths: error?.recoveryPaths ?? [] });
  }
  writeStdout(`${JSON.stringify(result)}\n`);
  return result.exitCode;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (
  process.env.AIWORKER_BUNDLED_RUNTIME !== "1" &&
  invokedPath === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2));
}

export { USAGE };
