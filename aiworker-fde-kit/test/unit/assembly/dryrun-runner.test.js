import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeArtifactSetHash,
  runDryrunValidation,
  validateDryrunEvidence,
  writeDryrunEvidenceAtomic,
} from "../../../src/assembly/dryrun-runner.js";
import { sha256Bytes } from "../../../src/shared/canonical.js";

let root;
const operation = {
  operation_id: "skill-set.create",
  support: "supported",
  operation_kind: "write",
  command_path: ["configure", "skill", "set", "add"],
  payload_file: "assembly/payloads/example.json",
};
const catalog = new Map([[
  operation.operation_id,
  {
    operation_id: operation.operation_id,
    command_path: operation.command_path,
    positional_args: [],
    options: {
      payload: "--body-file",
      output: "--json",
    },
  },
]]);
const contextProbe = {
  operation_id: "auth.whoami",
  operation_kind: "read",
  executor: "octopus-cli",
  command_path: ["auth", "whoami"],
  positional_args: [],
  options: { profile: "--profile", output: "--json" },
  output_contract: {
    format: "json",
    profile_path: ["profile"],
    team_path: ["team", "id"],
  },
  explicit_context_argv: null,
};

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "fde-dryrun-"));
  await mkdir(path.join(root, "assembly/payloads"), { recursive: true });
  await writeFile(path.join(root, "fde-project.yaml"), [
    "project:",
    "  name: Example  ",
    "",
  ].join("\r\n"));
  await writeFile(
    path.join(root, "assembly/operations.yaml"),
    "operations: []\n",
  );
  await writeFile(
    path.join(root, "assembly/payloads/example.json"),
    '{"b":2,"a":1}\n',
  );
  await writeFile(path.join(root, "delivery-summary.md"), "Summary  \r\n");
});

async function fakeBinary(name = "octopus-cli") {
  const target = path.join(root, name);
  await writeFile(target, "#!/bin/sh\nexit 0\n");
  await chmod(target, 0o755);
  return target;
}

async function artifactFileMap() {
  return new Map(await Promise.all([
    "fde-project.yaml",
    "assembly/operations.yaml",
    "assembly/payloads/example.json",
    "delivery-summary.md",
  ].map(async (relativePath) => [
    relativePath,
    await readFile(path.join(root, ...relativePath.split("/"))),
  ])));
}

async function projectSnapshotTempEntries() {
  return new Set(
    (await readdir(os.tmpdir()))
      .filter((name) => name.startsWith("fde-project-exec-")),
  );
}

describe("artifact-set hashing", () => {
  it("uses exact delivery paths and type-specific canonical bytes", async () => {
    const first = await computeArtifactSetHash(root);
    await mkdir(path.join(root, "reports"));
    await writeFile(path.join(root, "reports/ignored.json"), "{}\n");
    await mkdir(path.join(root, "inputs/source-files"), { recursive: true });
    await writeFile(path.join(root, "inputs/source-files/ignored.txt"), "x");
    const ignored = await computeArtifactSetHash(root);
    expect(ignored).toEqual(first);

    await writeFile(
      path.join(root, "assembly/payloads/example.json"),
      '{ "a": 1, "b": 2 }\n',
    );
    const canonicalEquivalent = await computeArtifactSetHash(root);
    expect(canonicalEquivalent).toEqual(first);

    await writeFile(path.join(root, "delivery-summary.md"), "Changed\n");
    expect(await computeArtifactSetHash(root)).not.toEqual(first);
  });

  it("rejects symbolic links in the artifact set", async () => {
    await symlink(
      path.join(root, "delivery-summary.md"),
      path.join(root, "assembly/payloads/link.json"),
    );
    await expect(computeArtifactSetHash(root)).rejects.toThrow(/symbolic/iu);
  });
});

describe("runDryrunValidation", () => {
  it.each([
    "/absolute.json",
    "../escape.json",
    "skills/../escape.json",
    "skills/./escape.json",
    "skills//escape.json",
    "skills\\escape.json",
    "skills/\u0000escape.json",
    "skills/\u001fescape.json",
    "skills/%2e%2e/escape.json",
    "C:/escape.json",
  ])("rejects unsafe caller-supplied artifact path %j", async (unsafePath) => {
    const binary = await fakeBinary();
    const artifactFiles = await artifactFileMap();
    artifactFiles.set(unsafePath, Buffer.from("{}\n"));

    await expect(runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      contextProbe,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      artifactFiles,
      execute: vi.fn(),
    })).rejects.toMatchObject({
      code: "B_ASSEMBLY_ARTIFACT_PATH",
    });
  });

  it("rejects an allowlisted traversal without writing outside the snapshot", async () => {
    const binary = await fakeBinary();
    const artifactFiles = await artifactFileMap();
    const escapeTarget = path.join(
      os.tmpdir(),
      `fde-artifact-escape-${process.pid}-${Date.now()}.txt`,
    );
    artifactFiles.set(
      `skills/../../${path.basename(escapeTarget)}`,
      Buffer.from("escaped\n"),
    );
    const execute = vi.fn();
    let failure;
    try {
      await runDryrunValidation({
        projectRoot: root,
        operations: [operation],
        catalogById: catalog,
        contextProbe,
        cliPath: binary,
        profile: "fde",
        team: "team-123",
        artifactFiles,
        execute,
      });
    } catch (error) {
      failure = error;
    }
    const externalWritten = await readFile(escapeTarget)
      .then(() => true, () => false);
    await unlink(escapeTarget).catch(() => {});

    expect({
      code: failure?.code,
      externalWritten,
      executeCalls: execute.mock.calls.length,
    }).toEqual({
      code: "B_ASSEMBLY_ARTIFACT_PATH",
      externalWritten: false,
      executeCalls: 0,
    });
  });

  it("binds every call to one realpath, binary hash, run, and artifact hash", async () => {
    const binary = await fakeBinary();
    const executedBinaries = [];
    const executionRoots = [];
    const execute = vi.fn(async (_binary, argv, options) => (
      executedBinaries.push(_binary),
      executionRoots.push(options.cwd),
      argv[0] === "auth"
        ? {
          exitCode: 0,
          signal: null,
          stdout: Buffer.from(JSON.stringify({
            profile: "fde",
            team: { id: "team-123" },
          })),
          stderr: Buffer.alloc(0),
        }
        : {
          exitCode: 0,
          signal: null,
          stdout: Buffer.from("ok"),
          stderr: Buffer.alloc(0),
        }
    ));
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      cliVersions: {
        npm_package: "0.1.2",
        cli_self_reported: "0.1.2",
      },
      contextProbe,
      execute,
      runId: "run-1",
      clock: vi.fn()
        .mockReturnValueOnce(new Date("2026-07-24T00:00:00Z"))
        .mockReturnValueOnce(new Date("2026-07-24T00:00:01Z")),
    });

    expect(result.exitCode).toBe(0);
    expect(execute).toHaveBeenCalledTimes(3);
    const binaryRealpath = await realpath(binary);
    expect(new Set(executedBinaries)).toHaveLength(1);
    expect(executedBinaries[0]).not.toBe(binaryRealpath);
    expect(path.isAbsolute(executedBinaries[0])).toBe(true);
    expect(new Set(executionRoots)).toHaveLength(1);
    expect(executionRoots[0]).not.toBe(root);
    expect(execute).toHaveBeenNthCalledWith(
      1,
      executedBinaries[0],
      ["auth", "whoami", "--json"],
      { shell: false, cwd: executionRoots[0] },
    );
    expect(execute).toHaveBeenNthCalledWith(
      2,
      executedBinaries[0],
      [
        "configure",
        "skill",
        "set",
        "add",
        "--body-file",
        "assembly/payloads/example.json",
        "--json",
      ],
      { shell: false, cwd: executionRoots[0] },
    );
    expect(execute).toHaveBeenNthCalledWith(
      3,
      executedBinaries[0],
      ["auth", "whoami", "--json"],
      { shell: false, cwd: executionRoots[0] },
    );
    await expect(readFile(executedBinaries[0])).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(result.evidence).toMatchObject({
      run_id: "run-1",
      profile: "fde",
      team: "team-123",
      cli: {
        binary_realpath: binaryRealpath,
        binary_sha256: sha256Bytes(await readFile(binary)),
        npm_package_version: "0.1.2",
        reported_version: "0.1.2",
      },
      started_at: "2026-07-24T00:00:00.000Z",
      ended_at: "2026-07-24T00:00:01.000Z",
      operations: [{
        operation_id: "skill-set.create",
        status: "passed",
        mapped_exit_code: 0,
        argv_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }],
    });
    expect(result.diagnostics[1]).toMatchObject({
      operation_id: "skill-set.create",
      raw_exit_code: 0,
      stderr: "",
    });
  });

  it.each([
    ["unknown option", 1],
    ["invalid json payload", 1],
    ["schema validation failed", 1],
    ["authentication expired", 3],
    ["profile not found", 3],
    ["team is ambiguous", 3],
    ["some unclassified failure", 3],
  ])("maps %s without leaking raw status into evidence", async (stderr, mapped) => {
    const binary = await fakeBinary();
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      cliVersions: {
        npm_package: "0.1.1",
        cli_self_reported: "0.1.0",
      },
      contextProbe,
      execute: async (_binary, argv) => (
        argv[0] === "auth"
          ? {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from(JSON.stringify({
              profile: "fde",
              team: { id: "team-123" },
            })),
            stderr: Buffer.alloc(0),
          }
          : {
            exitCode: 27,
            signal: null,
            stdout: Buffer.alloc(0),
            stderr: Buffer.from(stderr),
          }
      ),
      runId: "run-1",
    });

    expect(result.exitCode).toBe(mapped);
    expect(result.evidence.operations[0]).not.toHaveProperty("raw_exit_code");
    expect(result.evidence.operations[0]).not.toHaveProperty("stderr");
    expect(result.diagnostics[1]).toMatchObject({
      raw_exit_code: 27,
      stderr,
    });
  });

  it("refuses a requested profile/team that the fixed CLI context probe does not confirm", async () => {
    const binary = await fakeBinary();
    const execute = vi.fn(async () => ({
      exitCode: 0,
      signal: null,
      stdout: Buffer.from(JSON.stringify({
        profile: "other", team: { id: "team-123" },
      })),
      stderr: Buffer.alloc(0),
    }));
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      contextProbe,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      cliVersions: {
        npm_package: "0.1.1",
        cli_self_reported: "0.1.0",
      },
      execute,
      runId: "run-1",
    });

    expect(result.exitCode).toBe(3);
    expect(result.evidence).toBeNull();
    expect(execute).toHaveBeenCalledOnce();
  });

  it("fails the whole run when context changes after an operation", async () => {
    const binary = await fakeBinary();
    let probes = 0;
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      contextProbe,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      cliVersions: {
        npm_package: "0.1.1",
        cli_self_reported: "0.1.0",
      },
      execute: async (_binary, argv) => {
        if (argv[0] === "auth") {
          probes += 1;
          return {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from(JSON.stringify({
              profile: "fde",
              team: { id: probes === 1 ? "team-123" : "team-switched" },
            })),
            stderr: Buffer.alloc(0),
          };
        }
        return {
          exitCode: 0,
          signal: null,
          stdout: Buffer.from("ok"),
          stderr: Buffer.alloc(0),
        };
      },
      runId: "run-context-switch",
    });

    expect(result.exitCode).toBe(3);
    expect(result.evidence.operations[0]).toMatchObject({
      operation_id: operation.operation_id,
      status: "failed",
      mapped_exit_code: 3,
    });
  });

  it("maps a signal to environment failure even when stderr resembles usage", async () => {
    const binary = await fakeBinary();
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      cliVersions: {
        npm_package: "0.1.1",
        cli_self_reported: "0.1.0",
      },
      contextProbe,
      execute: async (_binary, argv) => (
        argv[0] === "auth"
          ? {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from(JSON.stringify({
              profile: "fde",
              team: { id: "team-123" },
            })),
            stderr: Buffer.alloc(0),
          }
          : {
            exitCode: 1,
            signal: "SIGTERM",
            stdout: Buffer.alloc(0),
            stderr: Buffer.from("usage"),
          }
      ),
      runId: "run-1",
    });
    expect(result.exitCode).toBe(3);
  });

  it("keeps executing the private snapshot if the original path is replaced", async () => {
    const binary = await fakeBinary();
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      cliVersions: {
        npm_package: "0.1.1",
        cli_self_reported: "0.1.0",
      },
      contextProbe,
      execute: async (_binary, argv) => {
        if (argv[0] === "auth") {
          return {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from(JSON.stringify({
              profile: "fde",
              team: { id: "team-123" },
            })),
            stderr: Buffer.alloc(0),
          };
        }
        await writeFile(binary, "#!/bin/sh\necho replaced\n");
        await chmod(binary, 0o755);
        return {
          exitCode: 0,
          signal: null,
          stdout: Buffer.from("ok"),
          stderr: Buffer.alloc(0),
        };
      },
      runId: "run-1",
    });
    expect(result.exitCode).toBe(0);
    expect(result.evidence.operations[0].status).toBe("passed");
  });

  it("executes against a private artifact snapshot immune to live payload replacement", async () => {
    const binary = await fakeBinary();
    const payloadPath = path.join(root, operation.payload_file);
    const originalPayload = await readFile(payloadPath);
    const executionRoots = [];
    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      contextProbe,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      execute: async (_binary, argv, options) => {
        executionRoots.push(options.cwd);
        if (argv[0] === "auth") {
          return {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from(JSON.stringify({
              profile: "fde",
              team: { id: "team-123" },
            })),
            stderr: Buffer.alloc(0),
          };
        }
        expect(options.cwd).not.toBe(root);
        expect(await readFile(path.join(
          options.cwd,
          operation.payload_file,
        ))).toEqual(originalPayload);
        await writeFile(payloadPath, "{\"replaced\":true}\n");
        expect(await readFile(path.join(
          options.cwd,
          operation.payload_file,
        ))).toEqual(originalPayload);
        return {
          exitCode: 0,
          signal: null,
          stdout: Buffer.from("ok"),
          stderr: Buffer.alloc(0),
        };
      },
      runId: "run-project-snapshot",
    });

    expect(result.exitCode).toBe(0);
    expect(new Set(executionRoots)).toHaveLength(1);
    expect(executionRoots[0]).not.toBe(root);
    await expect(readFile(executionRoots[0])).rejects.toMatchObject({
      code: expect.stringMatching(/^(?:EISDIR|ENOENT)$/u),
    });
  });

  it("removes a normal owned snapshot and every sensitive payload byte", async () => {
    const binary = await fakeBinary();
    const sensitive = `sensitive-${process.pid}-${Date.now()}`;
    await writeFile(
      path.join(root, operation.payload_file),
      `${JSON.stringify({ secret: sensitive })}\n`,
    );
    const before = await projectSnapshotTempEntries();
    let executionRoot;

    const result = await runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      contextProbe,
      cliPath: binary,
      profile: "fde",
      team: "team-123",
      execute: async (_binary, argv, options) => {
        executionRoot = options.cwd;
        return argv[0] === "auth"
          ? {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from(JSON.stringify({
              profile: "fde",
              team: { id: "team-123" },
            })),
            stderr: Buffer.alloc(0),
          }
          : {
            exitCode: 0,
            signal: null,
            stdout: Buffer.from("ok"),
            stderr: Buffer.alloc(0),
          };
      },
    });

    const containerName = path.basename(path.dirname(executionRoot));
    const after = await projectSnapshotTempEntries();
    const residualEntries = [...after].filter((name) =>
      name === containerName || name.startsWith(`${containerName}.`));
    const residualPayloads = [];
    for (const name of residualEntries) {
      const candidate = path.join(
        os.tmpdir(),
        name,
        "project",
        ...operation.payload_file.split("/"),
      );
      const bytes = await readFile(candidate, "utf8").catch(() => "");
      if (bytes.includes(sensitive)) residualPayloads.push(candidate);
    }

    expect(result.exitCode).toBe(0);
    expect(before.has(containerName)).toBe(false);
    expect({ residualEntries, residualPayloads }).toEqual({
      residualEntries: [],
      residualPayloads: [],
    });
  });

  it("stops cleanup and preserves a leaf replacement before conditional unlink", async () => {
    const binary = await fakeBinary();
    let payloadLstats = 0;
    let injected = false;
    let replacementPath;
    let ownedBackup;
    let failure;
    try {
      await runDryrunValidation({
        projectRoot: root,
        operations: [operation],
        catalogById: catalog,
        contextProbe,
        cliPath: binary,
        profile: "fde",
        team: "team-123",
        execute: async (_binary, argv) => (
          argv[0] === "auth"
            ? {
              exitCode: 0,
              signal: null,
              stdout: Buffer.from(JSON.stringify({
                profile: "fde",
                team: { id: "team-123" },
              })),
              stderr: Buffer.alloc(0),
            }
            : {
              exitCode: 0,
              signal: null,
              stdout: Buffer.from("ok"),
              stderr: Buffer.alloc(0),
            }
        ),
        projectSnapshotFs: {
          lstat: async (target) => {
            if (target.endsWith(`/${operation.payload_file}`)) {
              payloadLstats += 1;
              replacementPath = target;
              if (payloadLstats === 4) {
                injected = true;
                ownedBackup = `${target}.owned-by-test`;
                await rename(target, ownedBackup);
                await writeFile(target, "foreign replacement\n");
              }
            }
            return lstat(target);
          },
        },
      });
    } catch (error) {
      failure = error;
    }

    expect({
      injected,
      recoveryPaths: failure?.recoveryPaths,
      replacementBytes: replacementPath
        ? await readFile(replacementPath, "utf8").catch(() => null)
        : null,
      ownedPreserved: ownedBackup
        ? (await lstat(ownedBackup).then(() => true, () => false))
        : false,
    }).toEqual({
      injected: true,
      recoveryPaths: expect.arrayContaining([
        expect.stringContaining("fde-project-exec-"),
      ]),
      replacementBytes: "foreign replacement\n",
      ownedPreserved: true,
    });
  });

  it("preserves a foreign symlink raced into the live snapshot cleanup path", async () => {
    const binary = await fakeBinary();
    const foreignTarget = path.join(root, "foreign-target.txt");
    await writeFile(foreignTarget, "foreign\n", { mode: 0o640 });
    const foreignMode = (await lstat(foreignTarget)).mode & 0o777;
    let cleanupRoot;
    let ownedBackup;
    let injected = false;
    let failure;
    const cleanupLstats = [];
    const injectionSteps = [];
    try {
      await runDryrunValidation({
        projectRoot: root,
        operations: [operation],
        catalogById: catalog,
        contextProbe,
        cliPath: binary,
        profile: "fde",
        team: "team-123",
        execute: async (_binary, argv) => {
          return argv[0] === "auth"
            ? {
              exitCode: 0,
              signal: null,
              stdout: Buffer.from(JSON.stringify({
                profile: "fde",
                team: { id: "team-123" },
              })),
              stderr: Buffer.alloc(0),
            }
            : {
              exitCode: 0,
              signal: null,
              stdout: Buffer.from("ok"),
              stderr: Buffer.alloc(0),
            };
        },
        projectSnapshotFs: {
          lstat: async (target) => {
            const metadata = await lstat(target);
            cleanupLstats.push({
              target,
              symlink: metadata.isSymbolicLink(),
              directory: metadata.isDirectory(),
            });
            return metadata;
          },
          rename: async (source, target) => {
            if (!injected) {
              injected = true;
              cleanupRoot = source;
              ownedBackup = `${source}.owned-by-test`;
              await rename(source, ownedBackup);
              injectionSteps.push("owned-renamed");
              await symlink(foreignTarget, source);
              injectionSteps.push("foreign-linked");
            }
            const result = await rename(source, target);
            injectionSteps.push("foreign-claimed");
            return result;
          },
        },
      });
    } catch (error) {
      failure = error;
    }
    const recoveryPath = failure?.recoveryPaths?.[0];
    const preservedMetadata = recoveryPath
      ? await lstat(recoveryPath).catch(() => null)
      : null;

    expect({
      injected,
      recoveryPaths: failure?.recoveryPaths,
      preservedIsSymlink: preservedMetadata?.isSymbolicLink() ?? false,
      foreignBytes: await readFile(foreignTarget, "utf8"),
      foreignMode: (await lstat(foreignTarget)).mode & 0o777,
      ownedPreserved: Boolean(ownedBackup),
      cleanupLstats,
      failureMessage: failure?.message,
      injectionSteps,
    }).toEqual({
      injected: true,
      recoveryPaths: expect.arrayContaining([
        expect.stringContaining(`${cleanupRoot}.cleanup-`),
      ]),
      preservedIsSymlink: true,
      foreignBytes: "foreign\n",
      foreignMode,
      ownedPreserved: true,
      cleanupLstats: [{
        target: expect.stringContaining(`${cleanupRoot}.cleanup-`),
        symlink: true,
        directory: false,
      }],
      failureMessage:
        "Foreign project snapshot replacement was preserved during cleanup.",
      injectionSteps: [
        "owned-renamed",
        "foreign-linked",
        "foreign-claimed",
      ],
    });
  });

  it("preserves a foreign directory raced into the live snapshot cleanup path", async () => {
    const binary = await fakeBinary();
    let cleanupRoot;
    let ownedBackup;
    let injected = false;
    let failure;
    try {
      await runDryrunValidation({
        projectRoot: root,
        operations: [operation],
        catalogById: catalog,
        contextProbe,
        cliPath: binary,
        profile: "fde",
        team: "team-123",
        execute: async (_binary, argv) => {
          return argv[0] === "auth"
            ? {
              exitCode: 0,
              signal: null,
              stdout: Buffer.from(JSON.stringify({
                profile: "fde",
                team: { id: "team-123" },
              })),
              stderr: Buffer.alloc(0),
            }
            : {
              exitCode: 0,
              signal: null,
              stdout: Buffer.from("ok"),
              stderr: Buffer.alloc(0),
            };
        },
        projectSnapshotFs: {
          rename: async (source, target) => {
            if (!injected) {
              injected = true;
              cleanupRoot = source;
              ownedBackup = `${source}.owned-by-test`;
              await rename(source, ownedBackup);
              await mkdir(source, { mode: 0o711 });
              await writeFile(path.join(source, "foreign.txt"), "foreign\n");
            }
            return rename(source, target);
          },
        },
      });
    } catch (error) {
      failure = error;
    }
    const recoveryPath = failure?.recoveryPaths?.[0];
    const preservedMetadata = recoveryPath
      ? await lstat(recoveryPath).catch(() => null)
      : null;
    const foreignBytes = await readFile(
      path.join(recoveryPath ?? "", "foreign.txt"),
      "utf8",
    ).catch(() => null);

    expect({
      injected,
      recoveryPaths: failure?.recoveryPaths,
      preservedIsDirectory: preservedMetadata?.isDirectory() ?? false,
      foreignBytes,
      foreignMode: preservedMetadata ? preservedMetadata.mode & 0o777 : null,
      ownedPreserved: Boolean(ownedBackup),
    }).toEqual({
      injected: true,
      recoveryPaths: expect.arrayContaining([
        expect.stringContaining(`${cleanupRoot}.cleanup-`),
      ]),
      preservedIsDirectory: true,
      foreignBytes: "foreign\n",
      foreignMode: 0o711,
      ownedPreserved: true,
    });
  });

  it("rejects incomplete invocation before running", async () => {
    const binary = await fakeBinary();
    await expect(runDryrunValidation({
      projectRoot: root,
      operations: [operation],
      catalogById: catalog,
      cliPath: binary,
      profile: "",
      team: "team-123",
    })).rejects.toMatchObject({ exitCode: 2 });
  });
});

describe("assembly evidence publication and verification", () => {
  it("atomically writes evidence without leaving temporary files", async () => {
    const report = path.join(root, "reports/cli-dryrun-evidence.json");
    await writeDryrunEvidenceAtomic(report, {
      schema_version: 1,
      run_id: "run-1",
    });
    expect(JSON.parse(await readFile(report, "utf8"))).toMatchObject({
      run_id: "run-1",
    });
  });

  it("restores a concurrent evidence replacement to the live target", async () => {
    const report = path.join(root, "reports/cli-dryrun-evidence.json");
    await mkdir(path.dirname(report), { recursive: true });
    await writeFile(report, "{\"run_id\":\"old\"}\n");
    const concurrent = Buffer.from("{\"run_id\":\"concurrent\"}\n");
    let injected = false;
    await expect(writeDryrunEvidenceAtomic(
      report,
      { schema_version: 1, run_id: "new" },
      {
        fs: {
          rename: async (source, target) => {
            if (
              path.basename(source) === path.basename(report) &&
              !injected
            ) {
              injected = true;
              const replacement = `${source}.concurrent`;
              await writeFile(replacement, concurrent);
              await rename(replacement, source);
            }
            return rename(source, target);
          },
        },
      },
    )).rejects.toMatchObject({
      recoveryPaths: expect.any(Array),
    });
    expect(await readFile(report)).toEqual(concurrent);
  });

  it("requires one result per supported operation and all bindings to match", () => {
    const evidence = {
      schema_version: 1,
      run_id: "run-1",
      profile: "fde",
      team: "team-123",
      artifact_set_sha256: "a".repeat(64),
      cli: {
        binary_realpath: "/tmp/octopus-cli",
        binary_sha256: "b".repeat(64),
        npm_package_version: "0.1.1",
        reported_version: "0.1.0",
      },
      started_at: "2026-07-24T00:00:00.000Z",
      ended_at: "2026-07-24T00:00:01.000Z",
      operations: [{
        operation_id: "skill-set.create",
        status: "passed",
        mapped_exit_code: 0,
        argv_sha256: "c".repeat(64),
      }],
    };
    expect(validateDryrunEvidence(evidence, {
      artifactSetSha256: "a".repeat(64),
      cliRealpath: "/tmp/octopus-cli",
      cliSha256: "b".repeat(64),
      expectedOperations: [{
        operationId: "skill-set.create",
        argvSha256: "c".repeat(64),
      }],
    })).toEqual({ valid: true, issues: [] });

    evidence.artifact_set_sha256 = "d".repeat(64);
    expect(validateDryrunEvidence(evidence, {
      artifactSetSha256: "a".repeat(64),
      cliRealpath: "/tmp/octopus-cli",
      cliSha256: "b".repeat(64),
      expectedOperations: [{
        operationId: "skill-set.create",
        argvSha256: "c".repeat(64),
      }],
    }).valid).toBe(false);
  });
});
