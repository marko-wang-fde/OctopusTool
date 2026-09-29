import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";

import { main as initMain } from "../../src/commands/init-project.js";
import { main as installMain } from "../../src/commands/install.js";
import { main as packageMain } from "../../src/commands/package-delivery.js";
import { main as renderMain } from "../../src/commands/render-assemble-script.js";
import { main as validateMain } from "../../src/commands/validate-project.js";
import { inspectOctopusCli } from "../../src/assembly/cli-inspector.js";
import { readZipEntries } from "../../src/delivery/zip-writer.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const EXAMPLE = path.join(ROOT, "assets/examples/lead-collector");
const GOLDEN = path.join(EXAMPLE, "expected-project");
const CLI_FIXTURE = path.join(EXAMPLE, "cli-fixture");
const FIXED_CLOCK = () => new Date("2026-07-24T01:00:00.000Z");
let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-e2e-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function invoke(command, args, options = {}) {
  const chunks = [];
  const exitCode = await command(args, {
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  expect(chunks).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

describe("complete offline FDE delivery workflow", () => {
  it("initializes, validates, packages, and installs without external effects", async () => {
    const parent = path.join(temporaryRoot, "projects");
    await mkdir(parent);
    const initArgs = [
      "--mode", "new",
      "--customer", "星河科技",
      "--scenario", "客户线索收集",
      "--parent", parent,
    ];
    const preview = await invoke(initMain, initArgs, { clock: FIXED_CLOCK });
    expect(preview.exitCode).toBe(0);
    expect(preview.result.data.requires_confirmation).toBe(true);
    const initialized = await invoke(
      initMain,
      [...initArgs, "--confirm"],
      { clock: FIXED_CLOCK },
    );
    expect(initialized.exitCode).toBe(0);
    const project = initialized.result.data.absolute_path;

    await rm(project, { recursive: true });
    await cp(GOLDEN, project, { recursive: true });
    await cp(
      path.join(ROOT, "assets/project-template/.gitignore"),
      path.join(project, ".gitignore"),
    );
    const evidence = path.join(temporaryRoot, "fixture-evidence");
    const inspection = await inspectOctopusCli({
      fixtureDir: CLI_FIXTURE,
      output: evidence,
      catalogPath: path.join(ROOT, "catalog/assembly-operations.yaml"),
      spawnCommand: () => {
        throw new Error("real CLI access is forbidden");
      },
    });
    expect(inspection.exitCode).toBe(0);

    const rendered = await invoke(
      renderMain,
      [project, "--cli-evidence", evidence],
      {
        clock: FIXED_CLOCK,
        dependencies: {
          network: () => {
            throw new Error("network access is forbidden");
          },
        },
      },
    );
    expect(rendered.exitCode).toBe(0);

    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    for (const stage of ["initialize", "discover", "team-design"]) {
      manifest.stage_status[stage].approved_at = FIXED_CLOCK().toISOString();
    }
    await writeFile(manifestPath, stringify(manifest, { lineWidth: 0 }));
    for (const stage of [
      "initialize",
      "discover",
      "team-design",
      "foundation-design",
      "author",
      "assemble",
    ]) {
      const accepted = await invoke(
        validateMain,
        [
          project,
          "--accept-stage",
          stage,
          "--cli-fixture-dir",
          CLI_FIXTURE,
        ],
        { clock: FIXED_CLOCK },
      );
      expect(
        accepted.exitCode,
        `${stage}: ${JSON.stringify(accepted.result.issues)}`,
      ).toBe(0);
    }
    await cp(
      path.join(
        ROOT,
        "assets/examples/lead-collector/package-scan-policy.yaml",
      ),
      path.join(project, "reports/package-scan-policy.yaml"),
    );

    const archiveA = path.join(temporaryRoot, "delivery-a.zip");
    const packaged = await invoke(
      packageMain,
      [
        project,
        "--confirm-personal-data",
        "--output",
        archiveA,
      ],
      { clock: FIXED_CLOCK, sourceDateEpoch: "1784854800" },
    );
    expect(packaged.exitCode, JSON.stringify(packaged.result.issues)).toBe(0);
    expect(packaged.result.data.project_status).toBe("delivery-ready");
    expect(packaged.result.data.project_status).not.toBe(
      "cli-assembled",
    );
    const entries = await readZipEntries(archiveA);
    expect(entries.map(({ path: entryPath }) => entryPath)).toContain(
      "package-manifest.json",
    );

    const archiveB = path.join(temporaryRoot, "delivery-b.zip");
    const projectB = path.join(temporaryRoot, "project-copy");
    await cp(project, projectB, { recursive: true });
    const packagedAgain = await invoke(
      packageMain,
      [
        projectB,
        "--confirm-personal-data",
        "--output",
        archiveB,
      ],
      { clock: FIXED_CLOCK, sourceDateEpoch: "1784854800" },
    );
    expect(packagedAgain.exitCode).toBe(0);
    expect(await readFile(archiveB)).toEqual(await readFile(archiveA));

    const fakeHome = path.join(temporaryRoot, "home");
    const fakeXdg = path.join(temporaryRoot, "xdg");
    const installed = await invoke(
      installMain,
      ["--target", "both", "--mode", "copy"],
      {
        clock: FIXED_CLOCK,
        env: { HOME: fakeHome, XDG_CONFIG_HOME: fakeXdg },
        sourceMetadata: {
          issues: [],
          source_commit: "f".repeat(40),
          source_kind: "git",
        },
      },
    );
    expect(installed.exitCode, JSON.stringify(installed.result.issues)).toBe(0);
    expect(installed.result.data.targets.map(({ id }) => id).sort()).toEqual([
      "claude-code",
      "codex",
    ]);
  }, 45_000);
});
