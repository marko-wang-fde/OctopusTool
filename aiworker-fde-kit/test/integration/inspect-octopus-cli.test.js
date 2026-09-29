import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { main } from "../../src/commands/inspect-octopus-cli.js";
import { runCliProbes } from "../../src/assembly/cli-runner.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const FIXTURES = path.join(ROOT, "test/fixtures/cli");
let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-cli-inspect-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  expect(chunks).toHaveLength(1);
  expect(chunks[0].match(/\n/gu)).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function jsonAt(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

describe("inspect-octopus-cli command boundary", () => {
  it("prints help with exit 0 and performs zero writes", async () => {
    const { exitCode, result } = await invoke(["--help"]);

    expect(exitCode).toBe(0);
    expect(result.data.usage).toContain("inspect-octopus-cli");
    expect(await readdir(temporaryRoot)).toEqual([]);
  });

  it.each([
    [["--fixture-dir", "relative"], "B_ARGUMENT_INVALID"],
    [["--cli-path", "relative"], "B_ARGUMENT_INVALID"],
    [["--output", "relative"], "B_ARGUMENT_INVALID"],
    [["--unknown"], "B_ARGUMENT_UNKNOWN"],
    [["--fixture-dir"], "B_ARGUMENT_MISSING"],
    [
      ["--fixture-dir", "/tmp/a", "--cli-path", "/tmp/cli"],
      "B_ARGUMENT_CONFLICT",
    ],
  ])("returns exit 2 for invalid arguments %#", async (args, code) => {
    const { exitCode, result } = await invoke(args);

    expect(exitCode).toBe(2);
    expect(result.exitCode).toBe(2);
    expect(result.issues[0].code).toBe(code);
  });

  it("uses cwd/generated as the default output", async () => {
    const cwd = path.join(temporaryRoot, "working");
    await mkdir(cwd);

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
    ], { cwd });

    expect(exitCode).toBe(0);
    expect(result.data.output).toBe(path.join(cwd, "generated"));
    expect((await stat(path.join(cwd, "generated"))).isDirectory()).toBe(true);
  });
});

describe("fixture inspection", () => {
  it("writes all fixed outputs, preserves raw evidence, and never spawns", async () => {
    const output = path.join(temporaryRoot, "evidence");
    const spawn = vi.fn(() => {
      throw new Error("fixture mode must not spawn");
    });

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], { spawn });

    expect(exitCode).toBe(0);
    expect(result.exitCode).toBe(0);
    expect(spawn).not.toHaveBeenCalled();
    expect(await jsonAt(output, "octopus-cli-version.json")).toMatchObject({
      npm_package: {
        name: "@syngy/octopus-cli",
        version: "0.1.1",
      },
      cli_self_reported: { version: "0.1.0" },
      versions_match: false,
    });
    expect(await jsonAt(output, "octopus-cli-help.json")).toMatchObject({
      schema_version: 1,
      evidence_scope: "command-path-presence-only",
    });
    const index = await jsonAt(output, "cli-command-index.json");
    expect(index.commands).toContainEqual({
      path: ["configure", "skill", "set", "add"],
      path_text: "configure skill set add",
    });
    expect(index.commands).toContainEqual({
      path: ["auth", "whoami"],
      path_text: "auth whoami",
    });
    expect(JSON.stringify(index.commands)).not.toMatch(
      /body-file|payload|toolkit/iu,
    );
    expect(
      await readFile(path.join(
        output,
        "diagnostics/raw/help-json.json",
      )),
    ).toEqual(
      await readFile(path.join(FIXTURES, "valid/help-json.json")),
    );
    expect(
      await readFile(path.join(
        output,
        "diagnostics/raw/leaf-help/configure-team-private-digiworkers-add.txt",
      )),
    ).toEqual(
      await readFile(path.join(
        FIXTURES,
        "valid/leaf-help/configure-team-private-digiworkers-add.txt",
      )),
    );
    expect(
      await readFile(path.join(
        output,
        "diagnostics/raw/leaf-help/auth-whoami.txt",
      )),
    ).toEqual(
      await readFile(path.join(
        FIXTURES,
        "valid/leaf-help/auth-whoami.txt",
      )),
    );
    expect(JSON.stringify(await jsonAt(
      output,
      "octopus-cli-version.json",
    ))).not.toContain("stderr");
  });

  it("records distinct package and self-reported versions without equating them", async () => {
    const output = path.join(temporaryRoot, "versions");
    const { result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);

    const versions = await jsonAt(output, "octopus-cli-version.json");
    expect(versions.npm_package.version).toBe("0.1.1");
    expect(versions.cli_self_reported.version).toBe("0.1.0");
    expect(versions.versions_match).toBe(false);
    expect(result.issues).not.toContainEqual(
      expect.objectContaining({ code: "B_CLI_VERSION_MISMATCH" }),
    );
  });

  it("uses the same-operation manual fallback for a missing contract command", async () => {
    const output = path.join(temporaryRoot, "missing");
    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "missing-command"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(0);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "W_CLI_COMMAND_MANUAL_FALLBACK",
    }));
    expect(await jsonAt(output, "cli-command-index.json")).toBeTruthy();
    expect((await jsonAt(output, "cli-command-index.json")).operations)
      .toContainEqual(expect.objectContaining({
        operation_id: "employee-hire.create",
        status: "manual-required",
      }));
  });

  it("allows no leaf-help directory when no supported command is present", async () => {
    const fixture = path.join(temporaryRoot, "no-leaf-needed");
    await cp(path.join(FIXTURES, "valid"), fixture, { recursive: true });
    await rm(path.join(fixture, "leaf-help"), { recursive: true });
    await writeFile(path.join(fixture, "help-json.json"), "[]\n");
    const output = path.join(temporaryRoot, "no-leaf-needed-output");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      fixture,
      "--output",
      output,
    ]);

    expect(exitCode).toBe(0);
    expect(result.issues.filter(({ code }) =>
      code === "W_CLI_COMMAND_MANUAL_FALLBACK")).toHaveLength(5);
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_FIXTURE_EVIDENCE_INVALID",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
    expect(result.data).not.toHaveProperty("installation_guidance");
    expect(await jsonAt(output, "cli-command-index.json")).toMatchObject({
      commands: [],
    });
  });

  it("accepts the captured real top-level array without a leaf directory", async () => {
    const fixture = path.join(temporaryRoot, "real-array-shape");
    await cp(path.join(FIXTURES, "valid"), fixture, { recursive: true });
    await rm(path.join(fixture, "leaf-help"), { recursive: true });
    await writeFile(
      path.join(fixture, "help-json.json"),
      await readFile(path.join(
        FIXTURES,
        "octopus-cli-0.1.1-help-json.json",
      )),
    );
    const output = path.join(temporaryRoot, "real-array-shape-output");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      fixture,
      "--output",
      output,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data).not.toHaveProperty("installation_guidance");
    expect(await jsonAt(output, "cli-command-index.json")).toMatchObject({
      commands: expect.arrayContaining([
        {
          path: ["configure", "team", "use"],
          path_text: "configure team use",
        },
      ]),
    });
  });

  it("classifies a required leaf-help file missing from a fixture", async () => {
    const fixture = path.join(temporaryRoot, "missing-leaf");
    await cp(path.join(FIXTURES, "valid"), fixture, { recursive: true });
    await rm(path.join(
      fixture,
      "leaf-help",
      "configure-team-private-digiworkers-add.txt",
    ));
    const output = path.join(temporaryRoot, "missing-leaf-output");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      fixture,
      "--output",
      output,
    ]);

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_FIXTURE_EVIDENCE_INVALID",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
    expect(result.data).not.toHaveProperty("installation_guidance");
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    "npm-package-version.json",
    "cli-version.json",
    "help-json.json",
  ])("classifies missing fixture evidence without CLI installation guidance: %s", async (
    missingFile,
  ) => {
    const fixture = path.join(temporaryRoot, `missing-${missingFile}`);
    await cp(path.join(FIXTURES, "valid"), fixture, { recursive: true });
    await rm(path.join(fixture, missingFile));
    const output = path.join(temporaryRoot, `missing-${missingFile}-output`);

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      fixture,
      "--output",
      output,
    ]);

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_FIXTURE_EVIDENCE_INVALID",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
    expect(result.data).not.toHaveProperty("installation_guidance");
  });

  it("returns content-contract exit 1 for a leaf help shape conflict", async () => {
    const output = path.join(temporaryRoot, "conflict");
    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "help-conflict"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_CONTRACT_CONFLICT",
      path: "configure team private-digiworkers add",
    }));
    expect(
      await readFile(path.join(
        output,
        "diagnostics/raw/leaf-help/configure-team-private-digiworkers-add.txt",
      ), "utf8"),
    ).toContain("--body");
  });

  it("returns runtime exit 3 for malformed help and preserves diagnostics without an index", async () => {
    const output = path.join(temporaryRoot, "malformed");
    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "malformed"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_HELP_MALFORMED",
    }));
    expect(
      await readFile(path.join(output, "diagnostics/raw/help-json.json")),
    ).toEqual(
      await readFile(path.join(FIXTURES, "malformed/help-json.json")),
    );
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    ["scalar", "42"],
    ["empty object", "{}"],
    ["invalid commands", "{\"commands\":\"invalid\"}"],
    ["null node", "{\"commands\":[null]}"],
    ["invalid node name", "{\"commands\":[{\"name\":42}]}"],
  ])("classifies semantic malformed help (%s) and retains raw evidence", async (
    caseName,
    rawHelp,
  ) => {
    const fixture = path.join(temporaryRoot, `semantic-${caseName}`);
    await cp(path.join(FIXTURES, "valid"), fixture, { recursive: true });
    await writeFile(path.join(fixture, "help-json.json"), rawHelp);
    const output = path.join(temporaryRoot, `semantic-${caseName}-output`);

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      fixture,
      "--output",
      output,
    ]);

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_HELP_MALFORMED",
    }));
    expect(await readFile(
      path.join(output, "diagnostics/raw/help-json.json"),
      "utf8",
    )).toBe(rawHelp);
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("classifies an invalid operation catalog before reading fixture leaves", async () => {
    const catalogPath = path.join(temporaryRoot, "unsafe-catalog.yaml");
    const catalogText = await readFile(
      path.join(ROOT, "catalog/assembly-operations.yaml"),
      "utf8",
    );
    await writeFile(
      catalogPath,
      catalogText.replace('      - "private-digiworkers"', '      - "--help"'),
    );
    const output = path.join(temporaryRoot, "unsafe-catalog-output");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], { catalogPath });

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_CATALOG_INVALID",
    }));
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("warns when the CLI exposes an unregistered write command", async () => {
    const fixture = path.join(temporaryRoot, "uncataloged");
    await cp(path.join(FIXTURES, "valid"), fixture, { recursive: true });
    const helpPath = path.join(fixture, "help-json.json");
    const help = JSON.parse(await readFile(helpPath, "utf8"));
    help.commands.push({
      name: "worker",
      commands: [{ name: "delete" }],
    });
    await writeFile(helpPath, `${JSON.stringify(help, null, 2)}\n`);
    const output = path.join(temporaryRoot, "uncataloged-output");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      fixture,
      "--output",
      output,
    ]);

    expect(exitCode).toBe(0);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_CLI_UNCATALOGED_WRITE",
      path: "worker delete",
    }));
  });

  it("atomically replaces only a prior inspector-owned output", async () => {
    const output = path.join(temporaryRoot, "replace");
    await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(0);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "W_OUTPUT_RECOVERY_RETAINED",
    }));
    expect(result.data.recovery_paths.length).toBeGreaterThanOrEqual(2);
    for (const recoveryPath of result.data.recovery_paths) {
      expect((await stat(recoveryPath)).isFile() ||
        (await stat(recoveryPath)).isDirectory()).toBe(true);
    }
  });

  it("refuses to replace an inspector output modified outside its manifest", async () => {
    const output = path.join(temporaryRoot, "modified-output");
    await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);
    await writeFile(path.join(output, "operator-notes.txt"), "keep me");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_NOT_OWNED",
    }));
    expect(await readFile(path.join(output, "operator-notes.txt"), "utf8"))
      .toBe("keep me");
  });

  it("refuses to overwrite a user-owned output directory", async () => {
    const output = path.join(temporaryRoot, "user-output");
    await mkdir(output);
    await writeFile(path.join(output, "notes.txt"), "keep me");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_NOT_OWNED",
    }));
    expect(await readFile(path.join(output, "notes.txt"), "utf8")).toBe(
      "keep me",
    );
  });

  it("does not overwrite a concurrently created initial output", async () => {
    const output = path.join(temporaryRoot, "concurrent-initial");
    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeOutputClaim: async () => {
          await mkdir(output);
          await writeFile(path.join(output, "foreign.txt"), "foreign");
        },
      },
    });

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_CHANGED",
    }));
    expect(await readFile(path.join(output, "foreign.txt"), "utf8")).toBe(
      "foreign",
    );
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
    expect(result.data.recovery_paths).toEqual(expect.arrayContaining([
      expect.stringContaining(".inspect-staging-"),
    ]));
  });

  it("quarantines and reports a foreign replacement claimed during update", async () => {
    const output = path.join(temporaryRoot, "concurrent-replacement");
    await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);
    const displaced = path.join(temporaryRoot, "displaced-owned-output");

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeExistingClaim: async () => {
          await rename(output, displaced);
          await mkdir(output);
          await writeFile(path.join(output, "foreign.txt"), "preserve me");
        },
      },
    });

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_CHANGED",
    }));
    expect(result.data.foreign_paths).toHaveLength(1);
    expect(
      await readFile(path.join(result.data.foreign_paths[0], "foreign.txt"), "utf8"),
    ).toBe("preserve me");
    expect((await stat(displaced)).isDirectory()).toBe(true);
  });

  it("publishes a fully validated staging directory in one rename", async () => {
    const output = path.join(temporaryRoot, "atomic-visible");
    const beforePublish = vi.fn(async ({ staging }) => {
      await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
      expect(await jsonAt(staging, "octopus-cli-version.json")).toBeTruthy();
      expect(await jsonAt(staging, "octopus-cli-help.json")).toBeTruthy();
      expect(await jsonAt(staging, "cli-command-index.json")).toBeTruthy();
    });

    const { exitCode } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], {
      transactionHooks: { beforeStagingPublish: beforePublish },
    });

    expect(exitCode).toBe(0);
    expect(beforePublish).toHaveBeenCalledTimes(1);
    expect(await jsonAt(output, "cli-command-index.json")).toBeTruthy();
  });

  it("rolls back the old complete output when staging rename fails", async () => {
    const output = path.join(temporaryRoot, "rename-rollback");
    await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ]);
    const before = await readFile(path.join(output, ".inspection-owner.json"));

    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], {
      transactionHooks: {
        renameStaging: async () => {
          throw Object.assign(new Error("injected staging rename failure"), {
            code: "EIO",
          });
        },
      },
    });

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_COMMIT_FAILED",
    }));
    expect(await readFile(path.join(output, ".inspection-owner.json"))).toEqual(
      before,
    );
    expect(await jsonAt(output, "cli-command-index.json")).toBeTruthy();
  });

  it("claims and validates staging before publish so a replacement is retained", async () => {
    const output = path.join(temporaryRoot, "staging-replacement-output");
    let displaced;
    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], {
      transactionHooks: {
        afterStagingValidated: async ({ staging }) => {
          displaced = `${staging}-displaced-owned`;
          await rename(staging, displaced);
          await mkdir(staging);
          await writeFile(path.join(staging, "foreign.txt"), "foreign stage");
        },
      },
    });

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_CHANGED",
    }));
    expect(result.data.foreign_paths).toHaveLength(1);
    expect(
      await readFile(path.join(result.data.foreign_paths[0], "foreign.txt"), "utf8"),
    ).toBe("foreign stage");
    expect((await stat(displaced)).isDirectory()).toBe(true);
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("isolates a replacement lock marker and reports it without pathname deletion", async () => {
    const output = path.join(temporaryRoot, "lock-replacement-output");
    let displaced;
    const { exitCode, result } = await invoke([
      "--fixture-dir",
      path.join(FIXTURES, "valid"),
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeLockCleanup: async ({ lockPath }) => {
          displaced = `${lockPath}.displaced-owned`;
          await rename(lockPath, displaced);
          await writeFile(lockPath, "foreign lock");
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "W_TRANSACTION_RECOVERY_RETAINED",
    }));
    expect(result.data.foreign_paths).toHaveLength(1);
    expect(
      await readFile(result.data.foreign_paths[0], "utf8"),
    ).toBe("foreign lock");
    expect(await readFile(displaced, "utf8")).toContain(
      "inspect-octopus-cli",
    );
  });
});

describe("real-mode runner safety", () => {
  it.each([
    [["--help"]],
    [["safe", ".."]],
    [["safe/path"]],
    [["safe", "bad token"]],
  ])("rejects unsafe command argv before spawning: %#", async (commandPath) => {
    const fakeSpawn = vi.fn();

    await expect(runCliProbes({
      cliPath: "/opt/bin/octopus-cli",
      commandPaths: [commandPath],
      spawnCommand: fakeSpawn,
    })).rejects.toMatchObject({
      code: "E_OPERATION_CATALOG_INVALID",
    });
    expect(fakeSpawn).not.toHaveBeenCalled();
  });

  it("uses argv arrays, shell false, and only the approved read-only probes", async () => {
    const calls = [];
    const fakeSpawn = vi.fn(async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === "npm") {
        return {
          exitCode: 0,
          stdout: Buffer.from(JSON.stringify({
            dependencies: {
              "@syngy/octopus-cli": { version: "0.1.1" },
            },
          })),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "--version") {
        return {
          exitCode: 0,
          stdout: Buffer.from("0.1.0\n"),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "--help-json") {
        return {
          exitCode: 0,
          stdout: await readFile(path.join(FIXTURES, "valid/help-json.json")),
          stderr: Buffer.alloc(0),
        };
      }
      return {
        exitCode: 0,
        stdout: Buffer.from("--body-file <path>\n--json\n--dryrun\n"),
        stderr: Buffer.alloc(0),
      };
    });

    const results = await runCliProbes({
      cliPath: "/opt/bin/octopus-cli",
      commandPaths: [
        ["configure", "skill", "set", "add"],
        ["configure", "team", "private-digiworkers", "add"],
        ["configure", "employee", "hire"],
      ],
      bodyProbeCommandPaths: [
        ["configure", "skill", "set", "add"],
        ["configure", "team", "private-digiworkers", "add"],
        ["configure", "employee", "hire"],
      ],
      spawnCommand: fakeSpawn,
    });

    expect(results.leafHelp).toHaveLength(3);
    expect(results.bodyProbes).toHaveLength(3);
    expect(calls.map(({ command, args }) => [command, args])).toEqual([
      [
        "npm",
        ["list", "--global", "@syngy/octopus-cli", "--json", "--depth=0"],
      ],
      ["/opt/bin/octopus-cli", ["--version"]],
      ["/opt/bin/octopus-cli", ["--help-json"]],
      [
        "/opt/bin/octopus-cli",
        ["configure", "skill", "set", "add", "--help"],
      ],
      [
        "/opt/bin/octopus-cli",
        ["configure", "team", "private-digiworkers", "add", "--help"],
      ],
      [
        "/opt/bin/octopus-cli",
        ["configure", "employee", "hire", "--help"],
      ],
      [
        "/opt/bin/octopus-cli",
        [
          "--dryrun",
          "configure",
          "skill",
          "set",
          "add",
          "--body-json",
          "{\"__aiworker_fde_cli_body_probe__\":true}",
          "--json",
        ],
      ],
      [
        "/opt/bin/octopus-cli",
        [
          "--dryrun",
          "configure",
          "team",
          "private-digiworkers",
          "add",
          "--body-json",
          "{\"__aiworker_fde_cli_body_probe__\":true}",
          "--json",
        ],
      ],
      [
        "/opt/bin/octopus-cli",
        [
          "--dryrun",
          "configure",
          "employee",
          "hire",
          "--body-json",
          "{\"__aiworker_fde_cli_body_probe__\":true}",
          "--json",
        ],
      ],
    ]);
    expect(calls.every(({ options }) =>
      options.shell === false && Array.isArray(options.argv))).toBe(true);
    expect(fakeSpawn).toHaveBeenCalledTimes(9);
  });

  it("downgrades a present write command when the dryrun execution layer drops the body", async () => {
    const output = path.join(temporaryRoot, "body-probe-output");
    const calls = [];
    const spawnCommand = vi.fn(async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === "npm") {
        return {
          exitCode: 0,
          stdout: Buffer.from(JSON.stringify({
            dependencies: {
              "@syngy/octopus-cli": { version: "0.1.2" },
            },
          })),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "--version") {
        return {
          exitCode: 0,
          stdout: Buffer.from("0.1.2\n"),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "--help-json") {
        return {
          exitCode: 0,
          stdout: await readFile(path.join(FIXTURES, "valid/help-json.json")),
          stderr: Buffer.alloc(0),
        };
      }
      if (args.at(-1) === "--help") {
        return {
          exitCode: 0,
          stdout: Buffer.from(
            `Usage: octopus-cli ${args.slice(0, -1).join(" ")} [options]\n` +
              "Options:\n  --body-json <json>\n  --body-file <file>\n  --json\n",
          ),
          stderr: Buffer.alloc(0),
        };
      }
      if (args[0] === "--dryrun") {
        const bodyFlagIndex = args.indexOf("--body-json");
        const commandPath = args.slice(1, bodyFlagIndex).join(" ");
        const body = commandPath === "configure team private-digiworkers add"
          ? { __aiworker_fde_cli_body_probe__: true }
          : undefined;
        return {
          exitCode: 0,
          stdout: Buffer.from(JSON.stringify({
            dryrun: true,
            method: "POST",
            command: args.slice(1, bodyFlagIndex),
            ...(body ? { body } : {}),
          })),
          stderr: Buffer.alloc(0),
        };
      }
      throw new Error(`unexpected probe: ${command} ${args.join(" ")}`);
    });

    const { exitCode, result } = await invoke([
      "--cli-path",
      "/opt/bin/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(0);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "W_CLI_BODY_PROBE_MANUAL_FALLBACK",
      path: "configure employee hire",
    }));
    const index = await jsonAt(output, "cli-command-index.json");
    expect(index.operations).toContainEqual(expect.objectContaining({
      operation_id: "team-private-digiworker.create",
      status: "supported",
      evidence: expect.objectContaining({
        dryrun_body_probe: "body-forwarded",
      }),
    }));
    expect(index.operations).toContainEqual(expect.objectContaining({
      operation_id: "employee-hire.create",
      status: "manual-required",
      evidence: expect.objectContaining({
        dryrun_body_probe: "body-missing",
      }),
    }));
    expect(await readFile(path.join(
      output,
      "diagnostics/raw/body-probes/configure-employee-hire.json",
    ), "utf8")).toContain("\"dryrun\"");
    expect(calls.some(({ args }) => args[0] === "--dryrun")).toBe(true);
  });

  it("maps CLI missing to exit 3 with installation guidance and never installs", async () => {
    const output = path.join(temporaryRoot, "cli-missing");
    const calls = [];
    const spawnCommand = vi.fn(async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === "npm") {
        return {
          exitCode: 0,
          stdout: Buffer.from("{}"),
          stderr: Buffer.alloc(0),
        };
      }
      const error = new Error("spawn ENOENT");
      error.code = "ENOENT";
      throw error;
    });

    const { exitCode, result } = await invoke([
      "--cli-path",
      "/missing/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
    expect(result.data.installation_guidance).toMatch(/install|安装/iu);
    expect(calls.some(({ args }) => args.includes("install"))).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it("continues after npm exit 1 with no package and classifies missing CLI", async () => {
    const output = path.join(temporaryRoot, "npm-no-package");
    let invocation = 0;
    const spawnCommand = vi.fn(async (command) => {
      invocation += 1;
      if (invocation === 1) {
        expect(command).toBe("npm");
        return {
          exitCode: 1,
          stdout: Buffer.from(JSON.stringify({
            name: "global",
            dependencies: {},
          })),
          stderr: Buffer.from("package absent\n"),
        };
      }
      const error = new Error("spawn ENOENT");
      error.code = "ENOENT";
      throw error;
    });

    const { exitCode, result } = await invoke([
      "--cli-path",
      "/missing/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(3);
    expect(spawnCommand).toHaveBeenCalledTimes(2);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
    expect(result.data.installation_guidance).toMatch(/install/iu);
    expect(
      await readFile(path.join(
        output,
        "diagnostics/stderr/npm-package-version.txt",
      ), "utf8"),
    ).toBe("package absent\n");
  });

  it("keeps malformed npm exit-1 evidence as an environment failure", async () => {
    const output = path.join(temporaryRoot, "npm-malformed");
    const spawnCommand = vi.fn(async () => ({
      exitCode: 1,
      stdout: Buffer.from("{not-json"),
      stderr: Buffer.from("npm failed\n"),
    }));

    const { exitCode, result } = await invoke([
      "--cli-path",
      "/opt/bin/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(3);
    expect(spawnCommand).toHaveBeenCalledTimes(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_PROBE_FAILED",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
  });

  it("does not call a nonzero existing CLI missing when npm has no package", async () => {
    const output = path.join(temporaryRoot, "existing-cli-nonzero");
    let invocation = 0;
    const spawnCommand = vi.fn(async () => {
      invocation += 1;
      if (invocation === 1) {
        return {
          exitCode: 1,
          stdout: Buffer.from(JSON.stringify({
            name: "global",
            dependencies: {},
          })),
          stderr: Buffer.alloc(0),
        };
      }
      return {
        exitCode: 9,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from("existing cli rejected version probe\n"),
      };
    });

    const { exitCode, result } = await invoke([
      "--cli-path",
      "/opt/bin/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_PROBE_FAILED",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_CLI_MISSING",
    }));
    expect(result.data.installation_guidance).toBeUndefined();
    expect(
      await readFile(path.join(
        output,
        "diagnostics/stderr/cli-version.txt",
      ), "utf8"),
    ).toBe("existing cli rejected version probe\n");
  });

  it("documents the cooperative atomic-directory publication boundary", async () => {
    const contract = await readFile(path.join(
      ROOT,
      "references/transaction-contract.md",
    ), "utf8");

    expect(contract).toContain("inspect-octopus-cli");
    expect(contract).toMatch(/same-filesystem directory rename/iu);
    expect(contract).toMatch(/cooperative marker/iu);
    expect(contract).toMatch(/staging.*fully validated/isu);
    expect(contract).toMatch(/uncooperative.*outside/isu);
  });

  it("preserves acquired diagnostics after a later spawn failure without publishing an index", async () => {
    const output = path.join(temporaryRoot, "spawn-failure");
    let invocation = 0;
    const spawnCommand = vi.fn(async () => {
      invocation += 1;
      if (invocation === 1) {
        return {
          exitCode: 0,
          stdout: Buffer.from(JSON.stringify({
            dependencies: {
              "@syngy/octopus-cli": { version: "0.1.1" },
            },
          })),
          stderr: Buffer.from("npm diagnostic\n"),
        };
      }
      throw new Error("simulated spawn failure");
    });

    const { exitCode, result } = await invoke([
      "--cli-path",
      "/opt/bin/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_PROBE_FAILED",
    }));
    expect(
      await readFile(path.join(
        output,
        "diagnostics/raw/npm-package-version.json",
      ), "utf8"),
    ).toContain("@syngy/octopus-cli");
    expect(
      await readFile(path.join(
        output,
        "diagnostics/stderr/npm-package-version.txt",
      ), "utf8"),
    ).toBe("npm diagnostic\n");
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves stderr from a nonzero probe without publishing an index", async () => {
    const output = path.join(temporaryRoot, "nonzero-probe");
    let invocation = 0;
    const spawnCommand = vi.fn(async () => {
      invocation += 1;
      if (invocation === 1) {
        return {
          exitCode: 0,
          stdout: Buffer.from(JSON.stringify({
            dependencies: {
              "@syngy/octopus-cli": { version: "0.1.1" },
            },
          })),
          stderr: Buffer.alloc(0),
        };
      }
      return {
        exitCode: 9,
        stdout: Buffer.alloc(0),
        stderr: Buffer.from("version probe rejected\n"),
      };
    });

    const { exitCode } = await invoke([
      "--cli-path",
      "/opt/bin/octopus-cli",
      "--output",
      output,
    ], { spawnCommand });

    expect(exitCode).toBe(3);
    expect(
      await readFile(path.join(
        output,
        "diagnostics/stderr/cli-version.txt",
      ), "utf8"),
    ).toBe("version probe rejected\n");
    await expect(readFile(path.join(output, "cli-command-index.json")))
      .rejects.toMatchObject({ code: "ENOENT" });
  });
});
