import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

import {
  validateAssemblyPlan,
} from "../assembly/assembly-validator.js";
import { loadCliEvidence } from "../assembly/cli-evidence.js";
import {
  renderDryrunScript,
  writeDryrunScriptAtomic,
} from "../assembly/dryrun-renderer.js";
import {
  loadOperationCatalog,
} from "../assembly/operation-catalog.js";
import {
  createOfficialSchemaRegistry,
  SCHEMA_IDS,
  validateSchema,
} from "../contracts/schema-registry.js";
import { parseSafeJson, parseSafeYaml } from "../contracts/safe-data.js";
import {
  authoritativeStageHash,
  validateProjectDirectory,
} from "../contracts/project-validator.js";
import {
  projectTransactionLockPath,
  readContainedRegularFileSnapshotNoFollow,
} from "../project/project-runtime.js";
import {
  deriveProjectStatus,
  deriveStageStates,
} from "../project/stage-state.js";
import {
  removeIfOwned,
  writeValidationTransaction,
} from "../project/validation-report.js";
import { commandResult, issue } from "../shared/result.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = path.join(ROOT, "catalog/assembly-operations.yaml");
const USAGE =
  "Usage: render-assemble-script <absolute-project-dir> " +
  "--cli-evidence <absolute-generated-dir> [--output <absolute-script>]";
const LOCK_FS = { lstat, mkdir, rename, rmdir, unlink };

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

class RenderDomainError extends Error {
  constructor(issuePath, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "RenderDomainError";
    this.issuePath = issuePath;
  }
}

class OutputPathError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OutputPathError";
    this.code = code;
  }
}

function invocation(code, message) {
  return withExit(2, [issue("BLOCKER", code, ".", message)], { usage: USAGE });
}

function isContainedPath(root, candidate) {
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

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length === 0 || args[0].startsWith("--")) {
    return { error: invocation("B_ARGUMENT_MISSING", "Project directory is required.") };
  }
  if (!path.isAbsolute(args[0])) {
    return { error: invocation("B_ARGUMENT_INVALID", "Project directory must be absolute.") };
  }
  const parsed = { projectRoot: path.resolve(args[0]) };
  const keys = new Map([
    ["--cli-evidence", "evidenceRoot"],
    ["--output", "output"],
  ]);
  const seen = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index];
    if (!keys.has(flag)) {
      return { error: invocation("B_ARGUMENT_UNKNOWN", `Unknown argument: ${flag}`) };
    }
    if (seen.has(flag)) {
      return { error: invocation("B_ARGUMENT_CONFLICT", `${flag} may only be used once.`) };
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      return { error: invocation("B_ARGUMENT_MISSING", `${flag} requires a value.`) };
    }
    if (!path.isAbsolute(value)) {
      return { error: invocation("B_ARGUMENT_INVALID", `${flag} requires an absolute path.`) };
    }
    parsed[keys.get(flag)] = path.resolve(value);
    seen.add(flag);
    index += 1;
  }
  if (!parsed.evidenceRoot) {
    return { error: invocation("B_ARGUMENT_MISSING", "--cli-evidence is required.") };
  }
  parsed.output ??= path.join(
    parsed.projectRoot,
    "assembly/octopus-cli-assemble.sh",
  );
  const fixedOutput = path.join(
    parsed.projectRoot,
    "assembly/octopus-cli-assemble.sh",
  );
  if (
    isContainedPath(parsed.projectRoot, parsed.output) &&
    parsed.output !== fixedOutput
  ) {
    return {
      error: invocation(
        "B_OUTPUT_PATH_INVALID",
        "Project-contained output must be the fixed assembly script.",
      ),
    };
  }
  return parsed;
}

function commonAncestor(left, right) {
  let candidate = left;
  while (!isContainedPath(candidate, right)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return parent;
    candidate = parent;
  }
  return candidate;
}

async function classifyExternalOutput(projectRoot, output) {
  const sharedRoot = commonAncestor(projectRoot, output);
  const outputParent = path.dirname(output);
  const branch = path.relative(sharedRoot, outputParent)
    .split(path.sep)
    .filter(Boolean);
  let current = sharedRoot;
  let existing = sharedRoot;
  let missingIndex = branch.length;
  for (const [index, segment] of branch.entries()) {
    current = path.join(current, segment);
    let metadata;
    try {
      metadata = await lstat(current);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      missingIndex = index;
      break;
    }
    if (metadata.isSymbolicLink()) {
      throw new OutputPathError(
        "B_OUTPUT_PATH_UNSAFE",
        "External output ancestors must be non-symbolic directories.",
      );
    }
    if (!metadata.isDirectory()) {
      throw new Error("External output ancestor is not a directory.");
    }
    existing = current;
  }
  let targetMetadata;
  try {
    targetMetadata = await lstat(output);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  if (
    targetMetadata &&
    (targetMetadata.isSymbolicLink() || !targetMetadata.isFile())
  ) {
    throw new OutputPathError(
      "B_OUTPUT_PATH_UNSAFE",
      "External output must be absent or a regular non-symbolic file.",
    );
  }
  const canonicalParent = path.join(
    await realpath(existing),
    ...branch.slice(missingIndex),
  );
  const canonicalOutput = path.join(canonicalParent, path.basename(output));
  const canonicalProject = await realpath(projectRoot);
  if (isContainedPath(canonicalProject, canonicalOutput)) {
    throw new OutputPathError(
      "B_OUTPUT_PATH_UNSAFE",
      "External output must not resolve into the project delivery tree.",
    );
  }
  return canonicalOutput;
}

async function readProjectAssemblyDocuments(projectRoot) {
  const root = await lstat(projectRoot);
  if (root.isSymbolicLink() || !root.isDirectory()) {
    throw new Error("Project root must be a non-symbolic directory.");
  }
  const assemblyRelativePath = "assembly/operations.yaml";
  const assemblyPath = path.join(projectRoot, assemblyRelativePath);
  let plan;
  try {
    const snapshot = await readContainedRegularFileSnapshotNoFollow(
      { lstat, open },
      projectRoot,
      assemblyRelativePath,
    );
    plan = parseSafeYaml(snapshot.bytes.toString("utf8"), assemblyPath);
  } catch (error) {
    if (
      ["ENOENT", "EACCES", "EPERM", "ELOOP", "E_UNSAFE_FILE"]
        .includes(error?.code)
    ) {
      throw error;
    }
    throw new RenderDomainError(
      assemblyRelativePath,
      "Assembly plan is readable but invalid YAML.",
      error,
    );
  }
  let manifest = null;
  try {
    const snapshot = await readContainedRegularFileSnapshotNoFollow(
      { lstat, open },
      projectRoot,
      "fde-project.yaml",
    );
    manifest = parseSafeYaml(
      snapshot.bytes.toString("utf8"),
      "fde-project.yaml",
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { plan, manifest };
}

async function readAssemblyPayloads(projectRoot, operations) {
  const payloads = new Map();
  for (const operation of operations) {
    if (
      typeof operation.payload_file !== "string" ||
      !/^assembly\/payloads\/[a-z0-9][a-z0-9._/-]*\.json$/u
        .test(operation.payload_file) ||
      operation.payload_file.split("/").some((part) =>
        part === "." || part === "..")
    ) continue;
    try {
      const snapshot = await readContainedRegularFileSnapshotNoFollow(
        { lstat, open },
        projectRoot,
        operation.payload_file,
      );
      payloads.set(
        operation.payload_file,
        parseSafeJson(
          snapshot.bytes.toString("utf8"),
          operation.payload_file,
        ),
      );
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      if (
        ["EACCES", "EPERM", "ELOOP", "E_UNSAFE_FILE"]
          .includes(error?.code)
      ) throw error;
      throw new RenderDomainError(
        operation.payload_file,
        "Assembly payload is readable but invalid JSON.",
        error,
      );
    }
  }
  return payloads;
}

async function acquireProjectLock(projectRoot) {
  const lockPath = projectTransactionLockPath(projectRoot);
  let handle;
  let identity;
  try {
    handle = await open(lockPath, "wx", 0o600);
    identity = await handle.stat();
    await handle.writeFile(
      `${JSON.stringify({
        command: "render-assemble-script",
        pid: process.pid,
      })}\n`,
    );
    await handle.sync();
    return { lockPath, handle, identity };
  } catch (error) {
    await handle?.close().catch(() => {});
    if (handle && identity) {
      await removeIfOwned(
        LOCK_FS,
        lockPath,
        identity,
      ).catch(() => {});
    }
    if (error?.code === "EEXIST") {
      throw new Error("A cooperative project transaction is already active.");
    }
    throw error;
  }
}

async function releaseProjectLock(lock) {
  await lock.handle.close();
  await removeIfOwned(
    LOCK_FS,
    lock.lockPath,
    lock.identity,
  );
}

function prepareReadyAssembly(projectValidation, plan, versions, scriptBytes) {
  const manifest = structuredClone(projectValidation.context.manifest);
  if (!manifest) {
    throw new Error("Fixed project output requires a valid project manifest.");
  }
  const assembly = structuredClone(plan);
  delete assembly.dryrun;
  assembly.assembly_execution = {
    status: "ready",
    script_file: "assembly/octopus-cli-assemble.sh",
    evidence_file: null,
    cli_package_version: versions.npm_package,
    cli_reported_version: versions.cli_self_reported,
  };
  manifest.assembly = structuredClone(assembly);
  const assemblyBytes = Buffer.from(stringify(assembly), "utf8");
  const files = new Map(projectValidation.context.files);
  files.set("assembly/operations.yaml", assemblyBytes);
  files.set("assembly/octopus-cli-assemble.sh", scriptBytes);
  files.delete("assembly/octopus-cli-dryrun.sh");
  files.delete("reports/cli-assemble-evidence.json");
  files.delete("reports/cli-dryrun-evidence.json");
  const present = new Set(files.keys());
  const hashes = Object.fromEntries(
    [...files].map(([relativePath, bytes]) => [
      relativePath,
      authoritativeStageHash(relativePath, bytes),
    ]),
  );
  const stageStates = deriveStageStates(
    manifest,
    projectValidation.context.stageCatalog,
    {
      hashes,
      present,
      validStages: projectValidation.context.validStages,
      workingStages: new Set(),
    },
  );
  const remainingBlockers = projectValidation.issues.filter((item) =>
    item.severity === "BLOCKER" &&
    item.code !== "B_PROJECT_STATUS_DRIFT" &&
    !item.code.startsWith("B_ASSEMBLY_EXECUTION_"));
  manifest.project.status = deriveProjectStatus(
    manifest,
    stageStates,
    remainingBlockers,
  );
  return {
    manifestBytes: Buffer.from(stringify(manifest), "utf8"),
    assemblyBytes,
    stageStates,
    projectStatus: manifest.project.status,
  };
}

async function render(parsed, options) {
  const fixedOutput = path.join(
    parsed.projectRoot,
    "assembly/octopus-cli-assemble.sh",
  );
  const isFixedOutput = parsed.output === fixedOutput;
  let lock;
  let externalWriteTarget;
  if (isFixedOutput) {
    lock = await acquireProjectLock(parsed.projectRoot);
  } else {
    externalWriteTarget = await classifyExternalOutput(
      parsed.projectRoot,
      parsed.output,
    );
  }
  try {
    const {
      plan,
      manifest,
    } = await readProjectAssemblyDocuments(parsed.projectRoot);
  const [registry, catalog] = await Promise.all([
    createOfficialSchemaRegistry(),
    loadOperationCatalog(options.catalogPath ?? CATALOG_PATH),
  ]);
  const schema = validateSchema(registry, SCHEMA_IDS.assembly, plan);
  const issues = [];
  if (!schema.valid) {
    issues.push(issue(
      "BLOCKER",
      "B_ASSEMBLY_SCHEMA",
      "assembly/operations.yaml",
      "Assembly plan does not satisfy the official schema.",
      { stage: "assemble", errors: schema.errors },
    ));
  }
  if (!schema.valid) {
    return withExit(1, issues, { status: "blocked", output: null });
  }
  const payloads = await readAssemblyPayloads(
    parsed.projectRoot,
    plan.operations,
  );
  const projectValidation = isFixedOutput
    ? await (options.validateProject ?? validateProjectDirectory)(
      parsed.projectRoot,
      { dependencies: options.dependencies },
    )
    : null;
  const validation = validateAssemblyPlan(plan, {
    catalog,
    registry,
    payloads,
    artifactVariables: new Map([[
      "skill-slug",
      (manifest?.skills ?? []).map(({ id }) =>
        id?.replace(/^skill\./u, "").replaceAll("_", "-")),
    ]]),
  });
  issues.push(...validation.issues);
  if (issues.length > 0) {
    return withExit(1, issues, { status: "blocked", output: null });
  }
  if (validation.supportedWrites.length === 0) {
    return withExit(0, [], {
      status: "not-applicable",
      output: null,
      supported_write_count: 0,
    });
  }
  let cliEvidence;
  try {
    cliEvidence = await loadCliEvidence(
      parsed.evidenceRoot,
      validation.supportedWrites,
      catalog,
    );
  } catch (error) {
    return withExit(error.exitCode ?? 1, [issue(
      "BLOCKER",
      "B_CLI_EVIDENCE_INVALID",
      parsed.evidenceRoot,
      "CLI evidence is invalid or does not support every planned write.",
      { stage: "assemble", error: error instanceof Error ? error.message : String(error) },
    )], { status: "blocked", output: null });
  }
  const catalogById = new Map(
    catalog.supported.map((operation) => [operation.operation_id, operation]),
  );
  const bytes = renderDryrunScript(
    validation.supportedWrites,
    catalogById,
    isFixedOutput
      ? {}
      : { projectRoot: parsed.projectRoot },
  );
  if (!isFixedOutput) {
      await (options.writeScript ?? writeDryrunScriptAtomic)(
        externalWriteTarget,
        bytes,
      );
    return withExit(0, [], {
      status: "external-rendered",
      output: parsed.output,
      supported_write_count: validation.supportedWrites.length,
    });
  }
  const ready = prepareReadyAssembly(
    projectValidation,
    plan,
    cliEvidence.versions,
    bytes,
  );
  const result = withExit(0, [], {
    status: "ready",
    output: parsed.output,
    supported_write_count: validation.supportedWrites.length,
    project_status: ready.projectStatus,
    stage_states: ready.stageStates,
  });
  await (options.writeTransaction ?? writeValidationTransaction)(
    parsed.projectRoot,
    result,
    {
      command:
        "render-assemble-script <absolute-project-dir> " +
        "--cli-evidence <absolute-generated-dir>",
      manifestBytes: ready.manifestBytes,
      additionalFiles: new Map([
        ["assembly/operations.yaml", ready.assemblyBytes],
        ["assembly/octopus-cli-assemble.sh", bytes],
      ]),
      additionalFileModes: new Map([
        ["assembly/octopus-cli-assemble.sh", 0o755],
      ]),
      removePaths: [
        "assembly/octopus-cli-dryrun.sh",
        "reports/cli-assemble-evidence.json",
        "reports/cli-dryrun-evidence.json",
      ],
      validationSnapshot:
        projectValidation.context.dryrunValidationSnapshot,
      clock: options.clock,
    },
  );
  return withExit(0, [], {
    status: "ready",
    output: parsed.output,
    supported_write_count: validation.supportedWrites.length,
  });
  } finally {
    if (lock) await releaseProjectLock(lock);
  }
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args);
  let result;
  try {
    if (parsed.help) result = commandResult([], { usage: USAGE });
    else if (parsed.error) result = parsed.error;
    else result = await render(parsed, options);
  } catch (error) {
    result = error instanceof OutputPathError
      ? invocation(error.code, error.message)
      : error instanceof RenderDomainError
      ? withExit(1, [issue(
        "BLOCKER",
        "B_ASSEMBLY_PARSE",
        error.issuePath,
        error.message,
        { stage: "assemble", error: error.cause?.message },
      )])
      : withExit(3, [issue(
        "BLOCKER",
        "B_ASSEMBLY_RENDER_RUNTIME",
        ".",
        "Assembly script could not be read, rendered, or committed.",
        {
          error: error instanceof Error ? error.message : String(error),
          drift_paths: error?.driftPaths ?? [],
          recovery_paths: error?.recoveryPaths ?? [],
        },
      )], {
        recovery_paths: error?.recoveryPaths ?? [],
      });
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
