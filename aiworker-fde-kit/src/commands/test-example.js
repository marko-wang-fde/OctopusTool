import {
  copyFile,
  cp,
  lstat,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rmdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse, stringify } from "yaml";

import { inspectOctopusCli } from "../assembly/cli-inspector.js";
import { readZipEntries } from "../delivery/zip-writer.js";
import { main as packageDeliveryMain } from "./package-delivery.js";
import { main as renderDryrunMain } from "./render-dryrun-script.js";
import { main as validateProjectMain } from "./validate-project.js";
import {
  compareGoldenProject,
  loadExpectedArtifacts,
} from "../project/golden-comparator.js";
import {
  canonicalBytes,
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import { runLocalProcess } from "../shared/local-process.js";
import { commandResult, issue } from "../shared/result.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const USAGE = "Usage: test-example --example lead-collector";
const EXAMPLE_NAME = "lead-collector";

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function invocation(code, message) {
  return withExit(
    2,
    [issue("BLOCKER", code, ".", message)],
    { usage: USAGE },
  );
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length === 0) {
    return { error: invocation("B_ARGUMENT_MISSING", "--example is required.") };
  }
  if (args.length !== 2 || args[0] !== "--example") {
    return { error: invocation("B_ARGUMENT_UNKNOWN", "Only --example is accepted.") };
  }
  if (!args[1]) {
    return { error: invocation("B_ARGUMENT_MISSING", "--example requires a value.") };
  }
  if (args[1] !== EXAMPLE_NAME) {
    return { error: invocation("B_ARGUMENT_INVALID", `Unknown example: ${args[1]}.`) };
  }
  return { example: args[1] };
}

async function captureCommand(command, args, options = {}) {
  const chunks = [];
  const exitCode = await command(args, {
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  if (chunks.length !== 1) {
    throw new Error("Internal command did not emit exactly one JSON result.");
  }
  return { exitCode, result: JSON.parse(chunks[0]) };
}

function blockerCount(issues) {
  return issues.filter(({ severity }) => severity === "BLOCKER").length;
}

function comparisonSummary(comparison, issues) {
  return {
    example: EXAMPLE_NAME,
    fixture_only: true,
    expected_files: comparison.expected_paths.length,
    matched_files: comparison.matched_files,
    blockers: blockerCount(issues),
    comparison_hashes: comparison.hashes,
    comparison_sha256: sha256Bytes(canonicalBytes(comparison.hashes)),
  };
}

function createOfflineAdapters(options) {
  const supplied = options.dependencies ?? {};
  const calls = {
    global_cli_calls: 0,
    network_calls: 0,
    llm_calls: 0,
    allowed_local_shell_calls: 0,
  };
  const guarded = (name, adapter) => (...args) => {
    calls[name] += 1;
    if (typeof adapter === "function") return adapter(...args);
    throw new Error(`Offline example attempted forbidden ${name} access.`);
  };
  const dependencies = {
    globalCli: guarded(
      "global_cli_calls",
      supplied.globalCli ?? options.spawnCommand,
    ),
    network: guarded(
      "network_calls",
      supplied.network ?? options.network,
    ),
    llm: guarded(
      "llm_calls",
      supplied.llm ?? options.llm,
    ),
    localProcess: guarded(
      "allowed_local_shell_calls",
      supplied.localProcess ?? runLocalProcess,
    ),
  };
  return {
    calls,
    dependencies,
  };
}

function dependencySummary(offlineAdapters) {
  return {
    dependency_calls: { ...offlineAdapters.calls },
    offline_external_calls: {
      global_cli: offlineAdapters.calls.global_cli_calls,
      network: offlineAdapters.calls.network_calls,
      llm: offlineAdapters.calls.llm_calls,
    },
  };
}

function sameDirectoryIdentity(metadata, identity) {
  return (
    metadata.dev === identity.dev &&
    metadata.ino === identity.ino &&
    metadata.isDirectory() &&
    !metadata.isSymbolicLink()
  );
}

async function snapshotPrivateTree(root) {
  const rootMetadata = await lstat(root);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw new Error("Private example root is not a regular directory.");
  }
  const entries = [];
  const directories = [""];
  while (directories.length > 0) {
    const relativeDirectory = directories.pop();
    const absoluteDirectory = relativeDirectory
      ? path.join(root, ...relativeDirectory.split("/"))
      : root;
    const before = await lstat(absoluteDirectory);
    if (before.isSymbolicLink() || !before.isDirectory()) {
      throw new Error(`Private example directory is unsafe: ${relativeDirectory}`);
    }
    const children = await readdir(absoluteDirectory, { withFileTypes: true });
    const after = await lstat(absoluteDirectory);
    if (!sameDirectoryIdentity(after, before)) {
      throw new Error(`Private example directory changed: ${relativeDirectory}`);
    }
    children.sort((left, right) =>
      Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      const absolutePath = path.join(absoluteDirectory, child.name);
      const metadata = await lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        throw new Error(`Private example tree contains a symlink: ${relativePath}`);
      }
      const base = {
        path: relativePath,
        dev: metadata.dev,
        ino: metadata.ino,
        mode: metadata.mode & 0o777,
      };
      if (metadata.isDirectory()) {
        entries.push({ ...base, type: "directory" });
        directories.push(relativePath);
      } else if (metadata.isFile()) {
        const bytes = await readFile(absolutePath);
        const confirmed = await lstat(absolutePath);
        if (
          confirmed.dev !== metadata.dev ||
          confirmed.ino !== metadata.ino ||
          confirmed.isSymbolicLink() ||
          !confirmed.isFile()
        ) {
          throw new Error(`Private example file changed: ${relativePath}`);
        }
        entries.push({
          ...base,
          type: "file",
          size: bytes.length,
          sha256: sha256Bytes(bytes),
        });
      } else {
        throw new Error(`Private example tree contains an unsafe entry: ${relativePath}`);
      }
    }
  }
  entries.sort((left, right) =>
    Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  const confirmedRoot = await lstat(root);
  if (!sameDirectoryIdentity(confirmedRoot, rootMetadata)) {
    throw new Error("Private example root changed while inventory was captured.");
  }
  return {
    identity: rootMetadata,
    entries,
    sha256: sha256Bytes(canonicalBytes(entries)),
  };
}

async function removeEmptyOwnedDirectory(target, identity) {
  const current = await lstat(target);
  if (!sameDirectoryIdentity(current, identity)) {
    throw new Error(`Cleanup directory changed before removal: ${target}`);
  }
  await rmdir(target);
}

async function claimAndCleanupPrivateRoot({
  runRoot,
  temporaryParent,
  created,
  inventory,
  inventoryError,
  cleanupHooks,
}) {
  await cleanupHooks?.beforeClaim?.({ runRoot });
  const quarantineRoot = await mkdtemp(path.join(
    temporaryParent,
    ".aiworker-example-cleanup-",
  ));
  const quarantineIdentity = await lstat(quarantineRoot);
  const claimedRoot = path.join(quarantineRoot, "entry");
  try {
    await rename(runRoot, claimedRoot);
  } catch (error) {
    return {
      retained: true,
      recoveryPaths: [runRoot, quarantineRoot],
      foreignPaths: error?.code === "ENOENT" ? [] : [runRoot],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  let claimed;
  try {
    claimed = await lstat(claimedRoot);
  } catch (error) {
    return {
      retained: true,
      recoveryPaths: [claimedRoot, quarantineRoot],
      foreignPaths: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (!sameDirectoryIdentity(claimed, created.identity)) {
    return {
      retained: true,
      recoveryPaths: [claimedRoot],
      foreignPaths: [claimedRoot],
      error: "The live temporary root was replaced before cleanup claim.",
    };
  }
  let claimedInventory;
  try {
    claimedInventory = await snapshotPrivateTree(claimedRoot);
  } catch (error) {
    return {
      retained: true,
      recoveryPaths: [claimedRoot],
      foreignPaths: [claimedRoot],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  if (!inventory) {
    return {
      retained: true,
      recoveryPaths: [claimedRoot],
      foreignPaths: [],
      error: `The pre-claim inventory could not be verified: ${inventoryError}`,
    };
  }
  if (
    claimedInventory.sha256 !== inventory.sha256 ||
    !sameDirectoryIdentity(claimedInventory.identity, created.identity)
  ) {
    return {
      retained: true,
      recoveryPaths: [claimedRoot],
      foreignPaths: [claimedRoot],
      error: "The claimed temporary inventory differs from the owned snapshot.",
    };
  }
  try {
    await rm(claimedRoot, { recursive: true, force: false });
  } catch (error) {
    return {
      retained: true,
      recoveryPaths: [claimedRoot, quarantineRoot],
      foreignPaths: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  try {
    await removeEmptyOwnedDirectory(quarantineRoot, quarantineIdentity);
  } catch (error) {
    return {
      retained: true,
      recoveryPaths: [quarantineRoot],
      foreignPaths: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return { retained: false, recoveryPaths: [], foreignPaths: [] };
}

function withCleanupResult(result, cleanup) {
  if (!cleanup.retained) return result;
  const cleanupIssue = issue(
    "BLOCKER",
    "B_EXAMPLE_CLEANUP_RETAINED",
    cleanup.recoveryPaths[0] ?? ".",
    "Temporary cleanup isolated and retained a foreign or changed tree.",
    {
      error: cleanup.error,
      recovery_paths: cleanup.recoveryPaths,
      foreign_paths: cleanup.foreignPaths,
    },
  );
  const issues = [...result.issues, cleanupIssue];
  return withExit(3, issues, {
    ...result.data,
    blockers: blockerCount(issues),
    recovery_paths: cleanup.recoveryPaths,
    foreign_paths: cleanup.foreignPaths,
  });
}

async function assertExampleRoot(exampleRoot) {
  const metadata = await lstat(exampleRoot);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("Example root must be a non-symbolic directory.");
  }
  for (const relativePath of [
    "expected-project",
    "expected-artifacts.yaml",
    "cli-fixture",
    "package-scan-policy.yaml",
  ]) {
    const child = await lstat(path.join(exampleRoot, relativePath));
    if (child.isSymbolicLink()) {
      throw new Error(`Example fixture path must not be symbolic: ${relativePath}`);
    }
  }
}

async function runLeadCollectorInTemp({
  exampleRoot,
  runRoot,
  offlineAdapters,
  clock,
}) {
  const fixtureClock =
    clock ?? (() => new Date("2026-07-24T01:00:00.000Z"));
  const goldenRoot = path.join(runRoot, "golden-project");
  await cp(path.join(exampleRoot, "expected-project"), goldenRoot, {
    recursive: true,
    errorOnExist: true,
    force: false,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });
  let expected;
  try {
    expected = await loadExpectedArtifacts(
      path.join(exampleRoot, "expected-artifacts.yaml"),
    );
  } catch (error) {
    if (["ENOENT", "EACCES", "EPERM", "ELOOP"].includes(error?.code)) {
      throw error;
    }
    return withExit(
      1,
      [issue(
        "BLOCKER",
        "B_GOLDEN_CONTRACT",
        "expected-artifacts.yaml",
        "The readable Golden expectation contract is invalid.",
        { error: error instanceof Error ? error.message : String(error) },
      )],
      {
        example: EXAMPLE_NAME,
        fixture_only: true,
        expected_files: 0,
        matched_files: 0,
        blockers: 1,
      },
    );
  }
  const comparison = await compareGoldenProject({
    projectRoot: goldenRoot,
    expected,
    dependencies: offlineAdapters.dependencies,
  });
  if (comparison.issues.length > 0) {
    return withExit(
      1,
      comparison.issues,
      comparisonSummary(comparison, comparison.issues),
    );
  }

  const validationRoot = path.join(runRoot, "validation-overlay");
  await cp(goldenRoot, validationRoot, {
    recursive: true,
    errorOnExist: true,
    force: false,
    preserveTimestamps: true,
    verbatimSymlinks: true,
  });
  await copyFile(
    path.join(ROOT, "assets/project-template/.gitignore"),
    path.join(validationRoot, ".gitignore"),
  );

  const evidenceRoot = path.join(runRoot, "cli-evidence");
  const inspection = await inspectOctopusCli({
    fixtureDir: path.join(exampleRoot, "cli-fixture"),
    output: evidenceRoot,
    catalogPath: path.join(ROOT, "catalog/assembly-operations.yaml"),
    spawnCommand: offlineAdapters.dependencies.globalCli,
    dependencies: offlineAdapters.dependencies,
  });
  if (inspection.exitCode !== 0) {
    return withExit(
      inspection.exitCode === 3 ? 3 : 1,
      inspection.issues,
      comparisonSummary(comparison, inspection.issues),
    );
  }

  const beforeRender = await readFile(path.join(
    validationRoot,
    "assembly/octopus-cli-assemble.sh",
  ));
  const rendered = await captureCommand(
    renderDryrunMain,
    [validationRoot, "--cli-evidence", evidenceRoot],
    { clock: fixtureClock, dependencies: offlineAdapters.dependencies },
  );
  const afterRender = await readFile(path.join(
    validationRoot,
    "assembly/octopus-cli-assemble.sh",
  ));
  const renderIssues = [...rendered.result.issues];
  if (!beforeRender.equals(afterRender)) {
    renderIssues.push(issue(
      "BLOCKER",
      "B_GOLDEN_ASSEMBLY_MISMATCH",
      "assembly/octopus-cli-assemble.sh",
      "Fresh fixture-only rendering differs from the signed Golden assembly script.",
    ));
  }
  if (rendered.exitCode !== 0 || renderIssues.length > 0) {
    return withExit(
      rendered.exitCode === 3 ? 3 : 1,
      renderIssues,
      comparisonSummary(comparison, renderIssues),
    );
  }

  const validated = await captureCommand(
    validateProjectMain,
    [
      validationRoot,
      "--cli-fixture-dir",
      path.join(exampleRoot, "cli-fixture"),
    ],
    {
      spawnCommand: offlineAdapters.dependencies.globalCli,
      dependencies: offlineAdapters.dependencies,
      clock: fixtureClock,
    },
  );
  if (validated.exitCode !== 0 || blockerCount(validated.result.issues) > 0) {
    return withExit(
      validated.exitCode === 3 ? 3 : 1,
      validated.result.issues,
      comparisonSummary(comparison, validated.result.issues),
    );
  }

  const manifestPath = path.join(validationRoot, "fde-project.yaml");
  const manifest = parse(await readFile(manifestPath, "utf8"));
  for (const stage of ["initialize", "discover", "team-design"]) {
    manifest.stage_status[stage].approved_at =
      "2026-07-24T01:00:00.000Z";
  }
  await writeFile(
    manifestPath,
    stringify(manifest, { lineWidth: 0 }),
  );
  for (const stage of [
    "initialize",
    "discover",
    "team-design",
    "foundation-design",
    "author",
    "assemble",
  ]) {
    const accepted = await captureCommand(
      validateProjectMain,
      [
        validationRoot,
        "--accept-stage",
        stage,
        "--cli-fixture-dir",
        path.join(exampleRoot, "cli-fixture"),
      ],
      {
        dependencies: offlineAdapters.dependencies,
        clock: fixtureClock,
      },
    );
    if (
      accepted.exitCode !== 0 ||
      blockerCount(accepted.result.issues) > 0
    ) {
      return withExit(
        accepted.exitCode === 3 ? 3 : 1,
        accepted.result.issues,
        comparisonSummary(comparison, accepted.result.issues),
      );
    }
  }
  await copyFile(
    path.join(exampleRoot, "package-scan-policy.yaml"),
    path.join(validationRoot, "reports/package-scan-policy.yaml"),
  );
  const archivePath = path.join(runRoot, "lead-collector-delivery.zip");
  const packaged = await captureCommand(
    packageDeliveryMain,
    [
      validationRoot,
      "--confirm-personal-data",
      "--output",
      archivePath,
    ],
    {
      dependencies: offlineAdapters.dependencies,
      clock: fixtureClock,
    },
  );
  if (
    packaged.exitCode !== 0 ||
    blockerCount(packaged.result.issues) > 0
  ) {
    return withExit(
      packaged.exitCode === 3 ? 3 : 1,
      packaged.result.issues,
      comparisonSummary(comparison, packaged.result.issues),
    );
  }
  const packageEntries = await readZipEntries(archivePath);
  const packagePaths = packageEntries.map(({ path: entryPath }) => entryPath);
  const expectedPackagePaths = sortRelativePaths([
    ...comparison.expected_paths.filter((entryPath) =>
      entryPath !== "reports/validation-report.md"),
    "package-manifest.json",
    "reports/package-scan-policy.yaml",
    "reports/package-validation.json",
  ]);
  const exactPaths =
    packagePaths.length === expectedPackagePaths.length &&
    packagePaths.every((entryPath, index) =>
      entryPath === expectedPackagePaths[index]);
  const packageBoundary = {
    verified: true,
    package_paths: packagePaths,
    expected_path_count: expectedPackagePaths.length,
    exact_paths: exactPaths,
    contains_manifest: packagePaths.includes("package-manifest.json"),
    contains_validation_report:
      packagePaths.includes("reports/package-validation.json"),
    contains_sources: packagePaths.some((entryPath) =>
      entryPath.startsWith("inputs/source-files/")),
    contains_generated: packagePaths.some((entryPath) =>
      entryPath.startsWith("generated/")),
    contains_old_zip: packagePaths.some((entryPath) =>
      entryPath.endsWith(".zip")),
    kit_commit: packaged.result.data.kit_commit,
    package_sha256: sha256Bytes(await readFile(archivePath)),
  };
  if (
    !packageBoundary.contains_manifest ||
    !packageBoundary.contains_validation_report ||
    !packageBoundary.exact_paths ||
    packageBoundary.contains_sources ||
    packageBoundary.contains_generated ||
    packageBoundary.contains_old_zip
  ) {
    const packageIssues = [issue(
      "BLOCKER",
      "B_GOLDEN_PACKAGE_BOUNDARY",
      "lead-collector-delivery.zip",
      "Fixture package does not satisfy the default offline privacy boundary.",
      packageBoundary,
    )];
    return withExit(
      1,
      packageIssues,
      comparisonSummary(comparison, packageIssues),
    );
  }

  return withExit(0, [], {
    ...comparisonSummary(comparison, []),
    validation_overlay: {
      injected_files: [".gitignore"],
      generated_paths: ["generated/validate-cli-evidence/**"],
      blockers: 0,
    },
    package_boundary: packageBoundary,
  });
}

async function testLeadCollector({
  exampleRoot,
  temporaryParent,
  offlineAdapters,
  clock,
  cleanupHooks,
}) {
  await assertExampleRoot(exampleRoot);
  const runRoot = await mkdtemp(path.join(
    temporaryParent,
    "aiworker-lead-collector-",
  ));
  const created = await snapshotPrivateTree(runRoot);
  if (
    created.entries.length !== 0 ||
    (created.identity.mode & 0o777) !== 0o700
  ) {
    throw new Error("Temporary example root was not created empty and private.");
  }
  let result;
  let operationError;
  try {
    result = await runLeadCollectorInTemp({
      exampleRoot,
      runRoot,
      offlineAdapters,
      clock,
    });
  } catch (error) {
    operationError = error;
  }
  if (result) {
    result.data = {
      ...result.data,
      ...dependencySummary(offlineAdapters),
    };
  }
  let inventory;
  let inventoryError;
  try {
    inventory = await snapshotPrivateTree(runRoot);
  } catch (error) {
    inventoryError = error instanceof Error ? error.message : String(error);
  }
  const cleanup = await claimAndCleanupPrivateRoot({
    runRoot,
    temporaryParent,
    created,
    inventory,
    inventoryError,
    cleanupHooks,
  });
  if (operationError) {
    operationError.recoveryPaths = cleanup.recoveryPaths;
    operationError.foreignPaths = cleanup.foreignPaths;
    operationError.cleanupRetained = cleanup.retained;
    operationError.cleanupError = cleanup.error;
    operationError.dependencySummary = dependencySummary(offlineAdapters);
    throw operationError;
  }
  return withCleanupResult(result, cleanup);
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args);
  let result;
  let offlineAdapters;
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.error) {
      result = parsed.error;
    } else {
      const exampleRoot = options.exampleRoot ?? path.join(
        ROOT,
        "assets/examples",
        parsed.example,
      );
      const temporaryParent = options.temporaryParent ?? os.tmpdir();
      offlineAdapters = createOfflineAdapters(options);
      result = await testLeadCollector({
        exampleRoot,
        temporaryParent,
        offlineAdapters,
        clock: options.clock,
        cleanupHooks: options.cleanupHooks,
      });
    }
  } catch (error) {
    const recoveryPaths = error?.recoveryPaths ?? [];
    const foreignPaths = error?.foreignPaths ?? [];
    const issues = [issue(
      "BLOCKER",
      "B_EXAMPLE_RUNTIME",
      ".",
      "Example verification could not complete.",
      {
        error: error instanceof Error ? error.message : String(error),
        recovery_paths: recoveryPaths,
        foreign_paths: foreignPaths,
      },
    )];
    if (error?.cleanupRetained) {
      issues.push(issue(
        "BLOCKER",
        "B_EXAMPLE_CLEANUP_RETAINED",
        recoveryPaths[0] ?? ".",
        "Temporary cleanup retained a tree for manual recovery.",
        {
          error: error.cleanupError,
          recovery_paths: recoveryPaths,
          foreign_paths: foreignPaths,
        },
      ));
    }
    result = withExit(
      3,
      issues,
      {
        example: parsed.example ?? null,
        fixture_only: true,
        blockers: blockerCount(issues),
        ...(error?.dependencySummary ??
          (offlineAdapters ? dependencySummary(offlineAdapters) : {})),
        recovery_paths: recoveryPaths,
        foreign_paths: foreignPaths,
      },
    );
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
