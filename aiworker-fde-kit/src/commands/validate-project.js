import {
  lstat,
  mkdir,
  open,
  rename,
  rmdir,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stringify } from "yaml";

import {
  inspectOctopusCli,
} from "../assembly/cli-inspector.js";
import { loadCliEvidence } from "../assembly/cli-evidence.js";
import {
  assertCliBinaryIdentity,
  computeArtifactSetHashFromFiles,
  runDryrunValidation,
  snapshotCliBinaryIdentity,
} from "../assembly/dryrun-runner.js";
import {
  authoritativeStageHash,
  validateProjectDirectory,
} from "../contracts/project-validator.js";
import {
  deriveProjectStatus,
  deriveStageStates,
  STAGE_IDS,
  prepareStageAcceptance,
} from "../project/stage-state.js";
import { projectTransactionLockPath } from "../project/project-runtime.js";
import {
  removeIfOwned,
  writeValidationTransaction,
} from "../project/validation-report.js";
import { commandResult, issue } from "../shared/result.js";

const USAGE =
  "Usage: validate-project <absolute-project-dir> " +
  "[--accept-stage <stage-id>] " +
  "[--cli-fixture-dir <absolute-dir> | --cli-path <absolute-binary>] " +
  "[--run-assembly --profile <name> --team <id>]";
const ASSEMBLY_CATALOG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../catalog/assembly-operations.yaml",
);
const SUPERSEDED_ASSEMBLY_CODES = new Set([
  "B_PROJECT_STATUS_DRIFT",
  "B_ASSEMBLY_EVIDENCE_INVALID",
  "B_ASSEMBLY_EVIDENCE_RESULTS",
  "B_ASSEMBLY_EVIDENCE_STALE",
  "B_ASSEMBLY_EVIDENCE_UNEXPECTED",
]);

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function argumentFailure(code, message, project) {
  return {
    result: withExit(
      2,
      [issue("BLOCKER", code, ".", message)],
      { usage: USAGE },
    ),
    project,
  };
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length === 0) {
    return argumentFailure(
      "B_ARGUMENT_MISSING",
      "An absolute project directory is required.",
    );
  }
  if (args.includes("--help")) {
    return argumentFailure(
      "B_ARGUMENT_CONFLICT",
      "--help cannot be combined with other arguments.",
      path.isAbsolute(args[0]) ? args[0] : undefined,
    );
  }
  const project = args[0];
  if (project.startsWith("--")) {
    return argumentFailure(
      "B_ARGUMENT_MISSING",
      "The first argument must be the project directory.",
    );
  }
  if (!path.isAbsolute(project)) {
    return argumentFailure(
      "B_ARGUMENT_INVALID",
      "Project directory must be absolute.",
    );
  }
  const valueFlags = new Map([
    ["--accept-stage", "acceptStage"],
    ["--cli-fixture-dir", "cliFixtureDir"],
    ["--cli-path", "cliPath"],
    ["--profile", "profile"],
    ["--team", "team"],
  ]);
  const parsed = { project };
  const seen = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--run-assembly" || flag === "--run-dryrun") {
      if (seen.has(flag)) {
        return argumentFailure(
          "B_ARGUMENT_CONFLICT",
          `${flag} may only be specified once.`,
          project,
        );
      }
      seen.add(flag);
      parsed.runDryrun = true;
      continue;
    }
    if (!valueFlags.has(flag)) {
      return argumentFailure(
        "B_ARGUMENT_UNKNOWN",
        `Unknown argument: ${flag}`,
        project,
      );
    }
    if (seen.has(flag)) {
      return argumentFailure(
        "B_ARGUMENT_CONFLICT",
        `${flag} may only be specified once.`,
        project,
      );
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      return argumentFailure(
        "B_ARGUMENT_MISSING",
        `${flag} requires a value.`,
        project,
      );
    }
    if (
      ["--cli-fixture-dir", "--cli-path"].includes(flag) &&
      !path.isAbsolute(value)
    ) {
      return argumentFailure(
        "B_ARGUMENT_INVALID",
        `${flag} requires an absolute path.`,
        project,
      );
    }
    seen.add(flag);
    parsed[valueFlags.get(flag)] = value;
    index += 1;
  }
  if (
    parsed.acceptStage !== undefined &&
    !STAGE_IDS.includes(parsed.acceptStage)
  ) {
    return argumentFailure(
      "B_ARGUMENT_INVALID",
      `Unknown stage: ${parsed.acceptStage}.`,
      project,
    );
  }
  if (parsed.cliFixtureDir && parsed.cliPath) {
    return argumentFailure(
      "B_ARGUMENT_CONFLICT",
      "--cli-fixture-dir and --cli-path are mutually exclusive.",
      project,
    );
  }
  if (
    parsed.runDryrun &&
    (
      parsed.cliFixtureDir ||
      !parsed.cliPath ||
      !parsed.profile ||
      !parsed.team
    )
  ) {
    return argumentFailure(
      "B_ARGUMENT_CONFLICT",
      "--run-assembly requires absolute --cli-path, --profile, and --team, and cannot use a fixture.",
      project,
    );
  }
  if (
    !parsed.runDryrun &&
    (parsed.profile !== undefined || parsed.team !== undefined)
  ) {
    return argumentFailure(
      "B_ARGUMENT_CONFLICT",
      "--profile and --team are only valid with --run-assembly.",
      project,
    );
  }
  if (
    parsed.runDryrun &&
    (
      !/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u.test(parsed.profile) ||
      !/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/u.test(parsed.team)
    )
  ) {
    return argumentFailure(
      "B_ARGUMENT_INVALID",
      "--profile and --team must use safe explicit identifiers.",
      project,
    );
  }
  return parsed;
}

async function acquireProjectLock(projectRoot, fs) {
  const lockPath = projectTransactionLockPath(projectRoot);
  let handle;
  let identity;
  try {
    handle = await fs.open(lockPath, "wx", 0o600);
    identity = await handle.stat();
    await handle.writeFile(
      `${JSON.stringify({ command: "validate-project", pid: process.pid })}\n`,
    );
    await handle.sync();
    return { lockPath, handle, identity };
  } catch (caught) {
    if (caught?.code === "EEXIST") return null;
    const error =
      caught instanceof Error ? caught : new Error(String(caught));
    let retained = Boolean(handle);
    let cleanupError;
    try {
      await handle?.close();
      if (handle && identity) {
        await removeIfOwned(fs, lockPath, identity);
        retained = false;
      }
    } catch (cleanupFailure) {
      cleanupError =
        cleanupFailure instanceof Error
          ? cleanupFailure.message
          : String(cleanupFailure);
    }
    error.lockPath = lockPath;
    error.lockRetained = retained;
    error.lockCleanupError = cleanupError;
    error.recovery = retained
      ? "Inspect the retained transaction marker and remove it only after confirming no writer is active."
      : "The owned incomplete transaction marker was removed safely; retry the command.";
    throw error;
  }
}

async function releaseProjectLock(lock, fs) {
  await lock.handle.close();
  await removeIfOwned(fs, lock.lockPath, lock.identity);
}

function publicResult(result) {
  return {
    exitCode: result.exitCode,
    issues: result.issues,
    data: result.data,
  };
}

function runtimeResult(code, message, details = {}, data = {}) {
  return withExit(
    3,
    [issue("BLOCKER", code, ".", message, details)],
    data,
  );
}

function withDeferredCleanup(result, cleanupPaths) {
  const paths = [...new Set(cleanupPaths ?? [])];
  if (paths.length === 0) return result;
  return {
    ...result,
    issues: commandResult([
      ...result.issues,
      issue(
        "WARNING",
        "W_TRANSACTION_CLEANUP_DEFERRED",
        paths[0],
        "Validation committed, but transaction recovery artifacts were retained.",
        { recovery_paths: paths },
      ),
    ]).issues,
    data: {
      ...result.data,
      recovery_paths: [
        ...new Set([...(result.data?.recovery_paths ?? []), ...paths]),
      ],
    },
  };
}

function prepareDryrunSuccess(validation, versions) {
  const manifest = structuredClone(validation.context.manifest);
  const assembly = structuredClone(manifest.assembly);
  delete assembly.dryrun;
  assembly.assembly_execution = {
    status: "executed",
    script_file: "assembly/octopus-cli-assemble.sh",
    evidence_file: "reports/cli-assemble-evidence.json",
    cli_package_version: versions.npm_package,
    cli_reported_version: versions.cli_self_reported,
  };
  manifest.assembly = assembly;
  const remainingBlockers = validation.issues.filter((item) =>
    item.severity === "BLOCKER" &&
    !SUPERSEDED_ASSEMBLY_CODES.has(item.code));
  const assemblyBytes = Buffer.from(stringify(assembly), "utf8");
  const finalArtifactFiles = new Map(validation.context.files);
  finalArtifactFiles.set("assembly/operations.yaml", assemblyBytes);
  const finalPresent = new Set(finalArtifactFiles.keys());
  const finalHashes = Object.fromEntries(
    [...finalArtifactFiles].map(([relativePath, bytes]) => [
      relativePath,
      authoritativeStageHash(relativePath, bytes),
    ]),
  );
  const stageStates = deriveStageStates(
    manifest,
    validation.context.stageCatalog,
    {
      hashes: finalHashes,
      present: finalPresent,
      validStages: validation.context.validStages,
      workingStages: new Set(
        [...finalPresent]
          .filter((relativePath) =>
            /^\.stage-[a-z-]+\.in-progress$/u.test(relativePath))
          .map((relativePath) =>
            relativePath.slice(".stage-".length, -".in-progress".length)),
      ),
    },
  );
  manifest.project.status = deriveProjectStatus(
    manifest,
    stageStates,
    remainingBlockers,
  );
  const manifestBytes = Buffer.from(stringify(manifest), "utf8");
  finalArtifactFiles.set("fde-project.yaml", manifestBytes);
  return {
    manifestBytes,
    assemblyBytes,
    projectStatus: manifest.project.status,
    stageStates,
    artifactSetSha256: computeArtifactSetHashFromFiles(finalArtifactFiles),
    artifactFiles: finalArtifactFiles,
  };
}

function prepareDryrunDowngrade(validation, parsed, runIssues, dryrun) {
  const manifest = validation.context?.manifest;
  const supportedWrites =
    validation.context?.assemblyValidation?.supportedWrites ?? [];
  if (
    !manifest ||
    supportedWrites.length === 0 ||
    !validation.context.files.has("assembly/octopus-cli-assemble.sh")
  ) return null;
  const current = manifest.assembly?.assembly_execution;
  if (
    typeof current?.cli_package_version !== "string" ||
    typeof current?.cli_reported_version !== "string"
  ) return null;
  const updated = structuredClone(manifest);
  const assembly = structuredClone(updated.assembly);
  delete assembly.dryrun;
  assembly.assembly_execution = {
    status: "ready",
    script_file: "assembly/octopus-cli-assemble.sh",
    evidence_file: null,
    cli_package_version: current.cli_package_version,
    cli_reported_version: current.cli_reported_version,
  };
  updated.assembly = assembly;
  const assemblyBytes = Buffer.from(stringify(assembly), "utf8");
  const finalFiles = new Map(validation.context.files);
  finalFiles.set("assembly/operations.yaml", assemblyBytes);
  finalFiles.delete("reports/cli-assemble-evidence.json");
  finalFiles.delete("reports/cli-dryrun-evidence.json");
  const present = new Set(finalFiles.keys());
  const hashes = Object.fromEntries(
    [...finalFiles].map(([relativePath, bytes]) => [
      relativePath,
      authoritativeStageHash(relativePath, bytes),
    ]),
  );
  const stageStates = deriveStageStates(
    updated,
    validation.context.stageCatalog,
    {
      hashes,
      present,
      validStages: validation.context.validStages,
      workingStages: new Set(),
    },
  );
  const remainingBlockers = validation.issues.filter((item) =>
    item.severity === "BLOCKER" &&
    !SUPERSEDED_ASSEMBLY_CODES.has(item.code));
  updated.project.status = deriveProjectStatus(
    updated,
    stageStates,
    remainingBlockers,
  );
  const manifestBytes = Buffer.from(stringify(updated), "utf8");
  finalFiles.set("fde-project.yaml", manifestBytes);
  const artifactSetSha256 = computeArtifactSetHashFromFiles(finalFiles);
  const diagnostics = {
    schema_version: 1,
    run_id:
      dryrun?.evidence?.run_id ??
      dryrun?.runId ??
      parsed.runId ??
      "run-not-executed",
    profile: parsed.profile,
    team: parsed.team,
    exit_code: dryrun?.exitCode ?? 3,
    generated_at: dryrun?.evidence?.ended_at ?? null,
    artifact_set_sha256: artifactSetSha256,
    operations: dryrun?.diagnostics ?? [],
    blockers: runIssues.map(({ code }) => code),
  };
  return {
    manifestBytes,
    additionalFiles: new Map([
      ["assembly/operations.yaml", assemblyBytes],
      [
        "reports/cli-assemble-diagnostics.json",
        Buffer.from(`${JSON.stringify(diagnostics, null, 2)}\n`, "utf8"),
      ],
    ]),
    removePaths: [
      "reports/cli-assemble-evidence.json",
      "reports/cli-dryrun-evidence.json",
    ],
    validationSnapshot: validation.context.dryrunValidationSnapshot,
    projectStatus: updated.project.status,
    stageStates,
    artifactSetSha256,
    supersededCodes: SUPERSEDED_ASSEMBLY_CODES,
  };
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args);
  let result;
  let project;
  let lock;
  const fs = {
    lstat,
    mkdir,
    open,
    rename,
    rmdir,
    unlink,
    ...options.fs,
  };
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.result) {
      result = parsed.result;
      project = parsed.project;
      if (project) {
        try {
          if (!options.writeReports) {
            const root = await fs.lstat(project);
            if (root.isSymbolicLink() || !root.isDirectory()) {
              throw new Error("Project path must be a regular directory.");
            }
            lock = await acquireProjectLock(project, fs);
            if (!lock) {
              result.data = {
                ...result.data,
                report_deferred: "A cooperative writer lock is active.",
              };
            }
          }
          const mayWriteReport = options.writeReports || lock;
          if (mayWriteReport) {
            const transaction = await (
              options.writeReports ?? writeValidationTransaction
            )(project, result, {
              command: "validate-project",
              clock: options.clock,
              fs: options.fs,
              reportFault: options.reportFault,
            });
            result = withDeferredCleanup(result, transaction?.cleanupPaths);
          }
        } catch (error) {
          result = runtimeResult(
            "B_REPORT_WRITE",
            "Validation argument failure report could not be written.",
            {
              error: error instanceof Error ? error.message : String(error),
              error_code: error?.code,
              drift_paths: error?.driftPaths ?? [],
              recovery_errors: error?.recoveryErrors ?? [],
            },
            {
              recovery_paths:
                error?.recoveryPaths ??
                error?.cleanupPaths ??
                [],
            },
          );
        }
      }
    } else {
      project = parsed.project;
      if (!options.validateProject) {
        const root = await fs.lstat(project);
        if (root.isSymbolicLink() || !root.isDirectory()) {
          throw new Error("Project path must be a regular directory.");
        }
        lock = await acquireProjectLock(project, fs);
        if (!lock) {
          result = withExit(1, [
            issue(
              "BLOCKER",
              "B_PROJECT_TRANSACTION_LOCKED",
              ".",
              "Another cooperative project writer is active.",
            ),
          ]);
        }
      }
      if (!result) {
        let cliInspection;
        let cliEvidenceRoot;
        let inspectedCliIdentity;
        if (parsed.cliFixtureDir || parsed.cliPath) {
          const generatedRoot = path.join(project, "generated");
          await fs.mkdir(generatedRoot, { recursive: true, mode: 0o700 });
          const generatedMetadata = await fs.lstat(generatedRoot);
          if (
            generatedMetadata.isSymbolicLink() ||
            !generatedMetadata.isDirectory()
          ) {
            throw new Error(
              "Project generated directory must be a non-symbolic directory.",
            );
          }
          cliEvidenceRoot = path.join(
            generatedRoot,
            "validate-cli-evidence",
          );
          try {
            if (parsed.cliPath) {
              inspectedCliIdentity = await snapshotCliBinaryIdentity(
                parsed.cliPath,
              );
            }
            cliInspection = await (
              options.inspectCli ?? inspectOctopusCli
            )({
              fixtureDir: parsed.cliFixtureDir,
              cliPath:
                inspectedCliIdentity?.realpath ?? parsed.cliPath,
              output: cliEvidenceRoot,
              catalogPath:
                options.catalogPath ?? ASSEMBLY_CATALOG_PATH,
              spawnCommand:
                options.dependencies?.globalCli ?? options.spawnCommand,
              dependencies: options.dependencies,
            });
            if (inspectedCliIdentity) {
              await assertCliBinaryIdentity(inspectedCliIdentity);
            }
          } catch (error) {
            cliInspection = withExit(3, [issue(
              "BLOCKER",
              error?.code ?? "B_CLI_INSPECTION_RUNTIME",
              ".",
              "CLI evidence could not be inspected.",
              {
                error:
                  error instanceof Error ? error.message : String(error),
              },
            )]);
          }
        }
        let validation = await (
          options.validateProject ?? validateProjectDirectory
        )(project, {
          fs: options.fs,
          stageId: parsed.acceptStage,
          dependencies: options.dependencies,
        });
        const extraIssues = [];
        const extraData = {};
        let dryrunTransaction;
        let dryrunExitCode;
        let dryrunOutcome;
        let loadedCliEvidence;
        if (cliInspection) {
          if (cliInspection.exitCode === 0) {
            try {
              loadedCliEvidence = await loadCliEvidence(
                cliEvidenceRoot,
                validation.context?.assemblyValidation?.supportedWrites ?? [],
                validation.context?.assemblyCatalog,
                { requireContext: parsed.runDryrun === true },
              );
              extraIssues.push(...cliInspection.issues);
              extraData.cli_validation = {
                fixture_mode: Boolean(parsed.cliFixtureDir),
                status: "contract-valid",
                evidence_root: cliEvidenceRoot,
                versions: loadedCliEvidence.versions,
              };
            } catch (error) {
              extraIssues.push(issue(
                "BLOCKER",
                "B_CLI_EVIDENCE_INVALID",
                cliEvidenceRoot,
                "Task 6 CLI evidence does not satisfy the planned operation contract.",
                {
                  stage: "assemble",
                  error:
                    error instanceof Error ? error.message : String(error),
                },
              ));
            }
          } else {
            extraIssues.push(...cliInspection.issues);
            extraData.cli_validation = {
              fixture_mode: Boolean(parsed.cliFixtureDir),
              status: "blocked",
              evidence_root:
                cliInspection.data?.diagnostics_output ??
                cliEvidenceRoot,
            };
          }
        }
        if (parsed.runDryrun && loadedCliEvidence) {
          const supportedWrites =
            validation.context?.assemblyValidation?.supportedWrites ?? [];
          const catalogById = new Map(
            (validation.context?.assemblyCatalog?.supported ?? [])
              .map((operation) => [operation.operation_id, operation]),
          );
          const assemblyBlocker = validation.issues.some((item) =>
            item.severity === "BLOCKER" &&
            item.details?.stage === "assemble");
          if (supportedWrites.length === 0 || assemblyBlocker) {
            extraIssues.push(issue(
              "BLOCKER",
              "B_ASSEMBLY_NOT_READY",
              "assembly",
              "Assembly execution requires at least one fully validated supported write and script.",
              { stage: "assemble" },
            ));
          } else {
            const preparedSuccess = prepareDryrunSuccess(
              validation,
              loadedCliEvidence.versions,
            );
            try {
              dryrunOutcome = await (
                options.runDryrun ?? runDryrunValidation
              )({
                projectRoot: project,
                operations: supportedWrites,
                catalogById,
                cliPath: parsed.cliPath,
                profile: parsed.profile,
                team: parsed.team,
                cliVersions: loadedCliEvidence.versions,
                contextProbe: loadedCliEvidence.contextProbe,
                expectedCliIdentity: inspectedCliIdentity,
                artifactSetSha256: preparedSuccess.artifactSetSha256,
                artifactFiles: preparedSuccess.artifactFiles,
                execute:
                  options.executeDryrun ?? options.dependencies?.globalCli,
                runId: options.runId,
                clock: options.clock,
              });
            } catch (error) {
              dryrunExitCode = error?.exitCode === 2 ? 2 : 3;
              const recoveryPaths = error?.recoveryPaths ?? [];
              extraIssues.push(issue(
                dryrunExitCode === 2 ? "BLOCKER" : "WARNING",
                "B_ASSEMBLY_PREFLIGHT_FAILED",
                "reports/cli-assemble-diagnostics.json",
                "CLI assembly preflight failed before a successful run could be bound.",
                {
                  stage: "validate",
                  error: error instanceof Error
                    ? error.message
                    : String(error),
                  recovery_paths: recoveryPaths,
                  cleanup_warning: error?.cleanupWarning ?? null,
                },
              ));
              if (recoveryPaths.length > 0) {
                extraData.recovery_paths = [
                  ...new Set([
                    ...(extraData.recovery_paths ?? []),
                    ...recoveryPaths,
                  ]),
                ];
              }
              if (error?.cleanupWarning) {
                extraData.cleanup_warning = error.cleanupWarning;
              }
            }
            if (dryrunOutcome) {
              dryrunExitCode = dryrunOutcome.exitCode;
              const runId =
                dryrunOutcome.evidence?.run_id ?? dryrunOutcome.runId;
              if (
                dryrunOutcome.exitCode === 0 &&
                dryrunOutcome.evidence
              ) {
                if (
                  dryrunOutcome.evidence.artifact_set_sha256 !==
                  preparedSuccess.artifactSetSha256
                ) {
                  throw new Error(
                    "Assembly evidence did not preserve the prepared artifact binding.",
                  );
                }
                const diagnostics = {
                  schema_version: 1,
                  run_id: runId,
                  profile: parsed.profile,
                  team: parsed.team,
                  exit_code: 0,
                  generated_at: dryrunOutcome.evidence.ended_at,
                  artifact_set_sha256: preparedSuccess.artifactSetSha256,
                  operations: dryrunOutcome.diagnostics,
                };
                dryrunTransaction = {
                  manifestBytes: preparedSuccess.manifestBytes,
                  additionalFiles: new Map([
                    [
                      "assembly/operations.yaml",
                      preparedSuccess.assemblyBytes,
                    ],
                    [
                      "reports/cli-assemble-diagnostics.json",
                      Buffer.from(
                        `${JSON.stringify(diagnostics, null, 2)}\n`,
                        "utf8",
                      ),
                    ],
                    [
                      "reports/cli-assemble-evidence.json",
                      Buffer.from(
                        `${JSON.stringify(dryrunOutcome.evidence, null, 2)}\n`,
                        "utf8",
                      ),
                    ],
                  ]),
                  removePaths: [],
                  validationSnapshot:
                    validation.context.dryrunValidationSnapshot,
                  projectStatus: preparedSuccess.projectStatus,
                  stageStates: preparedSuccess.stageStates,
                  artifactSetSha256: preparedSuccess.artifactSetSha256,
                  supersededCodes: SUPERSEDED_ASSEMBLY_CODES,
                };
              }
              extraData.assembly_execution = {
                run_id: runId,
                profile: parsed.profile,
                team: parsed.team,
                artifact_set_sha256:
                  dryrunOutcome.exitCode === 0
                    ? preparedSuccess.artifactSetSha256
                    : null,
                binary_sha256:
                  dryrunOutcome.evidence?.cli?.binary_sha256 ?? null,
                status:
                  dryrunOutcome.exitCode === 0 ? "passed" : "failed",
              };
            }
            if (dryrunOutcome?.exitCode === 1) {
              extraIssues.push(issue(
                "BLOCKER",
                "B_ASSEMBLY_CONTRACT_FAILED",
                "reports/cli-assemble-evidence.json",
                "CLI assembly rejected a command, JSON payload, or schema contract.",
                { stage: "validate" },
              ));
            } else if (dryrunOutcome?.exitCode === 3) {
              extraIssues.push(issue(
                "WARNING",
                "W_ASSEMBLY_ENVIRONMENT",
                "reports/cli-assemble-evidence.json",
                "CLI assembly could not validate the selected Profile or Team environment.",
                { stage: "validate" },
              ));
            }
          }
        }
        if (parsed.runDryrun && !dryrunTransaction) {
          dryrunTransaction = prepareDryrunDowngrade(
            validation,
            { ...parsed, runId: options.runId },
            extraIssues,
            dryrunOutcome,
          );
          if (dryrunTransaction && dryrunExitCode === undefined) {
            dryrunExitCode = cliInspection?.exitCode === 3 ? 3 : 1;
          }
          if (dryrunTransaction && extraData.assembly_execution) {
            extraData.assembly_execution.artifact_set_sha256 =
              dryrunTransaction.artifactSetSha256;
          }
        }
        let manifestBytes;
        let validationSnapshot;
        if (parsed.acceptStage) {
          const acceptance = prepareStageAcceptance(
            validation,
            parsed.acceptStage,
          );
          result = acceptance.result;
          manifestBytes = acceptance.manifestBytes;
          validationSnapshot = acceptance.validationSnapshot;
        } else {
          result = publicResult(validation);
        }
        if (dryrunTransaction) {
          result = commandResult(
            result.issues.filter((item) =>
              !dryrunTransaction.supersededCodes.has(item.code)),
            result.data,
          );
          manifestBytes = dryrunTransaction.manifestBytes;
          validationSnapshot = dryrunTransaction.validationSnapshot;
          result.data = {
            ...result.data,
            project_status: dryrunTransaction.projectStatus,
            stage_states: dryrunTransaction.stageStates,
          };
        } else if (
          parsed.runDryrun &&
          result.data?.project_status === "cli-assembled"
        ) {
          result.data = {
            ...result.data,
            project_status: "reviewable",
          };
        }
        if (extraIssues.length > 0 || Object.keys(extraData).length > 0) {
          result = {
            ...commandResult(
              [...result.issues, ...extraIssues],
              { ...result.data, ...extraData },
            ),
          };
        }
        const command = parsed.runDryrun
          ? "validate-project --run-assembly " +
            "--cli-path <absolute-cli> " +
            `--profile ${parsed.profile} --team ${parsed.team}`
          : parsed.acceptStage
            ? `validate-project --accept-stage ${parsed.acceptStage}`
            : "validate-project";
        try {
          const transaction = await (
            options.writeReports ?? writeValidationTransaction
          )(project, result, {
            command,
            failedStage:
              result.exitCode === 0 ? undefined : parsed.acceptStage,
            manifestBytes,
            validationSnapshot,
            additionalFiles: dryrunTransaction?.additionalFiles,
            removePaths: dryrunTransaction?.removePaths,
            clock: options.clock,
            fs: options.fs,
            reportFault: options.reportFault,
          });
          result = withDeferredCleanup(result, transaction?.cleanupPaths);
        } catch (error) {
          result = runtimeResult(
            "B_REPORT_WRITE",
            "Validation report transaction failed.",
            {
              error: error instanceof Error ? error.message : String(error),
              error_code: error?.code,
              drift_paths: error?.driftPaths ?? [],
              recovery_errors: error?.recoveryErrors ?? [],
            },
            {
              recovery_paths:
                error?.recoveryPaths ??
                error?.cleanupPaths ??
                [],
            },
          );
        }
      }
    }
  } catch (error) {
    result = runtimeResult(
      "B_PROJECT_RUNTIME",
      "Project could not be read or validated.",
      {
        error: error instanceof Error ? error.message : String(error),
        lock_cleanup_error: error?.lockCleanupError,
      },
      error?.lockPath
        ? {
            lock_path: error.lockPath,
            lock_retained: error.lockRetained,
            recovery: error.recovery,
          }
        : {},
    );
  } finally {
    if (lock) {
      try {
        await releaseProjectLock(lock, fs);
      } catch (error) {
        const recoveryPaths =
          error?.recoveryPaths ?? [lock.lockPath];
        if (result?.exitCode === 0) {
          result = commandResult(
            [
              ...result.issues,
              issue(
                "WARNING",
                "W_TRANSACTION_CLEANUP_DEFERRED",
                recoveryPaths[0],
                "Validation committed but lock cleanup was deferred.",
                {
                  error: error instanceof Error ? error.message : String(error),
                  recovery_paths: recoveryPaths,
                },
              ),
            ],
            {
              ...result.data,
              recovery_paths: recoveryPaths,
            },
          );
        } else if (result) {
          result.data = {
            ...result.data,
            recovery_paths: recoveryPaths,
          };
        }
      }
    }
  }
  writeStdout(`${JSON.stringify(result)}\n`);
  return result.exitCode;
}

if (
  process.env.AIWORKER_BUNDLED_RUNTIME !== "1" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = await main(process.argv.slice(2));
}

export { USAGE };
