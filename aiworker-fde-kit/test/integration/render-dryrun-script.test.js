import {
  chmod,
  cp,
  mkdtemp,
  mkdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parse, stringify } from "yaml";
import { beforeEach, describe, expect, it } from "vitest";

import { main } from "../../src/commands/render-assemble-script.js";
import {
  validateProjectDirectory,
} from "../../src/contracts/project-validator.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TEMPLATE = path.join(ROOT, "assets/project-template");
const execFileAsync = promisify(execFile);
const FIXTURES = path.join(ROOT, "test/fixtures/assembly");
let temporary;

beforeEach(async () => {
  temporary = await mkdtemp(path.join(os.tmpdir(), "fde-render-"));
});

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  expect(chunks).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function installFullRenderableProject(project) {
  await cp(TEMPLATE, project, { recursive: true });
  const operationsText = await readFile(
    path.join(FIXTURES, "renderable-project/assembly/operations.yaml"),
    "utf8",
  );
  const operations = parse(operationsText);
  await writeFile(
    path.join(project, "assembly/operations.yaml"),
    operationsText,
  );
  await mkdir(path.join(project, "assembly/payloads"), { recursive: true });
  await cp(
    path.join(FIXTURES, "renderable-project/assembly/payloads/example.json"),
    path.join(project, "assembly/payloads/example.json"),
  );
  const manifestPath = path.join(project, "fde-project.yaml");
  const manifest = parse(await readFile(manifestPath, "utf8"));
  manifest.assembly = operations;
  await writeFile(manifestPath, stringify(manifest));
}

describe("render-assemble-script command", () => {
  it("documents and enforces its exact absolute-path interface", async () => {
    const help = await invoke(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.result.data.usage).toBe(
      "Usage: render-assemble-script <absolute-project-dir> " +
      "--cli-evidence <absolute-generated-dir> [--output <absolute-script>]",
    );
    for (const args of [
      [],
      ["relative", "--cli-evidence", "/tmp/evidence"],
      ["/tmp/project", "--cli-evidence", "relative"],
      ["/tmp/project", "--cli-evidence", "/tmp/evidence", "--unknown"],
    ]) {
      expect((await invoke(args)).exitCode).toBe(2);
    }
  });

  it("atomically creates a 0755 script under a previously missing parent", async () => {
    const project = path.join(temporary, "project");
    await cp(
      path.join(FIXTURES, "renderable-project"),
      project,
      { recursive: true },
    );
    const output = path.join(temporary, "missing/output/assemble.sh");
    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data).toMatchObject({
      status: "external-rendered",
      output,
      supported_write_count: 1,
    });
    expect((await stat(output)).mode & 0o777).toBe(0o755);
    const text = await readFile(output, "utf8");
    expect(text.match(/^run_octopus_assemble 'configure'/gmu)).toHaveLength(1);
    expect(text).not.toContain("--dryrun");
  });

  it("atomically marks both project manifests ready for the fixed output", async () => {
    const project = path.join(temporary, "project-ready");
    await installFullRenderableProject(project);
    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
    ]);

    expect(exitCode).toBe(0);
    expect(result.data.status).toBe("ready");
    const manifest = parse(await readFile(
      path.join(project, "fde-project.yaml"),
      "utf8",
    ));
    const operations = parse(await readFile(
      path.join(project, "assembly/operations.yaml"),
      "utf8",
    ));
    expect(operations.assembly_execution).toEqual(manifest.assembly.assembly_execution);
    expect(operations.assembly_execution).toMatchObject({
      status: "ready",
      script_file: "assembly/octopus-cli-assemble.sh",
      evidence_file: null,
      cli_package_version: "0.1.2",
      cli_reported_version: "0.1.2",
    });
    expect((await stat(path.join(
      project,
      "assembly/octopus-cli-assemble.sh",
    ))).mode & 0o777).toBe(0o755);
    const fresh = await validateProjectDirectory(project);
    expect(fresh.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_SCRIPT_UNEXPECTED",
    }));
    expect(fresh.issues).not.toContainEqual(expect.objectContaining({
      code: "B_PROJECT_STATUS_DRIFT",
    }));
  });

  it("normalizes a fixed-output alias into the locked assembly transaction", async () => {
    const project = path.join(temporary, "project-fixed-alias");
    await installFullRenderableProject(project);
    const outputAlias =
      `${project}/assembly/../assembly/octopus-cli-assemble.sh`;
    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      outputAlias,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data).toMatchObject({
      status: "ready",
      output: path.join(project, "assembly/octopus-cli-assemble.sh"),
    });
    const manifest = parse(await readFile(
      path.join(project, "fde-project.yaml"),
      "utf8",
    ));
    const operations = parse(await readFile(
      path.join(project, "assembly/operations.yaml"),
      "utf8",
    ));
    expect(manifest.assembly.assembly_execution.status).toBe("ready");
    expect(operations.assembly_execution).toEqual(manifest.assembly.assembly_execution);
  });

  it("rejects non-fixed outputs inside the project delivery tree", async () => {
    const project = path.join(temporary, "project-internal-output");
    await installFullRenderableProject(project);
    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      path.join(project, "assembly/manual-assemble.sh"),
    ]);

    expect(exitCode).toBe(2);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_PATH_INVALID",
    }));
    await expect(readFile(
      path.join(project, "assembly/manual-assemble.sh"),
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects an external symlink alias that resolves into project assembly", async () => {
    const project = path.join(temporary, "project-symlink-alias");
    await installFullRenderableProject(project);
    const alias = path.join(temporary, "assembly-alias");
    await symlink(path.join(project, "assembly"), alias);
    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      path.join(alias, "octopus-cli-assemble.sh"),
    ]);

    expect(exitCode).toBe(2);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_OUTPUT_PATH_UNSAFE",
    }));
    const manifest = parse(await readFile(
      path.join(project, "fde-project.yaml"),
      "utf8",
    ));
    expect(manifest.assembly.assembly_execution.status).not.toBe("ready");
    await expect(readFile(path.join(
      project,
      "assembly/octopus-cli-assemble.sh",
    ))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("runtime preflight rejects a generated call that starts with an option", async () => {
    const project = path.join(temporary, "project");
    await installFullRenderableProject(project);
    const output = path.join(project, "assembly/octopus-cli-assemble.sh");
    expect((await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
    ])).exitCode).toBe(0);
    const tampered = (await readFile(output, "utf8")).replace(
      "\nrun_octopus_assemble 'configure' ",
      "\nrun_octopus_assemble '--bad' ",
    );
    await writeFile(output, tampered, { mode: 0o755 });

    await expect(execFileAsync("bash", [output])).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        "generated call starts with an option",
      ),
    });
  });

  it("binds an external output script to the requested project root", async () => {
    const project = path.join(temporary, "project");
    const output = path.join(temporary, "external/assemble.sh");
    const binaryDir = path.join(temporary, "bin");
    const log = path.join(temporary, "cli.log");
    await cp(path.join(FIXTURES, "renderable-project"), project, {
      recursive: true,
    });
    await mkdir(binaryDir);
    const fakeCli = path.join(binaryDir, "octopus-cli");
    await writeFile(fakeCli, [
      "#!/bin/sh",
      "printf '%s\\n' \"$PWD\" \"$@\" > \"$TASK7_CLI_LOG\"",
      "",
    ].join("\n"), { mode: 0o755 });
    expect((await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      output,
    ])).exitCode).toBe(0);

    await execFileAsync("bash", [output], {
      env: {
        ...process.env,
        PATH: `${binaryDir}:${process.env.PATH}`,
        TASK7_CLI_LOG: log,
      },
    });
    const lines = (await readFile(log, "utf8")).trim().split("\n");
    expect(lines[0]).toBe(project);
    expect(lines).toContain("assembly/payloads/example.json");
  });

  it("rejects invalid operations and leaves no empty script", async () => {
    const project = path.join(temporary, "injection");
    await mkdir(path.join(project, "assembly/payloads"), { recursive: true });
    await cp(
      path.join(FIXTURES, "injection-attempt/operations.yaml"),
      path.join(project, "assembly/operations.yaml"),
    );
    await writeFile(
      path.join(project, "assembly/payloads/$(id).json"),
      "{}\n",
    );
    const output = path.join(temporary, "unsafe.sh");
    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "BLOCKER",
    }));
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("classifies a readable null operation as an assembly schema blocker", async () => {
    const project = path.join(temporary, "null-operation");
    await cp(path.join(FIXTURES, "renderable-project"), project, {
      recursive: true,
    });
    const planPath = path.join(project, "assembly/operations.yaml");
    const plan = parse(await readFile(planPath, "utf8"));
    plan.operations = [null];
    await writeFile(planPath, stringify(plan));
    const output = path.join(temporary, "null-operation.sh");

    const { exitCode, result } = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      output,
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "BLOCKER",
      code: "B_ASSEMBLY_SCHEMA",
    }));
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_RENDER_RUNTIME",
    }));
    await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("classifies readable malformed YAML and JSON as domain blockers", async () => {
    const project = path.join(temporary, "malformed");
    await mkdir(path.join(project, "assembly/payloads"), { recursive: true });
    await writeFile(
      path.join(project, "assembly/operations.yaml"),
      "operations: [\n",
    );
    const malformedYaml = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
    ]);
    expect(malformedYaml.exitCode).toBe(1);
    expect(malformedYaml.result.issues[0].code).toBe("B_ASSEMBLY_PARSE");

    await cp(
      path.join(FIXTURES, "renderable-project/assembly/operations.yaml"),
      path.join(project, "assembly/operations.yaml"),
    );
    await writeFile(
      path.join(project, "assembly/payloads/example.json"),
      '{"operation_id":',
    );
    const malformedJson = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
    ]);
    expect(malformedJson.exitCode).toBe(1);
    expect(malformedJson.result.issues[0].code).toBe("B_ASSEMBLY_PARSE");
  });

  it("recomputes complete leaf-help shape instead of trusting flag substrings or index claims", async () => {
    const project = path.join(temporary, "project");
    const evidence = path.join(temporary, "evidence");
    await cp(path.join(FIXTURES, "renderable-project"), project, {
      recursive: true,
    });
    await cp(path.join(FIXTURES, "renderable-cli"), evidence, {
      recursive: true,
    });
    await writeFile(
      path.join(
        evidence,
        "diagnostics/raw/leaf-help/configure-team-private-digiworkers-add.txt",
      ),
      [
        "Usage: octopus-cli wrong path <unexpected>",
        "--body-file",
        "--json <value>",
        "",
      ].join("\n"),
    );

    const result = await invoke([
      project,
      "--cli-evidence",
      evidence,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_EVIDENCE_INVALID",
    }));
  });

  it("rejects forged or incomplete operation overlays even when the planned leaf is valid", async () => {
    const project = path.join(temporary, "project");
    const evidence = path.join(temporary, "evidence");
    await cp(path.join(FIXTURES, "renderable-project"), project, {
      recursive: true,
    });
    await cp(path.join(FIXTURES, "renderable-cli"), evidence, {
      recursive: true,
    });
    const indexPath = path.join(evidence, "cli-command-index.json");
    const index = JSON.parse(await readFile(indexPath, "utf8"));
    index.operations.push({
      operation_id: "forged.unrelated",
      status: "supported",
      evidence: {
        command_path: ["forged", "unrelated"],
        command_present: true,
        leaf_help_checked: true,
        leaf_help_compatible: true,
      },
    });
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

    const result = await invoke([
      project,
      "--cli-evidence",
      evidence,
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.result.issues).toContainEqual(expect.objectContaining({
      code: "B_CLI_EVIDENCE_INVALID",
    }));
  });

  it("classifies unreadable paths and output failures as environment errors", async () => {
    const missing = await invoke([
      path.join(temporary, "missing"),
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
    ]);
    expect(missing.exitCode).toBe(3);

    const readableProject = path.join(temporary, "readable-project");
    await cp(path.join(FIXTURES, "renderable-project"), readableProject, {
      recursive: true,
    });
    const missingEvidence = await invoke([
      readableProject,
      "--cli-evidence",
      path.join(temporary, "missing-evidence"),
    ]);
    expect(missingEvidence.exitCode).toBe(3);

    const project = path.join(temporary, "project");
    await cp(path.join(FIXTURES, "renderable-project"), project, {
      recursive: true,
    });
    const outputParent = path.join(temporary, "file-parent");
    await writeFile(outputParent, "not a directory");
    await chmod(outputParent, 0o444);
    const failed = await invoke([
      project,
      "--cli-evidence",
      path.join(FIXTURES, "renderable-cli"),
      "--output",
      path.join(outputParent, "assemble.sh"),
    ]);
    expect(failed.exitCode).toBe(3);
  });
});
