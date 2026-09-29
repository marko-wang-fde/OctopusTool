import { lstat, readlink, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { commandResult, issue } from "../shared/result.js";
import {
  compareSkillSnapshots,
  snapshotSkillTree,
} from "./file-snapshot.js";
import { capturePathState } from "./path-state.js";

async function targetState(targetPath) {
  try {
    const metadata = await lstat(targetPath);
    return { exists: true, metadata };
  } catch (error) {
    if (error.code === "ENOENT") return { exists: false, metadata: null };
    throw error;
  }
}

function identity(metadata) {
  return metadata
    ? {
        dev: metadata.dev,
        ino: metadata.ino,
        mode: metadata.mode,
        size: metadata.size,
      }
    : null;
}

function blocker(code, targetPath, message, details = {}) {
  return issue("BLOCKER", code, targetPath, message, details);
}

async function inspectSymlink(targetPath, sourcePath) {
  const raw = await readlink(targetPath);
  const resolved = path.resolve(path.dirname(targetPath), raw);
  let broken = false;
  try {
    await stat(targetPath);
  } catch (error) {
    if (error.code === "ENOENT") broken = true;
    else throw error;
  }
  return {
    broken,
    matches: !broken && await realpath(targetPath) === sourcePath,
    resolved: broken ? resolved : await realpath(targetPath),
  };
}

async function targetPlan(context, targetSpec) {
  const { mode, replace, sourcePath, sourceSnapshot, update } = context;
  const state = await targetState(targetSpec.path);
  const fullState = await capturePathState(targetSpec.path);
  const manifest = targetSpec.manifest;

  if (replace) {
    return {
      action: "replace",
      existing_manifest: manifest,
      id: targetSpec.id,
      manifest_path: targetSpec.manifestPath,
      path: targetSpec.path,
      target_exists: state.exists,
      target_full_state: fullState,
      target_identity: identity(state.metadata),
      manifest_full_state: targetSpec.manifestState ?? null,
    };
  }
  if (update && (!state.exists || !manifest)) {
    return {
      issue: blocker(
        "B_INSTALL_NOT_INSTALLED",
        targetSpec.path,
        "Update requires an existing target and valid target manifest.",
      ),
    };
  }
  if (!state.exists && !manifest) {
    return {
      action: "install",
      existing_manifest: null,
      id: targetSpec.id,
      manifest_path: targetSpec.manifestPath,
      path: targetSpec.path,
      target_exists: false,
      target_full_state: null,
      target_identity: null,
      manifest_full_state: targetSpec.manifestState ?? null,
    };
  }
  if (state.exists && !manifest) {
    return {
      issue: blocker(
        "B_INSTALL_FOREIGN_TARGET",
        targetSpec.path,
        "The target exists without a valid matching install manifest.",
      ),
    };
  }
  if (!state.exists && manifest) {
    return {
      issue: blocker(
        "B_INSTALL_ORPHAN_MANIFEST",
        targetSpec.manifestPath,
        "The install manifest exists but its target is absent.",
      ),
    };
  }
  if (
    manifest.target !== targetSpec.id ||
    manifest.target_path !== targetSpec.path
  ) {
    return {
      issue: blocker(
        "B_INSTALL_MANIFEST_MISMATCH",
        targetSpec.manifestPath,
        "The install manifest does not match this target.",
      ),
    };
  }
  if (manifest.source_path !== sourcePath) {
    return {
      issue: blocker(
        "B_INSTALL_SOURCE_CHANGED",
        targetSpec.path,
        "The source realpath changed; use --replace explicitly.",
      ),
    };
  }
  if (manifest.mode !== mode) {
    return {
      issue: blocker(
        "B_INSTALL_MODE_CHANGED",
        targetSpec.path,
        "The requested mode differs; use --replace explicitly.",
      ),
    };
  }

  if (mode === "symlink") {
    if (!state.metadata.isSymbolicLink()) {
      return {
        issue: blocker(
          "B_INSTALL_TYPE_CHANGED",
          targetSpec.path,
          "The managed symlink was replaced by another object.",
        ),
      };
    }
    const link = await inspectSymlink(targetSpec.path, sourcePath);
    if (link.broken) {
      return {
        issue: blocker(
          "B_INSTALL_BROKEN_SYMLINK",
          targetSpec.path,
          "The managed symlink is broken.",
        ),
      };
    }
    if (!link.matches) {
      return {
        issue: blocker(
          "B_INSTALL_OTHER_SOURCE",
          targetSpec.path,
          "The managed symlink points to another source.",
          { actual_source: link.resolved },
        ),
      };
    }
    const issues = [];
    if (manifest.source_tree_hash !== sourceSnapshot.source_tree_hash) {
      issues.push(issue(
        "WARNING",
        "W_INSTALL_SYMLINK_SOURCE_CHANGED",
        targetSpec.path,
        "The live symlink source differs from the installation snapshot.",
      ));
    }
    return {
      action: "noop",
      existing_manifest: manifest,
      id: targetSpec.id,
      issues,
      manifest_path: targetSpec.manifestPath,
      path: targetSpec.path,
      target_exists: true,
      target_full_state: fullState,
      target_identity: identity(state.metadata),
      manifest_full_state: targetSpec.manifestState ?? null,
    };
  }

  if (!state.metadata.isDirectory()) {
    return {
      issue: blocker(
        "B_INSTALL_TYPE_CHANGED",
        targetSpec.path,
        "The managed copy is not a directory.",
      ),
    };
  }
  const currentSnapshot = await snapshotSkillTree(targetSpec.path);
  const installedSnapshot = {
    files: manifest.files,
    source_tree_hash: manifest.source_tree_hash,
  };
  const comparison = compareSkillSnapshots(installedSnapshot, currentSnapshot);
  if (!comparison.equal) {
    return {
      issue: blocker(
        "B_INSTALL_USER_MODIFIED",
        targetSpec.path,
        "The managed copy has local changes.",
        { changes: comparison.changes },
      ),
    };
  }
  if (manifest.source_tree_hash === sourceSnapshot.source_tree_hash) {
    return {
      action: "noop",
      existing_manifest: manifest,
      id: targetSpec.id,
      issues: [],
      manifest_path: targetSpec.manifestPath,
      path: targetSpec.path,
      target_exists: true,
      target_full_state: fullState,
      target_identity: identity(state.metadata),
      target_snapshot_current: currentSnapshot,
      manifest_full_state: targetSpec.manifestState ?? null,
    };
  }
  if (!update) {
    return {
      issue: blocker(
        "B_INSTALL_UPDATE_REQUIRED",
        targetSpec.path,
        "The copy source changed; rerun with --update.",
      ),
    };
  }
  return {
    action: "update",
    existing_manifest: manifest,
    id: targetSpec.id,
    issues: [],
    manifest_path: targetSpec.manifestPath,
    path: targetSpec.path,
    target_exists: true,
    target_full_state: fullState,
    target_identity: identity(state.metadata),
    target_snapshot_current: currentSnapshot,
    manifest_full_state: targetSpec.manifestState ?? null,
  };
}

export async function preflightInstall(context) {
  const outcomes = [];
  for (const targetSpec of context.targetSpecs) {
    outcomes.push(await targetPlan(context, targetSpec));
  }
  const issues = outcomes.flatMap((outcome) => [
    ...(outcome.issue ? [outcome.issue] : []),
    ...(outcome.issues ?? []),
  ]);
  if (outcomes.some(({ issue: found }) => found)) {
    return {
      ...commandResult(issues),
      action: "blocked",
      plans: [],
    };
  }
  const plans = outcomes;
  const mutating = plans.filter(({ action }) => action !== "noop");
  const action = mutating.length === 0
    ? "noop"
    : context.replace
      ? "replace"
      : mutating.some(({ action: value }) => value === "update")
        ? "update"
        : "install";
  return { ...commandResult(issues), action, plans };
}
