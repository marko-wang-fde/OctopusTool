import {
  chmod,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse, stringify } from "yaml";
import { beforeEach, describe, expect, it } from "vitest";

import { main } from "../../src/commands/validate-project.js";
import {
  validateProjectDirectory,
} from "../../src/contracts/project-validator.js";
import {
  computeArtifactSetHash,
} from "../../src/assembly/dryrun-runner.js";
import {
  renderDryrunScript,
} from "../../src/assembly/dryrun-renderer.js";
import {
  canonicalBytes,
  sha256Bytes,
} from "../../src/shared/canonical.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TEMPLATE = path.join(ROOT, "assets/project-template");
const RAW_CLI_FIXTURE = path.join(ROOT, "test/fixtures/cli/valid");
const ASSEMBLY_FIXTURE = path.join(
  ROOT,
  "test/fixtures/assembly/renderable-project/assembly",
);
let project;

beforeEach(async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "fde-validate-cli-"));
  project = path.join(parent, "project");
  await cp(TEMPLATE, project, { recursive: true });
});

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function installRenderableAssembly() {
  const operationsText = await readFile(
    path.join(ASSEMBLY_FIXTURE, "operations.yaml"),
    "utf8",
  );
  const operations = parse(operationsText);
  await writeFile(
    path.join(project, "assembly/operations.yaml"),
    operationsText,
  );
  await mkdir(path.join(project, "assembly/payloads"), { recursive: true });
  await cp(
    path.join(ASSEMBLY_FIXTURE, "payloads/example.json"),
    path.join(project, "assembly/payloads/example.json"),
  );
  const manifestPath = path.join(project, "fde-project.yaml");
  const manifest = parse(await readFile(manifestPath, "utf8"));
  manifest.assembly = operations;
  await writeFile(manifestPath, stringify(manifest));
}

async function makeAssemblyReady() {
  const operationsPath = path.join(project, "assembly/operations.yaml");
  const operations = parse(await readFile(operationsPath, "utf8"));
  const operation = operations.operations[0];
  const catalogOperation = {
    operation_id: operation.operation_id,
    command_path: operation.command_path,
    positional_args: [],
    options: {
      payload: "--body-file",
      output: "--json",
    },
  };
  await writeFile(
    path.join(project, "assembly/octopus-cli-assemble.sh"),
    renderDryrunScript(
      [operation],
      new Map([[operation.operation_id, catalogOperation]]),
    ),
    { mode: 0o755 },
  );
  operations.assembly_execution = {
    status: "ready",
    script_file: "assembly/octopus-cli-assemble.sh",
    evidence_file: null,
    cli_package_version: "0.1.1",
    cli_reported_version: "0.1.0",
  };
  await writeFile(operationsPath, stringify(operations));
  const manifestPath = path.join(project, "fde-project.yaml");
  const manifest = parse(await readFile(manifestPath, "utf8"));
  manifest.assembly = operations;
  await writeFile(manifestPath, stringify(manifest));
}

describe("validate-project CLI assembly interface", () => {
  it("documents all exact CLI evidence and assembly flags", async () => {
    const help = await invoke(["--help"]);
    expect(help.result.data.usage).toBe(
      "Usage: validate-project <absolute-project-dir> " +
      "[--accept-stage <stage-id>] " +
      "[--cli-fixture-dir <absolute-dir> | --cli-path <absolute-binary>] " +
      "[--run-assembly --profile <name> --team <id>]",
    );
  });

  it.each([
    ["fixture and run", (binary) => [
      "--cli-fixture-dir", RAW_CLI_FIXTURE,
      "--cli-path", binary,
      "--run-assembly", "--profile", "fde", "--team", "team-1",
    ]],
    ["run missing profile", (binary) => [
      "--cli-path", binary, "--run-assembly", "--team", "team-1",
    ]],
    ["run missing team", (binary) => [
      "--cli-path", binary, "--run-assembly", "--profile", "fde",
    ]],
    ["run relative cli", () => [
      "--cli-path", "octopus-cli", "--run-assembly",
      "--profile", "fde", "--team", "team-1",
    ]],
    ["profile without run", (binary) => [
      "--cli-path", binary, "--profile", "fde",
    ]],
  ])("rejects %s before validation", async (_label, flags) => {
    const binary = path.join(path.dirname(project), "octopus-cli");
    await writeFile(binary, "#!/bin/sh\nexit 0\n");
    await chmod(binary, 0o755);
    expect((await invoke([project, ...flags(binary)])).exitCode).toBe(2);
  });

  it("consumes Task 6 raw fixture evidence without spawning a CLI", async () => {
    await installRenderableAssembly();
    const inspected = async ({ output }) => {
      await cp(
        path.join(ROOT, "test/fixtures/assembly/renderable-cli"),
        output,
        { recursive: true },
      );
      return {
        exitCode: 0,
        issues: [],
        data: {
          output,
          fixture_mode: true,
          versions: {
            npm_package: "0.1.1",
            cli_self_reported: "0.1.0",
          },
        },
      };
    };
    const { result } = await invoke([
      project,
      "--cli-fixture-dir",
      RAW_CLI_FIXTURE,
    ], { inspectCli: inspected });

    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_EVIDENCE_INVALID",
    }));
    expect(result.data.cli_validation).toMatchObject({
      fixture_mode: true,
      status: "contract-valid",
    });
    expect(result.data.project_status).not.toBe("cli-assembled");
  });

  it("treats a byte-tampered rendered script as a project blocker", async () => {
    await installRenderableAssembly();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.assembly.assembly_execution = {
      status: "ready",
      script_file: "assembly/octopus-cli-assemble.sh",
      evidence_file: null,
      cli_package_version: "0.1.1",
      cli_reported_version: "0.1.0",
    };
    await writeFile(manifestPath, stringify(manifest));
    await writeFile(
      path.join(project, "assembly/operations.yaml"),
      stringify(manifest.assembly),
    );
    await writeFile(
      path.join(project, "assembly/octopus-cli-assemble.sh"),
      "#!/usr/bin/env bash\nset -euo pipefail\noctopus-cli configure skill set add\n",
    );

    const result = await validateProjectDirectory(project);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_SCRIPT_TAMPERED",
    }));
  });

  it("runs all supported writes once and writes evidence only with explicit context", async () => {
    await installRenderableAssembly();
    await makeAssemblyReady();
    const staleManifestPath = path.join(project, "fde-project.yaml");
    const staleOperationsPath = path.join(
      project,
      "assembly/operations.yaml",
    );
    const staleManifest = parse(await readFile(staleManifestPath, "utf8"));
    const staleOperations = parse(
      await readFile(staleOperationsPath, "utf8"),
    );
    const staleState = {
      ...staleOperations.assembly_execution,
      status: "executed",
      evidence_file: "reports/cli-assemble-evidence.json",
    };
    staleManifest.assembly.assembly_execution = staleState;
    staleManifest.project.status = "cli-assembled";
    staleOperations.assembly_execution = staleState;
    await writeFile(staleManifestPath, stringify(staleManifest));
    await writeFile(staleOperationsPath, stringify(staleOperations));
    await writeFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      '{"run_id":"old-invalid-success"}\n',
    );
    const binary = path.join(path.dirname(project), "octopus-cli");
    await writeFile(binary, "#!/bin/sh\nexit 0\n");
    await chmod(binary, 0o755);
    const inspected = async ({ output }) => {
      await cp(
        path.join(ROOT, "test/fixtures/assembly/renderable-cli"),
        output,
        { recursive: true },
      );
      return {
        exitCode: 0,
        issues: [],
        data: {
          output,
          fixture_mode: false,
          versions: {
            npm_package: "0.1.1",
            cli_self_reported: "0.1.0",
          },
        },
      };
    };
    let runInvocation;
    const runDryrun = async (invocation) => {
      runInvocation = invocation;
      return {
      exitCode: 0,
      evidence: {
        schema_version: 1,
        run_id: "run-1",
        profile: "fde",
        team: "team-1",
        cli: {
          npm_package_version: "0.1.1",
          reported_version: "0.1.0",
          binary_realpath: binary,
          binary_sha256: "b".repeat(64),
        },
        artifact_set_sha256: invocation.artifactSetSha256,
        started_at: "2026-07-24T00:00:00.000Z",
        ended_at: "2026-07-24T00:00:01.000Z",
        operations: [{
          operation_id: "skill-set.create",
          status: "passed",
          mapped_exit_code: 0,
          argv_sha256: "c".repeat(64),
        }],
      },
      diagnostics: [],
      };
    };
    const { result } = await invoke([
      project,
      "--cli-path",
      binary,
      "--run-assembly",
      "--profile",
      "fde",
      "--team",
      "team-1",
    ], { inspectCli: inspected, runDryrun });

    expect(result.data.assembly_execution).toMatchObject({
      run_id: "run-1",
      profile: "fde",
      team: "team-1",
    });
    expect(runInvocation.artifactSetSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(runInvocation.artifactFiles).toBeInstanceOf(Map);
    expect(runInvocation.artifactFiles.get("fde-project.yaml"))
      .toEqual(expect.any(Buffer));
    expect(runInvocation.artifactFiles.get("assembly/operations.yaml"))
      .toEqual(expect.any(Buffer));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_EVIDENCE_INVALID",
    }));
    const publishedEvidence = JSON.parse(await readFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      "utf8",
    ));
    expect(publishedEvidence).toMatchObject({ run_id: "run-1" });
    expect(publishedEvidence.artifact_set_sha256)
      .toBe(await computeArtifactSetHash(project));
    const manifest = parse(await readFile(
      path.join(project, "fde-project.yaml"),
      "utf8",
    ));
    const operations = parse(await readFile(
      path.join(project, "assembly/operations.yaml"),
      "utf8",
    ));
    const report = JSON.parse(await readFile(
      path.join(project, "reports/validation-report.json"),
      "utf8",
    ));
    expect(manifest.assembly.assembly_execution).toMatchObject({
      status: "executed",
      evidence_file: "reports/cli-assemble-evidence.json",
    });
    expect(operations.assembly_execution).toEqual(manifest.assembly.assembly_execution);
    expect(report.command).toContain("--run-assembly");
    expect(JSON.parse(await readFile(
      path.join(project, "reports/cli-assemble-diagnostics.json"),
      "utf8",
    ))).toMatchObject({ run_id: "run-1" });
    const fresh = await validateProjectDirectory(project);
    expect(fresh.data.project_status).toBe(manifest.project.status);
    expect(fresh.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_EVIDENCE_STALE",
    }));
    expect(fresh.issues).not.toContainEqual(expect.objectContaining({
      code: "B_PROJECT_STATUS_DRIFT",
    }));
  });

  it("downgrades stale validated state and evidence when a new run has an environment failure", async () => {
    await installRenderableAssembly();
    await makeAssemblyReady();
    const manifestPath = path.join(project, "fde-project.yaml");
    const operationsPath = path.join(project, "assembly/operations.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    const operations = parse(await readFile(operationsPath, "utf8"));
    const staleValidated = {
      ...operations.assembly_execution,
      status: "executed",
      evidence_file: "reports/cli-assemble-evidence.json",
    };
    manifest.assembly.assembly_execution = staleValidated;
    manifest.project.status = "cli-assembled";
    operations.assembly_execution = staleValidated;
    await writeFile(manifestPath, stringify(manifest));
    await writeFile(operationsPath, stringify(operations));
    await writeFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      '{"run_id":"old-success"}\n',
    );
    const binary = path.join(path.dirname(project), "octopus-cli");
    await writeFile(binary, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    const inspected = async ({ output }) => {
      await cp(
        path.join(ROOT, "test/fixtures/assembly/renderable-cli"),
        output,
        { recursive: true },
      );
      return {
        exitCode: 0,
        issues: [],
        data: {
          output,
          fixture_mode: false,
          versions: {
            npm_package: "0.1.1",
            cli_self_reported: "0.1.0",
          },
        },
      };
    };
    const failedRun = async () => ({
      exitCode: 3,
      evidence: {
        schema_version: 1,
        run_id: "run-failed",
        profile: "fde",
        team: "team-1",
        cli: {
          npm_package_version: "0.1.1",
          reported_version: "0.1.0",
          binary_realpath: binary,
          binary_sha256: "b".repeat(64),
        },
        artifact_set_sha256: "a".repeat(64),
        started_at: "2026-07-24T00:00:00.000Z",
        ended_at: "2026-07-24T00:00:01.000Z",
        operations: [{
          operation_id: "skill-set.create",
          status: "failed",
          mapped_exit_code: 3,
          argv_sha256: "c".repeat(64),
        }],
      },
      diagnostics: [{
        operation_id: "skill-set.create",
        raw_exit_code: 1,
        signal: null,
        stderr: "profile expired",
      }],
    });
    const validateWithoutFixtureDrift = async (...args) => {
      const validation = await validateProjectDirectory(...args);
      validation.issues = validation.issues.filter(
        ({ code }) => code !== "B_WORKER_PAYLOAD_DRIFT",
      );
      validation.exitCode = validation.issues.some(
        ({ severity }) => severity === "BLOCKER",
      ) ? 1 : 0;
      return validation;
    };
    const environmentFailure = await invoke([
      project,
      "--cli-path",
      binary,
      "--run-assembly",
      "--profile",
      "fde",
      "--team",
      "team-1",
    ], {
      inspectCli: inspected,
      runDryrun: failedRun,
      validateProject: validateWithoutFixtureDrift,
    });
    expect(environmentFailure.result.issues.filter(
      ({ severity }) => severity === "BLOCKER",
    )).toEqual([]);
    expect(environmentFailure.exitCode).toBe(0);
    expect(environmentFailure.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "WARNING",
        code: "W_ASSEMBLY_ENVIRONMENT",
      }),
    );

    const downgraded = parse(await readFile(manifestPath, "utf8"));
    expect(downgraded.assembly.assembly_execution.status).not.toBe("validated");
    expect(downgraded.project.status).not.toBe("cli-assembled");
    await expect(readFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      "utf8",
    )).rejects.toMatchObject({ code: "ENOENT" });
    expect(JSON.parse(await readFile(
      path.join(project, "reports/cli-assemble-diagnostics.json"),
      "utf8",
    ))).toMatchObject({ run_id: "run-failed", exit_code: 3 });

    const cleanupRecoveryPath = path.join(
      path.dirname(project),
      "fde-project-exec-cleanup-recovery",
    );
    const cleanupFailure = Object.assign(
      new Error("project snapshot cleanup stopped on an ownership mismatch"),
      {
        recoveryPaths: [cleanupRecoveryPath],
        cleanupWarning: {
          code: "W_PROJECT_SNAPSHOT_CLEANUP",
          message: "owned snapshot cleanup stopped",
        },
      },
    );
    const environmentFailureWithBlocker = await invoke([
      project,
      "--cli-path",
      binary,
      "--run-assembly",
      "--profile",
      "fde",
      "--team",
      "team-1",
    ], {
      inspectCli: inspected,
      runDryrun: async () => {
        throw cleanupFailure;
      },
      validateProject: async (...args) => {
        const validation = await validateWithoutFixtureDrift(...args);
        validation.issues.push({
          severity: "BLOCKER",
          code: "B_UNRELATED_PROJECT",
          path: "delivery-summary.md",
          message: "unrelated project blocker",
          details: { stage: "validate" },
        });
        validation.exitCode = 1;
        return validation;
      },
    });
    expect(environmentFailureWithBlocker.exitCode).toBe(1);
    expect(environmentFailureWithBlocker.result.issues).toContainEqual(
      expect.objectContaining({ code: "B_UNRELATED_PROJECT" }),
    );
    expect(environmentFailureWithBlocker.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "WARNING",
        code: "B_ASSEMBLY_PREFLIGHT_FAILED",
        details: expect.objectContaining({
          recovery_paths: [cleanupRecoveryPath],
          cleanup_warning: {
            code: "W_PROJECT_SNAPSHOT_CLEANUP",
            message: "owned snapshot cleanup stopped",
          },
        }),
      }),
    );
    expect(environmentFailureWithBlocker.result.data.recovery_paths)
      .toContain(cleanupRecoveryPath);
    expect(environmentFailureWithBlocker.result.data.cleanup_warning).toEqual({
      code: "W_PROJECT_SNAPSHOT_CLEANUP",
      message: "owned snapshot cleanup stopped",
    });

    const resetManifest = parse(await readFile(manifestPath, "utf8"));
    const resetOperations = parse(await readFile(operationsPath, "utf8"));
    resetManifest.assembly.assembly_execution = staleValidated;
    resetManifest.project.status = "cli-assembled";
    resetOperations.assembly_execution = staleValidated;
    await writeFile(manifestPath, stringify(resetManifest));
    await writeFile(operationsPath, stringify(resetOperations));
    await writeFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      '{"run_id":"old-success-again"}\n',
    );
    const inspectionFailure = await invoke([
      project,
      "--cli-path",
      binary,
      "--run-assembly",
      "--profile",
      "fde",
      "--team",
      "team-1",
    ], {
      inspectCli: async () => ({
        exitCode: 3,
        issues: [{
          severity: "BLOCKER",
          code: "B_CLI_INSPECTION_RUNTIME",
          path: ".",
          message: "inspection failed",
          details: {},
        }],
        data: {},
      }),
    });
    expect(inspectionFailure.result.data.project_status)
      .not.toBe("cli-assembled");
    expect(parse(await readFile(manifestPath, "utf8")).assembly.assembly_execution.status)
      .toBe("ready");
    await expect(readFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("accepts only current, complete, same-run assembly evidence", async () => {
    await installRenderableAssembly();
    const operationPlan = parse(await readFile(
      path.join(project, "assembly/operations.yaml"),
      "utf8",
    ));
    const operation = operationPlan.operations[0];
    const catalogOperation = {
      operation_id: "team-private-digiworker.create",
      command_path: ["configure", "team", "private-digiworkers", "add"],
      positional_args: [],
      options: {
        payload: "--body-file",
        output: "--json",
      },
    };
    const script = renderDryrunScript(
      [operation],
      new Map([[operation.operation_id, catalogOperation]]),
    );
    await writeFile(
      path.join(project, "assembly/octopus-cli-assemble.sh"),
      script,
      { mode: 0o755 },
    );
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    const assemblyExecution = {
      status: "executed",
      script_file: "assembly/octopus-cli-assemble.sh",
      evidence_file: "reports/cli-assemble-evidence.json",
      cli_package_version: "0.1.1",
      cli_reported_version: "0.1.0",
    };
    manifest.assembly.assembly_execution = assemblyExecution;
    operationPlan.assembly_execution = assemblyExecution;
    await writeFile(manifestPath, stringify(manifest));
    await writeFile(
      path.join(project, "assembly/operations.yaml"),
      stringify(operationPlan),
    );
    const artifactHash = await computeArtifactSetHash(project);
    const argv = [
      "skill",
      "set",
      "create",
      "--body-file",
      "assembly/payloads/example.json",
      "--json",
    ];
    const evidence = {
      schema_version: 1,
      run_id: "run-1",
      profile: "fde",
      team: "team-1",
      cli: {
        npm_package_version: "0.1.1",
        reported_version: "0.1.0",
        binary_realpath: "/opt/octopus-cli",
        binary_sha256: "b".repeat(64),
      },
      artifact_set_sha256: artifactHash,
      started_at: "2026-07-24T00:00:00.000Z",
      ended_at: "2026-07-24T00:00:01.000Z",
      operations: [{
        operation_id: "skill-set.create",
        status: "passed",
        mapped_exit_code: 0,
        argv_sha256: sha256Bytes(canonicalBytes(argv)),
      }],
    };
    await writeFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      `${JSON.stringify(evidence)}\n`,
    );

    const current = await validateProjectDirectory(project);
    expect(current.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_EVIDENCE_INVALID",
    }));
    expect(current.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_EVIDENCE_STALE",
    }));

    await writeFile(path.join(project, "delivery-summary.md"), "changed\n");
    const stale = await validateProjectDirectory(project);
    expect(stale.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_EVIDENCE_STALE",
    }));

    await writeFile(
      path.join(project, "delivery-summary.md"),
      await readFile(path.join(TEMPLATE, "delivery-summary.md")),
    );
    evidence.operations = [];
    await writeFile(
      path.join(project, "reports/cli-assemble-evidence.json"),
      `${JSON.stringify(evidence)}\n`,
    );
    const partial = await validateProjectDirectory(project);
    expect(partial.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_EVIDENCE_RESULTS",
    }));
  });
});
