import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { compareSkillSnapshots, snapshotSkillTree } from "./file-snapshot.js";

export class InstallDiscoveryError extends Error {
  constructor(code, targetPath, message) {
    super(message);
    this.name = "InstallDiscoveryError";
    this.code = code;
    this.path = targetPath;
  }
}

async function requireRegularFile(targetPath, relativePath) {
  try {
    const metadata = await stat(path.join(targetPath, relativePath));
    if (!metadata.isFile()) throw new Error("not a regular file");
  } catch {
    throw new InstallDiscoveryError(
      "E_INSTALL_DISCOVERY_LAYOUT",
      targetPath,
      `Installed ${relativePath} is missing or unreadable.`,
    );
  }
}

export async function verifyInstalledTarget({
  mode,
  sourcePath,
  sourceSnapshot,
  targetId,
  targetPath,
}) {
  await requireRegularFile(targetPath, "SKILL.md");
  if (targetId === "codex") {
    await requireRegularFile(targetPath, "agents/openai.yaml");
  }
  if (mode === "symlink") {
    let resolved;
    try {
      resolved = await realpath(targetPath);
    } catch {
      throw new InstallDiscoveryError(
        "E_INSTALL_DISCOVERY_SOURCE",
        targetPath,
        "Installed symlink is broken.",
      );
    }
    if (resolved !== sourcePath) {
      throw new InstallDiscoveryError(
        "E_INSTALL_DISCOVERY_SOURCE",
        targetPath,
        "Installed symlink does not resolve to the source realpath.",
      );
    }
  }
  const current = await snapshotSkillTree(
    mode === "symlink" ? sourcePath : targetPath,
  );
  if (!compareSkillSnapshots(sourceSnapshot, current).equal) {
    throw new InstallDiscoveryError(
      "E_INSTALL_DISCOVERY_CONTENT",
      targetPath,
      "Installed files do not match the prepared source snapshot.",
    );
  }
}

export async function verifyInstallManifest({
  manifestPath,
  manifest,
  mode,
  sourcePath,
  sourceSnapshot,
  targetId,
  targetPath,
  allowDiagnosticDrift = false,
}) {
  let disk;
  try {
    disk = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new InstallDiscoveryError(
      "E_INSTALL_DISCOVERY_MANIFEST",
      manifestPath,
      `Install manifest cannot be read: ${error.message}`,
    );
  }
  if (
    JSON.stringify(disk) !== JSON.stringify(manifest) ||
    disk.target !== targetId ||
    disk.mode !== mode ||
    disk.target_path !== targetPath ||
    disk.source_path !== sourcePath ||
    (!allowDiagnosticDrift &&
      disk.source_tree_hash !== sourceSnapshot.source_tree_hash)
  ) {
    throw new InstallDiscoveryError(
      "E_INSTALL_DISCOVERY_MANIFEST",
      manifestPath,
      "Install manifest does not match the installed layout.",
    );
  }
}
