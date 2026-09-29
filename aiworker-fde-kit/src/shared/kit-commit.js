import {
  lstat as defaultLstat,
  readFile as defaultReadFile,
  realpath as defaultRealpath,
} from "node:fs/promises";
import path from "node:path";

import {
  canonicalSkillPaths,
  compareSkillSnapshots,
  computeSkillTreeHash,
  snapshotSkillTree,
} from "../install/file-snapshot.js";
import { spawnCommand } from "../assembly/cli-runner.js";

const INSTALL_MANIFEST_KEYS = [
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
const INSTALL_TARGETS = [
  {
    id: "codex",
    relativePath: ".agents/skills/design-aiworker-solutions",
  },
  {
    id: "claude-code",
    relativePath: ".claude/skills/design-aiworker-solutions",
  },
];

async function readOptional(fs, filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
}

function validGitReference(reference) {
  return (
    typeof reference === "string" &&
    reference.startsWith("refs/") &&
    !path.isAbsolute(reference) &&
    !reference.includes("\\") &&
    reference.split("/").every((part) =>
      part.length > 0 && part !== "." && part !== "..") &&
    /^[A-Za-z0-9._/-]+$/u.test(reference)
  );
}

async function resolveCheckoutCommit(kitRoot, fs) {
  const dotGit = path.join(kitRoot, ".git");
  const metadata = await fs.lstat(dotGit).catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (!metadata) return { found: false, commit: null };
  let gitDirectory = dotGit;
  if (metadata.isFile()) {
    const pointer = (await fs.readFile(dotGit, "utf8")).trim()
      .match(/^gitdir:\s+(.+)$/u);
    if (!pointer) throw new Error("Kit worktree git pointer is invalid.");
    gitDirectory = path.resolve(kitRoot, pointer[1]);
  } else if (!metadata.isDirectory()) {
    throw new Error("Kit .git authority is not a file or directory.");
  }
  const head = (await fs.readFile(path.join(gitDirectory, "HEAD"), "utf8"))
    .trim();
  if (/^[a-f0-9]{40}$/u.test(head)) {
    return { found: true, commit: head };
  }
  const reference = head.match(/^ref:\s+(.+)$/u)?.[1];
  if (!validGitReference(reference)) {
    throw new Error("Kit HEAD reference is invalid.");
  }
  const commonPointer = await readOptional(
    fs,
    path.join(gitDirectory, "commondir"),
  );
  const commonDirectory = commonPointer
    ? path.resolve(gitDirectory, commonPointer.trim())
    : gitDirectory;
  for (const root of new Set([gitDirectory, commonDirectory])) {
    const loose = await readOptional(fs, path.join(root, reference));
    if (loose && /^[a-f0-9]{40}$/u.test(loose.trim())) {
      return { found: true, commit: loose.trim() };
    }
  }
  const packed = await readOptional(
    fs,
    path.join(commonDirectory, "packed-refs"),
  );
  for (const line of packed?.split(/\r?\n/gu) ?? []) {
    const [commit, name] = line.split(" ");
    if (name === reference && /^[a-f0-9]{40}$/u.test(commit)) {
      return { found: true, commit };
    }
  }
  throw new Error("Kit commit could not be resolved from checkout metadata.");
}

async function checkoutIsClean(kitRoot, runGitStatus) {
  const canonical = canonicalSkillPaths();
  let result;
  try {
    result = await runGitStatus([
      "-C",
      kitRoot,
      "status",
      "--porcelain=v1",
      "--untracked-files=normal",
      "--",
      ...canonical.exact_files,
      ...canonical.roots,
    ]);
  } catch {
    return false;
  }
  return (
    result?.exitCode === 0 &&
    Buffer.isBuffer(result.stdout) &&
    result.stdout.length === 0
  );
}

async function defaultGitStatus(args) {
  return spawnCommand("git", args, { shell: false });
}

function validFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) return false;
  const paths = Object.keys(files);
  const sorted = [...paths].sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (JSON.stringify(paths) !== JSON.stringify(sorted)) return false;
  return paths.every((relativePath) => {
    const entry = files[relativePath];
    return (
      relativePath.length > 0 &&
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      JSON.stringify(Object.keys(entry).sort()) ===
        JSON.stringify(["link_target", "mode", "sha256", "type"]) &&
      (entry.type === "file" || entry.type === "symlink") &&
      /^0[0-7]{3}$/u.test(entry.mode ?? "") &&
      (
        entry.type === "file"
          ? /^[a-f0-9]{64}$/u.test(entry.sha256 ?? "") &&
            entry.link_target === null
          : entry.sha256 === null &&
            typeof entry.link_target === "string"
      )
    );
  });
}

function validCleanCopyManifest(manifest, target) {
  return Boolean(
    manifest &&
    typeof manifest === "object" &&
    !Array.isArray(manifest) &&
    JSON.stringify(Object.keys(manifest).sort()) ===
      JSON.stringify(INSTALL_MANIFEST_KEYS) &&
    manifest.schema_version === 1 &&
    manifest.target === target &&
    manifest.mode === "copy" &&
    path.isAbsolute(manifest.target_path ?? "") &&
    path.isAbsolute(manifest.source_path ?? "") &&
    /^[a-f0-9]{40}$/u.test(manifest.source_commit ?? "") &&
    manifest.source_dirty === false &&
    /^[a-f0-9]{64}$/u.test(manifest.source_tree_hash ?? "") &&
    typeof manifest.installed_at === "string" &&
    new Date(manifest.installed_at).toISOString() === manifest.installed_at &&
    validFiles(manifest.files) &&
    computeSkillTreeHash(manifest.files) === manifest.source_tree_hash
  );
}

function configHome(env) {
  const candidate = env.XDG_CONFIG_HOME ||
    (path.isAbsolute(env.HOME ?? "") ? path.join(env.HOME, ".config") : null);
  return candidate && path.isAbsolute(candidate) ? candidate : null;
}

async function standardInstallTarget(kitRoot, env, fs) {
  const configuration = configHome(env);
  if (!configuration || !path.isAbsolute(env.HOME ?? "")) return null;
  const targetPath = path.resolve(kitRoot);
  const resolvedTargetPath = await fs.realpath(targetPath);
  for (const target of INSTALL_TARGETS) {
    const expectedPath = path.join(env.HOME, target.relativePath);
    const expectedMetadata = await fs.lstat(expectedPath)
      .catch(() => null);
    if (
      !expectedMetadata ||
      expectedMetadata.isSymbolicLink() ||
      !expectedMetadata.isDirectory()
    ) {
      continue;
    }
    const resolvedExpected = await fs.realpath(expectedPath)
      .catch(() => null);
    if (resolvedExpected === resolvedTargetPath) {
      return {
        id: target.id,
        manifestPath: path.join(
          configuration,
          `aiworker-fde-kit/installations/${target.id}.json`,
        ),
        targetPath,
      };
    }
  }
  return null;
}

async function resolveInstalledCopyCommit(install, fs) {
  const metadata = await fs.lstat(install.manifestPath).catch((error) => {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  });
  if (!metadata || metadata.isSymbolicLink() || !metadata.isFile()) return null;
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(install.manifestPath, "utf8"));
  } catch {
    return null;
  }
  if (!validCleanCopyManifest(manifest, install.id)) return null;
  const manifestTargetMetadata = await fs.lstat(manifest.target_path)
    .catch(() => null);
  if (
    !manifestTargetMetadata ||
    manifestTargetMetadata.isSymbolicLink() ||
    !manifestTargetMetadata.isDirectory()
  ) {
    return null;
  }
  const resolvedManifestTarget = await fs.realpath(manifest.target_path)
    .catch(() => null);
  const resolvedInstallTarget = await fs.realpath(install.targetPath);
  if (resolvedManifestTarget !== resolvedInstallTarget) return null;
  const currentSnapshot = await snapshotSkillTree(install.targetPath);
  const recordedSnapshot = {
    files: manifest.files,
    source_tree_hash: manifest.source_tree_hash,
  };
  if (
    currentSnapshot.source_tree_hash !== manifest.source_tree_hash ||
    !compareSkillSnapshots(recordedSnapshot, currentSnapshot).equal
  ) {
    return null;
  }
  return manifest.source_commit;
}

async function rejectInstalledGitMetadata(kitRoot, fs) {
  const metadata = await fs.lstat(path.join(kitRoot, ".git"))
    .catch((error) => {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
      throw error;
    });
  if (metadata) {
    throw new Error(
      "A standard installed copy target must not contain .git metadata.",
    );
  }
}

export async function resolveAuthoritativeKitCommit(options = {}) {
  const kitRoot = path.resolve(options.kitRoot);
  const fs = {
    lstat: defaultLstat,
    readFile: defaultReadFile,
    realpath: defaultRealpath,
    ...options.fs,
  };
  const env = options.env ?? process.env;
  const install = await standardInstallTarget(kitRoot, env, fs);
  if (install) {
    await rejectInstalledGitMetadata(kitRoot, fs);
    return resolveInstalledCopyCommit(install, fs);
  }
  const checkout = await resolveCheckoutCommit(kitRoot, fs);
  if (!checkout.found) return null;
  if (!await checkoutIsClean(
    kitRoot,
    options.runGitStatus ?? defaultGitStatus,
  )) {
    return null;
  }
  return checkout.commit;
}
