import { constants as fileConstants } from "node:fs";
import path from "node:path";

import { NamingError, suggestProjectIdentity } from "./naming.js";
import {
  MANIFEST_NAME,
  assertDirectory,
  assertDirectoryIdentity,
  blocker,
  createDependencies,
  errorText,
  isoTime,
  loadTemplateInventory,
  loadTemplateManifest,
  makeResult,
  pathExists,
  projectTransactionLockPath,
  readRegularFileNoFollow,
  serializeYaml,
  warning,
} from "./project-runtime.js";

export { resumeProject } from "./resume.js";

function initializationIssue(
  error,
  code = "B_INITIALIZATION_RUNTIME",
  details = {},
) {
  return blocker(code, ".", "Project initialization failed.", {
    error: errorText(error),
    ...details,
  });
}

function initializationData(identity, options) {
  const sourceMode = options.sourceMode ?? "copy";
  const data = {
    name: identity.name,
    slug: identity.slug,
    absolute_path: identity.absolutePath,
    entry_mode: options.mode,
    source_mode: sourceMode,
    requires_confirmation: !options.confirm,
  };
  if (sourceMode === "reference") {
    data.package_implication =
      "Referenced source files are not portable and are not included in project packages.";
  }
  return data;
}

function validateInitializationOptions(options) {
  if (!["new", "materials"].includes(options.mode)) {
    return "mode must be new or materials.";
  }
  if (!["copy", "reference"].includes(options.sourceMode ?? "copy")) {
    return "sourceMode must be copy or reference.";
  }
  if (
    options.mode === "materials" &&
    (!Array.isArray(options.sources) || options.sources.length === 0)
  ) {
    return "materials mode requires at least one source.";
  }
  if (options.sources !== undefined && !Array.isArray(options.sources)) {
    return "sources must be an array.";
  }
  return null;
}

async function readRegularSource(sourcePath, deps) {
  const absolutePath = path.resolve(sourcePath);
  let handle;
  try {
    const initial = await deps.fs.lstat(absolutePath);
    if (initial.isSymbolicLink() || !initial.isFile()) {
      throw new Error("Source is not a regular non-symbolic-link file.");
    }
    handle = await deps.fs.open(
      absolutePath,
      fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW,
    );
    const opened = await handle.stat();
    const current = await deps.fs.lstat(absolutePath);
    if (
      !opened.isFile() ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      opened.dev !== current.dev ||
      opened.ino !== current.ino
    ) {
      throw new Error("Source changed while it was being opened.");
    }
    const bytes = await handle.readFile();
    return {
      absolutePath,
      bytes,
      sha256: deps.hashBytes(bytes),
    };
  } finally {
    await handle?.close();
  }
}

function mediaType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".txt":
      return "text/plain";
    case ".md":
      return "text/markdown";
    case ".json":
      return "application/json";
    case ".yaml":
    case ".yml":
      return "application/yaml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function collisionSafeNames(sources) {
  const used = new Set();
  return sources.map((source) => {
    const basename = path.basename(source.absolutePath);
    const extension = path.extname(basename);
    const stem = basename.slice(0, basename.length - extension.length);
    let candidate = basename;
    let suffix = 2;
    while (used.has(candidate.normalize("NFC").toLowerCase())) {
      candidate = `${stem}-${suffix}${extension}`;
      suffix += 1;
    }
    used.add(candidate.normalize("NFC").toLowerCase());
    return candidate;
  });
}

async function prepareSources(options, deps, recordedAt) {
  const sourceMode = options.sourceMode ?? "copy";
  const inputs = await Promise.all(
    (options.sources ?? []).map((source) => readRegularSource(source, deps)),
  );
  inputs.sort((left, right) =>
    Buffer.compare(
      Buffer.from(left.absolutePath, "utf8"),
      Buffer.from(right.absolutePath, "utf8"),
    ),
  );
  const copyNames = collisionSafeNames(inputs);

  return inputs.map((input, index) => {
    const base = {
      id: `source.file_${index + 1}`,
      title: path.basename(input.absolutePath),
      kind: "file",
      source_mode: sourceMode,
      status: sourceMode === "copy" ? "copied" : "reference-only",
      portable: sourceMode === "copy",
      original_path: input.absolutePath,
      sha256: input.sha256,
      media_type: mediaType(input.absolutePath),
      read_status: "read",
    };
    if (sourceMode === "copy") {
      base.copy_path = `inputs/source-files/${copyNames[index]}`;
      base.copied_at = recordedAt;
    }
    return { input, record: base };
  });
}

async function assertOwnedDirectory(directory, identity, deps) {
  return assertDirectoryIdentity(deps.fs, directory, identity);
}

async function loadPublicationFiles(
  inventory,
  preparedSources,
  projectManifest,
  deps,
) {
  const files = new Map();
  for (const relativePath of inventory.fixed) {
    if (relativePath === MANIFEST_NAME) continue;
    const source = await readRegularSource(
      path.join(deps.templateRoot, ...relativePath.split("/")),
      deps,
    );
    files.set(relativePath, source.bytes);
  }
  for (const { input, record } of preparedSources) {
    if (record.source_mode === "copy") {
      files.set(record.copy_path, input.bytes);
    }
  }
  files.set(
    MANIFEST_NAME,
    Buffer.from(serializeYaml(projectManifest), "utf8"),
  );
  return files;
}

async function assertAncestorChain(
  targetPath,
  relativePath,
  directoryIdentities,
  deps,
) {
  let current = targetPath;
  await assertOwnedDirectory(
    current,
    directoryIdentities.get(current),
    deps,
  );
  for (const part of relativePath.split("/").slice(0, -1)) {
    current = path.join(current, part);
    await assertOwnedDirectory(
      current,
      directoryIdentities.get(current),
      deps,
    );
  }
}

async function writeExclusive(
  filePath,
  relativePath,
  bytes,
  targetPath,
  directoryIdentities,
  deps,
) {
  await assertAncestorChain(
    targetPath,
    relativePath,
    directoryIdentities,
    deps,
  );
  let handle;
  let operationError;
  try {
    handle = await deps.fs.open(
      filePath,
      fileConstants.O_WRONLY |
        fileConstants.O_CREAT |
        fileConstants.O_EXCL |
        fileConstants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(bytes);
    await handle.sync();
  } catch (error) {
    operationError = error;
  }
  try {
    await handle?.close();
  } catch (error) {
    operationError ??= error;
  }
  await assertAncestorChain(
    targetPath,
    relativePath,
    directoryIdentities,
    deps,
  );
  if (operationError) throw operationError;
}

function sortPaths(paths) {
  return [...paths].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
}

async function assemblePublication(
  targetPath,
  targetIdentity,
  files,
  deps,
) {
  const directories = new Map([[targetPath, targetIdentity]]);
  for (const relativePath of sortPaths(files.keys())) {
    const parts = relativePath.split("/");
    let current = targetPath;
    for (const part of parts.slice(0, -1)) {
      await assertOwnedDirectory(current, directories.get(current), deps);
      current = path.join(current, part);
      if (directories.has(current)) continue;
      await deps.fs.mkdir(current, { mode: 0o700, recursive: false });
      const identity = await deps.fs.lstat(current);
      if (identity.isSymbolicLink() || !identity.isDirectory()) {
        throw new Error(
          `Initialization created an unsafe directory: ${current}`,
        );
      }
      directories.set(current, identity);
    }
    await assertAncestorChain(targetPath, relativePath, directories, deps);
    await writeExclusive(
      path.join(targetPath, ...parts),
      relativePath,
      files.get(relativePath),
      targetPath,
      directories,
      deps,
    );
  }
  return directories;
}

async function listPublishedInventory(
  directory,
  root,
  directoryIdentities,
  deps,
) {
  await assertOwnedDirectory(
    directory,
    directoryIdentities.get(directory),
    deps,
  );
  const entries = await deps.fs.readdir(directory, { withFileTypes: true });
  await assertOwnedDirectory(
    directory,
    directoryIdentities.get(directory),
    deps,
  );
  const files = [];
  const directories = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
    const metadata = await deps.fs.lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      throw new Error(
        `Initialization published an unsafe inventory entry: ${relativePath}`,
      );
    }
    if (entry.isDirectory() && metadata.isDirectory()) {
      await assertOwnedDirectory(
        absolutePath,
        directoryIdentities.get(absolutePath),
        deps,
      );
      directories.push(relativePath);
      const nested = await listPublishedInventory(
        absolutePath,
        root,
        directoryIdentities,
        deps,
      );
      files.push(...nested.files);
      directories.push(...nested.directories);
    } else if (entry.isFile() && metadata.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(
        `Initialization published an unsafe inventory entry: ${relativePath}`,
      );
    }
  }
  await assertOwnedDirectory(
    directory,
    directoryIdentities.get(directory),
    deps,
  );
  return { files, directories };
}

async function validateDirectoryIdentities(directoryIdentities, deps) {
  for (const directory of sortPaths(directoryIdentities.keys())) {
    await assertOwnedDirectory(
      directory,
      directoryIdentities.get(directory),
      deps,
    );
  }
}

async function readPublishedFileNoFollow(
  targetPath,
  relativePath,
  directoryIdentities,
  deps,
) {
  await assertAncestorChain(
    targetPath,
    relativePath,
    directoryIdentities,
    deps,
  );
  const bytes = await readRegularFileNoFollow(
    deps.fs,
    path.join(targetPath, ...relativePath.split("/")),
  );
  await assertAncestorChain(
    targetPath,
    relativePath,
    directoryIdentities,
    deps,
  );
  return bytes;
}

async function validatePublishedInventory(
  targetPath,
  targetIdentity,
  files,
  directoryIdentities,
  deps,
) {
  await assertOwnedDirectory(targetPath, targetIdentity, deps);
  await validateDirectoryIdentities(directoryIdentities, deps);
  const actual = await listPublishedInventory(
    targetPath,
    targetPath,
    directoryIdentities,
    deps,
  );
  const expectedFiles = sortPaths(files.keys());
  if (
    JSON.stringify(sortPaths(actual.files)) !== JSON.stringify(expectedFiles)
  ) {
    throw new Error("Published project file inventory changed during assembly.");
  }
  const expectedDirectories = new Set();
  for (const relativePath of expectedFiles) {
    const parts = relativePath.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      expectedDirectories.add(parts.slice(0, index).join("/"));
    }
  }
  if (
    JSON.stringify(sortPaths(actual.directories)) !==
    JSON.stringify(sortPaths(expectedDirectories))
  ) {
    throw new Error(
      "Published project directory inventory changed during assembly.",
    );
  }
  for (const [relativePath, expectedBytes] of files) {
    const actualBytes = await readPublishedFileNoFollow(
      targetPath,
      relativePath,
      directoryIdentities,
      deps,
    );
    if (!actualBytes.equals(expectedBytes)) {
      throw new Error(
        `Published project content changed during assembly: ${relativePath}`,
      );
    }
  }
  await validateDirectoryIdentities(directoryIdentities, deps);
  await assertOwnedDirectory(targetPath, targetIdentity, deps);
}

export async function initializeProject(options, dependencyOverrides = {}) {
  const deps = createDependencies(dependencyOverrides);
  const invocationError = validateInitializationOptions(options);
  if (invocationError) {
    return makeResult(2, [
      blocker("B_ARGUMENT_INVALID", ".", invocationError),
    ]);
  }

  let identity;
  try {
    identity = suggestProjectIdentity({
      customerName: options.customer,
      scenario: options.scenario,
      name: options.name,
      slug: options.slug,
      parent: options.parent,
    });
  } catch (error) {
    if (error instanceof NamingError) {
      return makeResult(2, [
        blocker("B_ARGUMENT_INVALID", ".", error.message, { code: error.code }),
      ]);
    }
    return makeResult(3, [initializationIssue(error)]);
  }

  const data = initializationData(identity, options);
  try {
    await assertDirectory(deps.fs, path.resolve(options.parent), "parent");
  } catch (error) {
    return makeResult(3, [
      initializationIssue(error, "B_PARENT_UNAVAILABLE"),
    ], data);
  }

  try {
    if (await pathExists(deps.fs, identity.absolutePath)) {
      return makeResult(
        1,
        [
          blocker(
            "B_TARGET_EXISTS",
            identity.absolutePath,
            "Project target already exists and will not be overwritten.",
          ),
        ],
        {
          ...data,
          next_actions: ["resume", "new-slug", "cancel"],
        },
      );
    }
  } catch (error) {
    return makeResult(3, [initializationIssue(error)], data);
  }

  if (!options.confirm) return makeResult(0, [], data);

  let recordedAt;
  try {
    recordedAt = isoTime(deps.clock);
  } catch (error) {
    return makeResult(3, [initializationIssue(error)], data);
  }
  let preparedSources;
  try {
    preparedSources = await prepareSources(options, deps, recordedAt);
  } catch (error) {
    return makeResult(
      3,
      [
        blocker(
          "B_SOURCE_UNREADABLE",
          ".",
          "Every source must exist and remain a readable regular non-symbolic-link file.",
          { error: errorText(error) },
        ),
      ],
      data,
    );
  }

  let inventory;
  let projectManifest;
  let publicationFiles;
  try {
    inventory = await loadTemplateInventory(deps);
    projectManifest = await loadTemplateManifest(deps);
    projectManifest.project = {
      ...projectManifest.project,
      name: identity.name,
      slug: identity.slug,
      customer_name: options.customer.trim().normalize("NFC"),
      primary_scenario: options.scenario.trim().normalize("NFC"),
      entry_mode: options.mode,
    };
    projectManifest.sources =
      options.mode === "new"
        ? [
            {
              id: "source.conversation_requirement",
              title: "初始化对话需求",
              kind: "conversation",
              portable: true,
              status: "recorded",
              evidence_text: options.scenario.trim().normalize("NFC"),
              recorded_at: recordedAt,
            },
            ...preparedSources.map(({ record }) => record),
          ]
        : preparedSources.map(({ record }) => record);
    projectManifest.stage_status.initialize = {
      ...projectManifest.stage_status.initialize,
      status: "complete",
      baseline_revision: 1,
      input_hashes: Object.fromEntries(
        preparedSources
          .filter(({ record }) => record.source_mode === "copy")
          .map(({ record }) => [record.copy_path, record.sha256]),
      ),
      approved_at: recordedAt,
    };

    const validation = await deps.validateProject(projectManifest);
    if (!validation.valid) {
      return makeResult(
        1,
        [
          blocker(
            "B_PROJECT_SCHEMA_INVALID",
            MANIFEST_NAME,
            "Generated project manifest failed the official project schema.",
            {
              errors: validation.errors,
              recovery_paths: [],
            },
          ),
        ],
        {
          ...data,
          recovery_paths: [],
        },
      );
    }
    publicationFiles = await loadPublicationFiles(
      inventory,
      preparedSources,
      projectManifest,
      deps,
    );
  } catch (error) {
    return makeResult(
      3,
      [
        initializationIssue(error, "B_INITIALIZATION_RUNTIME", {
          recovery_paths: [],
        }),
      ],
      { ...data, recovery_paths: [] },
    );
  }

  const markerPath = projectTransactionLockPath(identity.absolutePath);
  let markerCreated = false;
  let markerIdentity;
  try {
    await deps.fs.mkdir(markerPath, { mode: 0o700, recursive: false });
    markerCreated = true;
    markerIdentity = await deps.fs.lstat(markerPath);
    if (
      markerIdentity.isSymbolicLink() ||
      !markerIdentity.isDirectory()
    ) {
      throw new Error("Initialization marker is not a safe directory.");
    }
  } catch (error) {
    const recoveryPaths = markerCreated || error?.code === "EEXIST"
      ? [markerPath]
      : [];
    if (
      error?.code === "EEXIST" &&
      await pathExists(deps.fs, identity.absolutePath)
    ) {
      return makeResult(
        1,
        [
          blocker(
            "B_TARGET_EXISTS",
            identity.absolutePath,
            "Project target already exists and will not be overwritten.",
            { recovery_paths: recoveryPaths },
          ),
        ],
        {
          ...data,
          next_actions: ["resume", "new-slug", "cancel"],
          recovery_paths: recoveryPaths,
        },
      );
    }
    return makeResult(
      3,
      [
        initializationIssue(error, "B_INITIALIZATION_RUNTIME", {
          recovery_paths: recoveryPaths,
        }),
      ],
      { ...data, recovery_paths: recoveryPaths },
    );
  }

  let targetCreated = false;
  let targetIdentity;
  let committed = false;
  try {
    try {
      // Directory-level atomic visibility is intentionally traded for a
      // cooperative transaction: the external marker blocks kit readers
      // while O_EXCL publication assembles the atomically claimed target.
      await deps.fs.mkdir(identity.absolutePath, {
        mode: 0o700,
        recursive: false,
      });
      targetCreated = true;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let recoveryPaths = [];
      try {
        await assertOwnedDirectory(markerPath, markerIdentity, deps);
        await deps.fs.rmdir(markerPath);
        markerCreated = false;
      } catch (cleanupError) {
        recoveryPaths = [markerPath];
      }
      return makeResult(
        1,
        [
          blocker(
            "B_TARGET_EXISTS",
            identity.absolutePath,
            "Project target already exists and will not be overwritten.",
            { recovery_paths: recoveryPaths },
          ),
        ],
        {
          ...data,
          next_actions: ["resume", "new-slug", "cancel"],
          recovery_paths: recoveryPaths,
        },
      );
    }
    targetIdentity = await deps.fs.lstat(identity.absolutePath);
    if (
      targetIdentity.isSymbolicLink() ||
      !targetIdentity.isDirectory()
    ) {
      throw new Error("Initialization target is not a safe directory.");
    }
    await assertOwnedDirectory(markerPath, markerIdentity, deps);
    const directoryIdentities = await assemblePublication(
      identity.absolutePath,
      targetIdentity,
      publicationFiles,
      deps,
    );
    await validatePublishedInventory(
      identity.absolutePath,
      targetIdentity,
      publicationFiles,
      directoryIdentities,
      deps,
    );
    committed = true;
    await assertOwnedDirectory(markerPath, markerIdentity, deps);
    await deps.fs.rmdir(markerPath);
    markerCreated = false;
    return makeResult(0, [], {
      ...data,
      requires_confirmation: false,
      initialized: true,
    });
  } catch (error) {
    if (committed) {
      const recoveryPaths = [markerPath];
      return makeResult(
        0,
        [
          warning(
            "W_INITIALIZATION_CLEANUP_DEFERRED",
            identity.absolutePath,
            "Initialization committed, but transaction marker cleanup was deferred.",
            {
              error: errorText(error),
              marker_path: markerPath,
              recovery_paths: recoveryPaths,
            },
          ),
        ],
        {
          ...data,
          requires_confirmation: false,
          initialized: true,
          marker_path: markerPath,
          recovery_paths: recoveryPaths,
        },
      );
    }
    const recoveryPaths = [
      ...(targetCreated ? [identity.absolutePath] : []),
      ...(markerCreated ? [markerPath] : []),
    ];
    return makeResult(
      3,
      [
        initializationIssue(error, "B_INITIALIZATION_RUNTIME", {
          recovery_paths: recoveryPaths,
        }),
      ],
      { ...data, recovery_paths: recoveryPaths },
    );
  }
}
