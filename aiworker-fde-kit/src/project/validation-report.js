import {
  lstat,
  link,
  mkdir,
  open,
  readdir,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";

import {
  assertContainedDirectoryChain,
  readContainedRegularFileSnapshotNoFollow,
  readRegularFileNoFollow,
  sameFilesystemIdentity,
  snapshotContainedDirectoryChain,
} from "./project-runtime.js";
import {
  matchesAuthoritativePattern,
} from "./stage-state.js";
import {
  canonicalBytes,
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";

function buildReport(result, command, failedStage, clock) {
  const base = {
    schema_version: 1,
    generated_at: clock().toISOString(),
    command,
    failed_stage: failedStage ?? null,
    exit_code: result.exitCode,
    recovery:
      result.data?.recovery ??
      (result.exitCode === 0
        ? null
        : "Resolve all blockers and rerun the same command."),
    project_status: result.data?.project_status ?? null,
    stage_states: result.data?.stage_states ?? null,
    issues: result.issues,
  };
  return {
    report_id: sha256Bytes(canonicalBytes(base)),
    ...base,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# 验证报告",
    "",
    `Report ID: \`${report.report_id}\``,
    "",
    `Command: \`${report.command}\``,
    "",
    `Exit code: \`${report.exit_code}\``,
    "",
    `Generated at: \`${report.generated_at}\``,
    "",
    "## 发现",
    "",
  ];
  if (report.issues.length === 0) {
    lines.push("- 无阻断、警告或信息项。");
  } else {
    for (const item of report.issues) {
      const message = item.message.replaceAll(/\s+/gu, " ").trim();
      lines.push(
        `- **${item.severity} ${item.code}** \`${item.path}\`: ${message}`,
      );
    }
  }
  lines.push(
    "",
    "## 恢复",
    "",
    report.recovery ?? "无需恢复动作。",
    "",
  );
  return lines.join("\n");
}

async function safeExistingFile(fs, target, ancestors) {
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  try {
    const metadata = await fs.lstat(target);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      throw new Error(`Transaction target is not a regular file: ${target}`);
    }
    const bytes = await readRegularFileNoFollow(fs, target);
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    const confirmed = await fs.lstat(target);
    if (
      confirmed.dev !== metadata.dev ||
      confirmed.ino !== metadata.ino ||
      confirmed.isSymbolicLink() ||
      !confirmed.isFile()
    ) {
      throw new Error(`Transaction target changed during snapshot: ${target}`);
    }
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    return { bytes, identity: confirmed };
  } catch (error) {
    if (error?.code === "ENOENT") {
      if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
      return null;
    }
    throw error;
  }
}

function sameIdentity(left, right) {
  return Boolean(
    left &&
    right &&
    left.dev === right.dev &&
    left.ino === right.ino,
  );
}

export async function assertValidationSnapshot(
  fs,
  projectRoot,
  snapshot,
  ignoredPaths = new Set(),
) {
  if (!snapshot) return;
  const driftPaths = [];
  for (const expected of snapshot.files ?? []) {
    if (ignoredPaths.has(expected.path)) continue;
    try {
      await assertContainedDirectoryChain(fs, expected.ancestors);
      const current = await readContainedRegularFileSnapshotNoFollow(
        fs,
        projectRoot,
        expected.path,
      );
      await assertContainedDirectoryChain(fs, expected.ancestors);
      if (
        current.type !== expected.type ||
        !sameFilesystemIdentity(current, expected) ||
        current.sha256 !== expected.sha256 ||
        !current.bytes.equals(expected.bytes)
      ) {
        driftPaths.push(expected.path);
      }
    } catch {
      driftPaths.push(expected.path);
    }
  }
  const authoritative = snapshot.authoritative;
  if (authoritative) {
    try {
      const current = await resolveCurrentAuthoritativePaths(
        fs,
        projectRoot,
        authoritative.patterns,
      );
      const expected = authoritative.paths.filter(
        (relativePath) => !ignoredPaths.has(relativePath),
      );
      const currentPaths = current.paths.filter(
        (relativePath) => !ignoredPaths.has(relativePath),
      );
      const expectedSet = new Set(expected);
      const currentSet = new Set(currentPaths);
      driftPaths.push(
        ...expected.filter((relativePath) => !currentSet.has(relativePath)),
        ...currentPaths.filter((relativePath) =>
          !expectedSet.has(relativePath)),
        ...current.unsafePaths.filter(
          (relativePath) => !ignoredPaths.has(relativePath),
        ),
      );
    } catch {
      driftPaths.push("fde-project.yaml");
    }
  }
  if (driftPaths.length > 0) {
    const error = new Error(
      "Project files changed after the validation snapshot was captured.",
    );
    error.code = "E_VALIDATION_SNAPSHOT_DRIFT";
    error.driftPaths = [...new Set(driftPaths)];
    throw error;
  }
}

function couldAffectPattern(relativePath, pattern) {
  const wildcard = pattern.search(/\*/u);
  const prefix = wildcard === -1 ? pattern : pattern.slice(0, wildcard);
  return (
    relativePath.startsWith(prefix) ||
    prefix.startsWith(`${relativePath}/`)
  );
}

async function resolveCurrentAuthoritativePaths(
  fs,
  projectRoot,
  patterns,
) {
  const paths = new Set();
  const unsafePaths = new Set();
  const stack = [""];
  while (stack.length > 0) {
    const relativeDirectory = stack.pop();
    const absoluteDirectory = relativeDirectory
      ? path.join(projectRoot, ...relativeDirectory.split("/"))
      : projectRoot;
    const before = await fs.lstat(absoluteDirectory);
    if (before.isSymbolicLink() || !before.isDirectory()) {
      unsafePaths.add(relativeDirectory || "fde-project.yaml");
      continue;
    }
    const entries = await fs.readdir(absoluteDirectory, {
      withFileTypes: true,
    });
    const after = await fs.lstat(absoluteDirectory);
    if (!sameFilesystemIdentity(before, after)) {
      unsafePaths.add(relativeDirectory || "fde-project.yaml");
      continue;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const metadata = await fs.lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        if (patterns.some((pattern) =>
          couldAffectPattern(relativePath, pattern))) {
          unsafePaths.add(relativePath);
        }
      } else if (metadata.isDirectory()) {
        stack.push(relativePath);
      } else if (
        metadata.isFile() &&
        patterns.some((pattern) =>
          matchesAuthoritativePattern(pattern, relativePath))
      ) {
        paths.add(relativePath);
      }
    }
  }
  return {
    paths: sortRelativePaths([...paths]),
    unsafePaths: sortRelativePaths([...unsafePaths]),
  };
}

async function snapshotMatches(fs, target, snapshot, ancestors) {
  if (!snapshot) {
    try {
      if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
      await fs.lstat(target);
      if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
      return false;
    } catch (error) {
      if (error?.code === "ENOENT") {
        if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
        return true;
      }
      throw error;
    }
  }
  try {
    const current = await safeExistingFile(fs, target, ancestors);
    return (
      sameIdentity(current.identity, snapshot.identity) &&
      current.bytes.equals(snapshot.bytes)
    );
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeExclusive(fs, target, bytes, mode, ancestors) {
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  const handle = await fs.open(target, "wx", mode);
  try {
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    await handle.writeFile(bytes);
    await handle.chmod(mode);
    await handle.sync();
    const identity = await handle.stat();
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    return identity;
  } finally {
    await handle.close();
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  }
}

async function guardedRename(fs, source, target, ancestors) {
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  await fs.rename(source, target);
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
}

async function guardedLink(fs, source, target, ancestors) {
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  await fs.link(source, target);
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
}

export async function removeIfOwned(
  fs,
  target,
  identity,
  ancestors,
  expectedBytes,
) {
  const quarantineDirectory = [
    target,
    process.pid,
    Date.now(),
    Math.random().toString(16).slice(2),
    "cleanup",
  ].join(".");
  const quarantinePath = path.join(quarantineDirectory, "entry");
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  await fs.mkdir(quarantineDirectory, { mode: 0o700 });
  if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  let quarantined = false;
  try {
    try {
      await guardedRename(
        fs,
        target,
        quarantinePath,
        ancestors,
      );
      quarantined = true;
    } catch (error) {
      if (error?.code === "ENOENT") {
        if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
        await fs.rmdir(quarantineDirectory);
        if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
        return;
      }
      try {
        if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
        await fs.rmdir(quarantineDirectory);
        if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
      } catch (cleanupError) {
        error.recoveryPaths = [quarantineDirectory];
        error.cleanupError =
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError);
      }
      throw error;
    }
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    const current = await fs.lstat(quarantinePath);
    const currentBytes = Buffer.isBuffer(expectedBytes)
      ? await readRegularFileNoFollow(fs, quarantinePath)
      : null;
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    if (
      !sameIdentity(current, identity) ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      (
        Buffer.isBuffer(expectedBytes) &&
        !currentBytes.equals(expectedBytes)
      )
    ) {
      const error = new Error(
        `Transaction cleanup quarantined a foreign path: ${target}`,
      );
      error.recoveryPaths = [quarantinePath];
      throw error;
    }
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    await fs.unlink(quarantinePath);
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
    await fs.rmdir(quarantineDirectory);
    if (ancestors) await assertContainedDirectoryChain(fs, ancestors);
  } catch (error) {
    if (!error.recoveryPaths && quarantined) {
      error.recoveryPaths = [quarantinePath];
    }
    throw error;
  }
}

export async function claimFileForReplacement(
  fs,
  target,
  backup,
  expectedIdentity,
) {
  await fs.rename(target, backup);
  const claimed = await fs.lstat(backup);
  if (
    sameIdentity(claimed, expectedIdentity) &&
    !claimed.isSymbolicLink() &&
    claimed.isFile()
  ) {
    return claimed;
  }
  const error = new Error(
    "Replacement target changed while it was being claimed.",
  );
  error.code = "E_REPLACEMENT_TARGET_DRIFT";
  error.recoveryPaths = [backup];
  try {
    await fs.link(backup, target);
    const restored = await fs.lstat(target);
    if (
      !sameIdentity(restored, claimed) ||
      restored.isSymbolicLink() ||
      !restored.isFile()
    ) {
      throw new Error("Concurrent replacement restoration was not exclusive.");
    }
  } catch (restoreError) {
    if (restoreError?.code !== "EEXIST") {
      error.restoreError = restoreError instanceof Error
        ? restoreError.message
        : String(restoreError);
    }
  }
  throw error;
}

export async function writeValidationTransaction(
  projectRoot,
  result,
  options = {},
) {
  const fs = {
    lstat,
    link,
    mkdir,
    open,
    readdir,
    rename,
    rmdir,
    unlink,
    ...options.fs,
  };
  const report = buildReport(
    result,
    options.command ?? "validate-project",
    options.failedStage,
    options.clock ?? (() => new Date()),
  );
  const files = new Map([
    [
      "reports/validation-report.json",
      Buffer.from(`${JSON.stringify(report, null, 2)}\n`, "utf8"),
    ],
    [
      "reports/validation-report.md",
      Buffer.from(renderMarkdown(report), "utf8"),
    ],
  ]);
  if (options.manifestBytes) {
    files.set("fde-project.yaml", options.manifestBytes);
  }
  for (const [relativePath, bytes] of options.additionalFiles ?? []) {
    if (
      typeof relativePath !== "string" ||
      path.isAbsolute(relativePath) ||
      relativePath.split("/").some((part) =>
        part === "" || part === "." || part === "..") ||
      !Buffer.isBuffer(bytes)
    ) {
      throw new Error("Additional transaction files must be safe relative paths and bytes.");
    }
    files.set(relativePath, bytes);
  }
  const additionalFileModes = new Map(options.additionalFileModes ?? []);
  for (const [relativePath, mode] of additionalFileModes) {
    if (
      !files.has(relativePath) ||
      !Number.isInteger(mode) ||
      mode < 0 ||
      mode > 0o777
    ) {
      throw new Error(
        "Additional transaction file modes must target written files and use permission bits.",
      );
    }
  }
  const removePaths = new Set(options.removePaths ?? []);
  for (const relativePath of removePaths) {
    if (
      typeof relativePath !== "string" ||
      path.isAbsolute(relativePath) ||
      relativePath.split("/").some((part) =>
        part === "" || part === "." || part === "..") ||
      files.has(relativePath)
    ) {
      throw new Error("Removed transaction paths must be safe, distinct relative paths.");
    }
  }
  await assertValidationSnapshot(
    fs,
    projectRoot,
    options.validationSnapshot,
  );
  const rootAncestors = await snapshotContainedDirectoryChain(
    fs,
    projectRoot,
    "",
  );
  await assertContainedDirectoryChain(fs, rootAncestors);
  await fs.mkdir(path.join(projectRoot, "reports"), { recursive: false })
    .catch((error) => {
      if (error?.code !== "EEXIST") throw error;
    });
  await assertContainedDirectoryChain(fs, rootAncestors);
  const reportsDirectory = await fs.lstat(path.join(projectRoot, "reports"));
  if (
    reportsDirectory.isSymbolicLink() ||
    !reportsDirectory.isDirectory()
  ) {
    throw new Error(
      "Validation reports directory must be a non-symbolic-link directory.",
    );
  }
  await assertContainedDirectoryChain(fs, rootAncestors);

  const nonce = [
    process.pid,
    Date.now(),
    Math.random().toString(16).slice(2),
  ].join("-");
  const entries = [];
  try {
    for (const [relativePath, bytes] of files) {
      const target = path.join(projectRoot, ...relativePath.split("/"));
      const ancestors = await snapshotContainedDirectoryChain(
        fs,
        projectRoot,
        relativePath,
      );
      const priorSnapshot = await safeExistingFile(
        fs,
        target,
        ancestors,
      );
      const temporary = path.join(
        path.dirname(target),
        `.${path.basename(target)}.${nonce}.tmp`,
      );
      const backup = path.join(
        path.dirname(target),
        `.${path.basename(target)}.${nonce}.bak`,
      );
      const temporaryIdentity = await writeExclusive(
        fs,
        temporary,
        bytes,
        additionalFileModes.get(relativePath) ??
          (priorSnapshot ? priorSnapshot.identity.mode & 0o777 : 0o644),
        ancestors,
      );
      entries.push({
        relativePath,
        target,
        temporary,
        backup,
        priorSnapshot,
        temporaryIdentity,
        bytes,
        ancestors,
        backedUp: false,
        published: false,
        temporaryPresent: true,
        remove: false,
      });
    }
    for (const relativePath of removePaths) {
      const target = path.join(projectRoot, ...relativePath.split("/"));
      const ancestors = await snapshotContainedDirectoryChain(
        fs,
        projectRoot,
        relativePath,
      );
      const priorSnapshot = await safeExistingFile(
        fs,
        target,
        ancestors,
      );
      if (!priorSnapshot) continue;
      entries.push({
        relativePath,
        target,
        temporary: null,
        backup: path.join(
          path.dirname(target),
          `.${path.basename(target)}.${nonce}.bak`,
        ),
        priorSnapshot,
        temporaryIdentity: null,
        bytes: null,
        ancestors,
        backedUp: false,
        published: false,
        temporaryPresent: false,
        remove: true,
      });
    }
    await assertValidationSnapshot(
      fs,
      projectRoot,
      options.validationSnapshot,
    );
    if (options.reportFault === "before-commit") {
      throw new Error("Injected report transaction failure before commit.");
    }
    for (const entry of entries) {
      if (
        !(await snapshotMatches(
          fs,
          entry.target,
          entry.priorSnapshot,
          entry.ancestors,
        ))
      ) {
        const error = new Error(
          `Transaction input changed before commit: ${entry.relativePath}`,
        );
        error.code = "E_VALIDATION_TRANSACTION_DRIFT";
        throw error;
      }
    }
    const publishedSnapshotPaths = new Set();
    for (const [index, entry] of entries.entries()) {
      await assertValidationSnapshot(
        fs,
        projectRoot,
        options.validationSnapshot,
        publishedSnapshotPaths,
      );
      if (
        options.reportFault === "before-manifest-publish" &&
        entry.relativePath === "fde-project.yaml"
      ) {
        throw new Error(
          "Injected report transaction failure before manifest publish.",
        );
      }
      if (entry.priorSnapshot) {
        await guardedRename(
          fs,
          entry.target,
          entry.backup,
          entry.ancestors,
        );
        entry.backedUp = true;
        const claimed = await safeExistingFile(
          fs,
          entry.backup,
          entry.ancestors,
        );
        if (
          !sameIdentity(
            claimed.identity,
            entry.priorSnapshot.identity,
          ) ||
          !claimed.bytes.equals(entry.priorSnapshot.bytes)
        ) {
          const error = new Error(
            `Transaction target changed while being claimed: ${entry.relativePath}`,
          );
          error.code = "E_VALIDATION_TRANSACTION_DRIFT";
          error.recoveryPaths = [entry.backup];
          throw error;
        }
      }
      if (entry.remove) {
        publishedSnapshotPaths.add(entry.relativePath);
        continue;
      }
      try {
        await guardedLink(
          fs,
          entry.temporary,
          entry.target,
          entry.ancestors,
        );
      } catch (error) {
        if (error?.code === "EEXIST") {
          error.code = "E_VALIDATION_TRANSACTION_DRIFT";
          error.recoveryPaths = [entry.temporary];
        }
        throw error;
      }
      entry.published = true;
      await removeIfOwned(
        fs,
        entry.temporary,
        entry.temporaryIdentity,
        entry.ancestors,
        entry.bytes,
      );
      entry.temporaryPresent = false;
      publishedSnapshotPaths.add(entry.relativePath);
      if (
        options.reportFault === "after-first-publish" &&
        index === 0
      ) {
        throw new Error(
          "Injected report transaction failure after first publish.",
        );
      }
    }
    await assertValidationSnapshot(
      fs,
      projectRoot,
      options.validationSnapshot,
      publishedSnapshotPaths,
    );
    for (const entry of entries) {
      const expected = entry.remove
        ? null
        : {
          identity: entry.temporaryIdentity,
          bytes: entry.bytes,
        };
      if (
        !(await snapshotMatches(
          fs,
          entry.target,
          expected,
          entry.ancestors,
        ))
      ) {
        const error = new Error(
          `Published validation output changed before final commit: ${entry.relativePath}`,
        );
        error.code = "E_VALIDATION_TRANSACTION_DRIFT";
        error.recoveryPaths = [entry.target];
        throw error;
      }
    }
  } catch (error) {
    const recoveryErrors = [];
    const recoveryPaths = new Set(error.recoveryPaths ?? []);
    for (const entry of [...entries].reverse()) {
      try {
        if (entry.published) {
          const recoveryPath = `${entry.target}.${nonce}.published-recovery`;
          await guardedRename(
            fs,
            entry.target,
            recoveryPath,
            entry.ancestors,
          );
          recoveryPaths.add(recoveryPath);
          const moved = await safeExistingFile(
            fs,
            recoveryPath,
            entry.ancestors,
          );
          if (
            !sameIdentity(moved.identity, entry.temporaryIdentity) ||
            !moved.bytes.equals(entry.bytes)
          ) {
            throw new Error(
              `A concurrent file was preserved during rollback: ${recoveryPath}`,
            );
          }
          entry.published = false;
        } else if (entry.temporaryPresent) {
          const recoveryPath =
            `${entry.temporary}.unpublished-recovery`;
          await guardedRename(
            fs,
            entry.temporary,
            recoveryPath,
            entry.ancestors,
          );
          recoveryPaths.add(recoveryPath);
          entry.temporaryPresent = false;
        }
        if (entry.backedUp) {
          const backup = await safeExistingFile(
            fs,
            entry.backup,
            entry.ancestors,
          );
          try {
            await guardedLink(
              fs,
              entry.backup,
              entry.target,
              entry.ancestors,
            );
            const restored = await safeExistingFile(
              fs,
              entry.target,
              entry.ancestors,
            );
            if (
              !sameIdentity(restored.identity, backup.identity) ||
              !restored.bytes.equals(backup.bytes)
            ) {
              throw new Error(
                `Restored transaction target changed: ${entry.target}`,
              );
            }
          } catch (restoreError) {
            recoveryPaths.add(entry.backup);
            throw restoreError;
          }
          recoveryPaths.add(entry.backup);
          entry.backedUp = false;
        }
      } catch (recoveryError) {
        recoveryErrors.push(
          recoveryError instanceof Error
            ? recoveryError.message
            : String(recoveryError),
        );
      }
    }
    if (recoveryErrors.length > 0) error.recoveryErrors = recoveryErrors;
    error.recoveryPaths = [...recoveryPaths];
    throw error;
  }

  const cleanupPaths = [];
  for (const entry of entries) {
    if (!entry.backedUp) continue;
    try {
      const backup = await safeExistingFile(
        fs,
        entry.backup,
        entry.ancestors,
      );
      if (
        !sameIdentity(
          backup.identity,
          entry.priorSnapshot?.identity,
        ) ||
        !backup.bytes.equals(entry.priorSnapshot?.bytes)
      ) {
        throw new Error(
          `Transaction cleanup retained a changed backup: ${entry.backup}`,
        );
      }
      await removeIfOwned(
        fs,
        entry.backup,
        backup.identity,
        entry.ancestors,
        backup.bytes,
      );
    } catch (error) {
      cleanupPaths.push(
        ...(error?.recoveryPaths ?? [entry.backup]),
      );
    }
  }
  return { report, cleanupPaths };
}
