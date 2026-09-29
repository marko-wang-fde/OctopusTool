import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  readlink,
  readdir,
  readFile,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import {
  computeSkillTreeHash,
  compareSkillSnapshots,
  snapshotSkillTree,
} from "./file-snapshot.js";
import {
  capturePathState,
  claimAndVerify,
  deleteClaimedIfUnchanged,
  samePathContent,
  samePathState,
} from "./path-state.js";
import {
  verifyInstalledTarget,
  verifyInstallManifest,
} from "./discovery-check.js";

export class InstallTransactionError extends Error {
  constructor(message, cause, recoveryPaths = []) {
    super(message, { cause });
    this.name = "InstallTransactionError";
    this.code = "E_INSTALL_TRANSACTION";
    this.recoveryPaths = recoveryPaths;
  }
}

async function maybeLstat(pathValue) {
  try {
    return await lstat(pathValue);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function invokeHook(hooks, name, data) {
  if (hooks?.[name]) await hooks[name](data);
}

function manifestFor({
  installedAt,
  mode,
  plan,
  sourceMetadata,
  sourcePath,
  sourceSnapshot,
}) {
  return {
    schema_version: 1,
    target: plan.id,
    mode,
    target_path: plan.path,
    source_path: sourcePath,
    source_commit: sourceMetadata.source_commit,
    source_dirty: sourceMetadata.source_dirty,
    source_tree_hash: sourceSnapshot.source_tree_hash,
    installed_at: installedAt,
    files: sourceSnapshot.files,
  };
}

async function copySnapshot(sourcePath, destination, snapshot) {
  await mkdir(destination, { mode: 0o700 });
  for (const [relativePath, entry] of Object.entries(snapshot.files)) {
    const sourceFile = path.join(sourcePath, relativePath);
    const destinationFile = path.join(destination, relativePath);
    await mkdir(path.dirname(destinationFile), { recursive: true });
    if (entry.type === "file") {
      await copyFile(sourceFile, destinationFile);
      await chmod(destinationFile, Number.parseInt(entry.mode, 8));
    } else {
      await symlink(entry.link_target, destinationFile);
    }
  }
  const copied = await snapshotSkillTree(destination);
  if (!compareSkillSnapshots(snapshot, copied).equal) {
    const error = new Error("Source changed while preparing copy.");
    error.code = "E_INSTALL_SOURCE_RACE";
    throw error;
  }
}

function rootIdentity(stat) {
  return {
    dev: stat.dev,
    ino: stat.ino,
    type: stat.isDirectory()
      ? "directory"
      : stat.isFile()
      ? "file"
      : stat.isSymbolicLink()
      ? "symlink"
      : "other",
  };
}

function sameRootIdentity(left, right) {
  return Boolean(
    left &&
    right &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.type === right.type
  );
}

function stateHasOwnedRoot(state, ownership) {
  const root = state?.entries?.[0];
  return Boolean(
    root &&
    root.path === "." &&
    sameRootIdentity(
      {
        dev: root.identity.dev,
        ino: root.identity.ino,
        type: root.type,
      },
      ownership.identity,
    )
  );
}

function isVerifiedPublication(state, entry) {
  return stateHasOwnedRoot(state, entry.ownership) &&
    samePathContent(state, entry.expectedContent);
}

async function assertOwnedRoot(livePath, ownership) {
  const current = await maybeLstat(livePath);
  if (!current || !sameRootIdentity(rootIdentity(current), ownership.identity)) {
    const error = new Error(`Published root changed: ${livePath}`);
    error.code = "E_INSTALL_RACE";
    throw error;
  }
}

async function cloneDirectoryChildren(
  sourcePath,
  destination,
  rootPath,
  ownership,
) {
  for (const child of await readdir(sourcePath)) {
    await assertOwnedRoot(rootPath, ownership);
    const sourceChild = path.join(sourcePath, child);
    const destinationChild = path.join(destination, child);
    const metadata = await lstat(sourceChild);
    if (metadata.isDirectory()) {
      await mkdir(destinationChild, { mode: metadata.mode & 0o777 });
      await cloneDirectoryChildren(
        sourceChild,
        destinationChild,
        rootPath,
        ownership,
      );
      await chmod(destinationChild, metadata.mode & 0o777);
    } else if (metadata.isFile()) {
      await copyFile(
        sourceChild,
        destinationChild,
        fsConstants.COPYFILE_EXCL,
      );
      await chmod(destinationChild, metadata.mode & 0o777);
    } else if (metadata.isSymbolicLink()) {
      await symlink(await readlink(sourceChild), destinationChild);
    } else {
      const error = new Error(`Unsupported object: ${sourceChild}`);
      error.code = "E_INSTALL_UNSUPPORTED_OBJECT";
      throw error;
    }
  }
}

async function exclusiveClone(sourcePath, livePath, token, onClaim) {
  const sourceState = await capturePathState(sourcePath);
  const metadata = await lstat(sourcePath);
  if (metadata.isFile()) {
    await link(sourcePath, livePath);
    const ownership = {
      identity: rootIdentity(await lstat(livePath)),
      type: "file",
    };
    await onClaim({ ownership, sourceState });
    return { ownership, sourceState };
  }
  if (metadata.isSymbolicLink()) {
    await symlink(await readlink(sourcePath), livePath);
    const ownership = {
      identity: rootIdentity(await lstat(livePath)),
      type: "symlink",
    };
    await onClaim({ ownership, sourceState });
    return { ownership, sourceState };
  }
  if (!metadata.isDirectory()) {
    const error = new Error(`Unsupported object: ${sourcePath}`);
    error.code = "E_INSTALL_UNSUPPORTED_OBJECT";
    throw error;
  }

  await mkdir(livePath, { mode: metadata.mode & 0o777 });
  const marker = `.aiworker-install-claim-${token}`;
  const ownership = {
    identity: rootIdentity(await lstat(livePath)),
    marker,
    type: "directory",
  };
  await onClaim({ ownership, sourceState });
  await writeFile(path.join(livePath, marker), `${token}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await cloneDirectoryChildren(sourcePath, livePath, livePath, ownership);
  await assertOwnedRoot(livePath, ownership);
  await unlink(path.join(livePath, marker));
  await chmod(livePath, metadata.mode & 0o777);
  return { ownership, sourceState };
}

async function restoreClaim(claim, recoveryPaths, transactionHooks, token) {
  if (!claim) return;
  let restored;
  try {
    await invokeHook(transactionHooks, "beforeRestore", {
      livePath: claim.livePath,
      quarantinePath: claim.quarantinePath,
    });
    if (await maybeLstat(claim.livePath)) {
      recoveryPaths.push(claim.quarantinePath);
      return;
    }
    await exclusiveClone(
      claim.quarantinePath,
      claim.livePath,
      `${token}-restore`,
      ({ ownership, sourceState }) => {
        restored = {
          expectedContent: sourceState,
          kind: "restore",
          livePath: claim.livePath,
          ownership,
          state: null,
        };
      },
    );
    restored.state = await capturePathState(claim.livePath);
    if (!samePathContent(restored.state, claim.claimedState)) {
      await removeCommitted(restored, token, recoveryPaths);
      recoveryPaths.push(claim.quarantinePath);
      return;
    }
    if (!await deleteClaimedIfUnchanged(
      claim.quarantinePath,
      claim.claimedState,
    )) {
      recoveryPaths.push(claim.quarantinePath);
    }
    return;
  } catch {
    // The quarantine path is retained below for manual recovery.
  }
  if (restored) {
    await removeCommitted(restored, token, recoveryPaths);
  }
  recoveryPaths.push(claim.quarantinePath);
}

async function claimOld(
  livePath,
  quarantinePath,
  expectedState,
  transactionHooks,
  token,
) {
  const result = await claimAndVerify(livePath, quarantinePath, expectedState);
  const claim = {
    claimedState: result.claimed,
    expectedState,
    livePath,
    quarantinePath,
  };
  if (!result.matches) {
    const recoveryPaths = [];
    await restoreClaim(claim, recoveryPaths, transactionHooks, token);
    const error = new Error(`Live object changed while being claimed: ${livePath}`);
    error.code = "E_INSTALL_RACE";
    error.recoveryPaths = recoveryPaths;
    throw error;
  }
  return claim;
}

async function removeCommitted(entry, token, recoveryPaths) {
  let quarantinePath;
  try {
    const currentMetadata = await maybeLstat(entry.livePath);
    if (!currentMetadata) return true;
    if (!sameRootIdentity(
      rootIdentity(currentMetadata),
      entry.ownership.identity,
    )) {
      recoveryPaths.push(entry.livePath);
      return false;
    }
    quarantinePath = path.join(
      path.dirname(entry.livePath),
      `.aiworker-install-quarantine-${token}-rollback-${randomUUID()}`,
    );
    await rename(entry.livePath, quarantinePath);
    const claimedMetadata = await maybeLstat(quarantinePath);
    if (!claimedMetadata || !sameRootIdentity(
      rootIdentity(claimedMetadata),
      entry.ownership.identity,
    )) {
      recoveryPaths.push(quarantinePath);
      return false;
    }
    const claimed = await capturePathState(quarantinePath);
    const matches = entry.state
      ? samePathState(claimed, entry.state)
      : samePathContent(claimed, entry.expectedContent);
    if (matches && await deleteClaimedIfUnchanged(quarantinePath, claimed)) {
      return true;
    }
    recoveryPaths.push(quarantinePath);
    return false;
  } catch {
    recoveryPaths.push(quarantinePath ?? entry.livePath);
    return false;
  }
}

async function cleanPrepared(pathValue, token, recoveryPaths) {
  let quarantinePath;
  try {
    const state = await capturePathState(pathValue);
    if (!state) return;
    quarantinePath = path.join(
      path.dirname(pathValue),
      `.aiworker-install-quarantine-${token}-prepare-${randomUUID()}`,
    );
    const result = await claimAndVerify(pathValue, quarantinePath, state);
    if (
      !result.matches ||
      !await deleteClaimedIfUnchanged(quarantinePath, result.claimed)
    ) {
      recoveryPaths.push(quarantinePath);
    }
  } catch {
    recoveryPaths.push(quarantinePath ?? pathValue);
  }
}

export async function commitInstallTransaction({
  installedAt,
  mode,
  plans,
  sourceMetadata,
  sourcePath,
  sourceSnapshot,
  transactionHooks,
}) {
  const mutating = plans.filter(({ action }) => action !== "noop");
  if (mutating.length === 0) {
    return { action: "noop", recovery_paths: [] };
  }
  const token = randomUUID();
  const prepared = [];
  const oldClaims = [];
  const committed = [];
  const recoveryPaths = [];
  try {
    for (const plan of mutating) {
      plan.oldTargetState = plan.target_full_state ?? null;
      plan.oldManifestState = plan.manifest_full_state ?? null;
    }
    await invokeHook(transactionHooks, "prepare", {
      manifestPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.manifest_path])),
      targetPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.path])),
    });
    for (const plan of mutating) {
      await mkdir(path.dirname(plan.path), { recursive: true });
      await mkdir(path.dirname(plan.manifest_path), { recursive: true });
      const targetStage = path.join(
        path.dirname(plan.path),
        `.aiworker-install-prepare-${token}-${plan.id}-target`,
      );
      const manifestStage = path.join(
        path.dirname(plan.manifest_path),
        `.aiworker-install-prepare-${token}-${plan.id}-manifest`,
      );
      prepared.push({ manifestStage, plan, targetStage });
      if (mode === "copy") {
        await copySnapshot(sourcePath, targetStage, sourceSnapshot);
      } else {
        await symlink(sourcePath, targetStage);
      }
      const manifest = manifestFor({
        installedAt,
        mode,
        plan,
        sourceMetadata,
        sourcePath,
        sourceSnapshot,
      });
      await writeFile(
        manifestStage,
        `${JSON.stringify(manifest, null, 2)}\n`,
        { flag: "wx", mode: 0o600 },
      );
      prepared.at(-1).manifest = manifest;
    }

    for (const item of prepared) {
      const { plan } = item;
      const current = await capturePathState(plan.path);
      if (!samePathState(current, plan.oldTargetState)) {
        const error = new Error(`Target changed during prepare: ${plan.path}`);
        error.code = "E_INSTALL_RACE";
        throw error;
      }
      if (current) {
        const quarantinePath = path.join(
          path.dirname(plan.path),
          `.aiworker-install-quarantine-${token}-${plan.id}-target-old`,
        );
        oldClaims.push(await claimOld(
          plan.path,
          quarantinePath,
          current,
          transactionHooks,
          token,
        ));
      }
    }
    await invokeHook(transactionHooks, "beforeTargetPublish", {
      targetPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.path])),
    });
    for (const item of prepared) {
      const entry = {
        expectedContent: null,
        kind: "target",
        livePath: item.plan.path,
        ownership: null,
        state: null,
      };
      await exclusiveClone(
        item.targetStage,
        item.plan.path,
        token,
        ({ ownership, sourceState }) => {
          entry.expectedContent = sourceState;
          entry.ownership = ownership;
          committed.push(entry);
        },
      );
      await invokeHook(transactionHooks, "afterTargetPublish", {
        targetPath: item.plan.path,
      });
      const publishedState = await capturePathState(item.plan.path);
      if (!isVerifiedPublication(publishedState, entry)) {
        const error = new Error(
          `Published target changed: ${item.plan.path}`,
        );
        error.code = "E_INSTALL_RACE";
        throw error;
      }
      entry.state = publishedState;
    }
    await invokeHook(transactionHooks, "targetCommit", {
      targetPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.path])),
    });

    for (const item of prepared) {
      const { plan } = item;
      const current = await capturePathState(plan.manifest_path);
      if (!samePathState(current, plan.oldManifestState)) {
        const error = new Error(
          `Manifest changed during prepare: ${plan.manifest_path}`,
        );
        error.code = "E_INSTALL_RACE";
        throw error;
      }
      if (current) {
        const quarantinePath = path.join(
          path.dirname(plan.manifest_path),
          `.aiworker-install-quarantine-${token}-${plan.id}-manifest-old`,
        );
        oldClaims.push(
          await claimOld(
            plan.manifest_path,
            quarantinePath,
            current,
            transactionHooks,
            token,
          ),
        );
      }
    }
    await invokeHook(transactionHooks, "beforeManifestPublish", {
      manifestPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.manifest_path])),
    });
    for (const item of prepared) {
      const entry = {
        expectedContent: null,
        kind: "manifest",
        livePath: item.plan.manifest_path,
        ownership: null,
        state: null,
      };
      await exclusiveClone(
        item.manifestStage,
        item.plan.manifest_path,
        token,
        ({ ownership, sourceState }) => {
          entry.expectedContent = sourceState;
          entry.ownership = ownership;
          committed.push(entry);
        },
      );
      await invokeHook(transactionHooks, "afterManifestPublish", {
        manifestPath: item.plan.manifest_path,
      });
      const publishedState = await capturePathState(item.plan.manifest_path);
      if (!isVerifiedPublication(publishedState, entry)) {
        const error = new Error(
          `Published manifest changed: ${item.plan.manifest_path}`,
        );
        error.code = "E_INSTALL_RACE";
        throw error;
      }
      entry.state = publishedState;
    }
    await invokeHook(transactionHooks, "manifestCommit", {
      manifestPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.manifest_path])),
      targetPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.path])),
    });
    await invokeHook(transactionHooks, "discoveryCheck", {
      manifestPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.manifest_path])),
      targetPaths: Object.fromEntries(plans.map((plan) =>
        [plan.id, plan.path])),
    });
    for (const item of prepared) {
      await verifyInstalledTarget({
        mode,
        sourcePath,
        sourceSnapshot,
        targetId: item.plan.id,
        targetPath: item.plan.path,
      });
      await verifyInstallManifest({
        manifest: item.manifest,
        manifestPath: item.plan.manifest_path,
        mode,
        sourcePath,
        sourceSnapshot,
        targetId: item.plan.id,
        targetPath: item.plan.path,
      });
    }
    for (const plan of plans.filter(({ action }) => action === "noop")) {
      await verifyInstalledTarget({
        mode,
        sourcePath,
        sourceSnapshot,
        targetId: plan.id,
        targetPath: plan.path,
      });
      await verifyInstallManifest({
        allowDiagnosticDrift: mode === "symlink",
        manifest: plan.existing_manifest,
        manifestPath: plan.manifest_path,
        mode,
        sourcePath,
        sourceSnapshot,
        targetId: plan.id,
        targetPath: plan.path,
      });
    }

    const quarantinePaths = oldClaims.map((claim) => ({
      kind: claim.livePath.endsWith(".json") ? "manifest" : "target",
      path: claim.quarantinePath,
    }));
    await invokeHook(transactionHooks, "cleanup", { quarantinePaths });
    for (const claim of oldClaims) {
      try {
        if (!await deleteClaimedIfUnchanged(
          claim.quarantinePath,
          claim.claimedState,
          {
            hooks: {
              afterInventoryVerified: (details) =>
                invokeHook(
                  transactionHooks,
                  "afterInstallCleanupInventoryVerified",
                  details,
                ),
            },
          },
        )) {
          recoveryPaths.push(claim.quarantinePath);
        }
      } catch {
        recoveryPaths.push(claim.quarantinePath);
      }
    }
    for (const item of prepared) {
      await cleanPrepared(item.targetStage, token, recoveryPaths);
      await cleanPrepared(item.manifestStage, token, recoveryPaths);
    }
    return { action: "committed", recovery_paths: recoveryPaths };
  } catch (cause) {
    for (const entry of [...committed].reverse()) {
      await removeCommitted(entry, token, recoveryPaths);
    }
    for (const claim of [...oldClaims].reverse()) {
      await restoreClaim(claim, recoveryPaths, transactionHooks, token);
    }
    for (const item of prepared) {
      await cleanPrepared(item.targetStage, token, recoveryPaths);
      await cleanPrepared(item.manifestStage, token, recoveryPaths);
    }
    recoveryPaths.push(...(cause.recoveryPaths ?? []));
    throw new InstallTransactionError(
      "Installation transaction failed and was rolled back.",
      cause,
      [...new Set(recoveryPaths)],
    );
  }
}

function validFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) return false;
  const paths = Object.keys(files);
  const sorted = [...paths].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right))
  );
  if (JSON.stringify(paths) !== JSON.stringify(sorted)) return false;
  return paths.every((relativePath) => {
    const entry = files[relativePath];
    const keys = entry && Object.keys(entry).sort();
    return relativePath.length > 0 &&
      entry &&
      JSON.stringify(keys) === JSON.stringify([
        "link_target",
        "mode",
        "sha256",
        "type",
      ]) &&
      (entry.type === "file" || entry.type === "symlink") &&
      /^0[0-7]{3}$/u.test(entry.mode ?? "") &&
      (
        entry.type === "file"
          ? /^[a-f0-9]{64}$/u.test(entry.sha256 ?? "") &&
            entry.link_target === null
          : entry.sha256 === null && typeof entry.link_target === "string"
      );
  });
}

function validManifest(manifest, expectedTarget) {
  const expectedKeys = [
    "files",
    "installed_at",
    "mode",
    "schema_version",
    "source_commit",
    "source_dirty",
    "source_path",
    "source_tree_hash",
    "target",
    "target_path",
  ];
  return Boolean(
    manifest &&
    JSON.stringify(Object.keys(manifest).sort()) ===
      JSON.stringify(expectedKeys) &&
    manifest.schema_version === 1 &&
    manifest.target === expectedTarget &&
    (manifest.mode === "copy" || manifest.mode === "symlink") &&
    path.isAbsolute(manifest.target_path ?? "") &&
    path.isAbsolute(manifest.source_path ?? "") &&
    (
      manifest.source_commit === null ||
      /^[a-f0-9]{40,64}$/u.test(manifest.source_commit ?? "")
    ) &&
    typeof manifest.source_dirty === "boolean" &&
    /^[a-f0-9]{64}$/u.test(manifest.source_tree_hash ?? "") &&
    typeof manifest.installed_at === "string" &&
    new Date(manifest.installed_at).toISOString() === manifest.installed_at &&
    validFiles(manifest.files) &&
    computeSkillTreeHash(manifest.files) === manifest.source_tree_hash
  );
}

export async function readManifestState(manifestPath, expectedTarget) {
  const state = await capturePathState(manifestPath);
  if (!state) {
    return { exists: false, manifest: null, state: null, valid: true };
  }
  const metadata = await lstat(manifestPath);
  if (!metadata.isFile()) {
    return { exists: true, manifest: null, state, valid: false };
  }
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    return {
      exists: true,
      manifest: validManifest(manifest, expectedTarget) ? manifest : null,
      state,
      valid: validManifest(manifest, expectedTarget),
    };
  } catch {
    return { exists: true, manifest: null, state, valid: false };
  }
}
