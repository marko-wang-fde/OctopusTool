import {
  cp,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";

import { main } from "../../src/commands/package-delivery.js";
import { main as validateMain } from "../../src/commands/validate-project.js";
import {
  validateProjectDirectory,
} from "../../src/contracts/project-validator.js";
import { readZipEntries } from "../../src/delivery/zip-writer.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const GOLDEN = path.join(
  ROOT,
  "assets/examples/lead-collector/expected-project",
);
const CLI_FIXTURE = path.join(
  ROOT,
  "assets/examples/lead-collector/cli-fixture",
);
let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-package-test-"));
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
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function prepareProject() {
  const project = path.join(temporaryRoot, "project");
  await cp(GOLDEN, project, { recursive: true });
  await cp(
    path.join(ROOT, "assets/project-template/.gitignore"),
    path.join(project, ".gitignore"),
  );
  await cp(
    path.join(
      ROOT,
      "assets/examples/lead-collector/package-scan-policy.yaml",
    ),
    path.join(project, "reports/package-scan-policy.yaml"),
  );
  const manifestPath = path.join(project, "fde-project.yaml");
  const manifest = parse(await readFile(manifestPath, "utf8"));
  for (const stage of ["initialize", "discover", "team-design"]) {
    manifest.stage_status[stage].approved_at = "2026-07-24T01:00:00Z";
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
    const chunks = [];
    const exitCode = await validateMain([
      project,
      "--accept-stage",
      stage,
      "--cli-fixture-dir",
      CLI_FIXTURE,
    ], {
      writeStdout: (chunk) => chunks.push(chunk),
    });
    expect(exitCode, `${stage}: ${chunks.join("")}`).toBe(0);
  }
  return project;
}

describe("package-delivery command", () => {
  it("has an exact no-write help and argument boundary", async () => {
    const before = await readdir(temporaryRoot);
    const help = await invoke(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.result.data.usage).toBe(
      "Usage: package-delivery <absolute-project-dir> [--include-sources --confirm-source-risk] [--confirm-personal-data] [--output <absolute-zip>]",
    );
    expect(await readdir(temporaryRoot)).toEqual(before);
    for (const args of [
      [],
      ["relative"],
      [temporaryRoot, "--unknown"],
      [temporaryRoot, "--output", "relative.zip"],
      [temporaryRoot, "--include-sources"],
      [temporaryRoot, "--confirm-source-risk"],
    ]) {
      expect((await invoke(args)).exitCode).toBe(2);
    }
    expect((await invoke([temporaryRoot], {
      sourceDateEpoch: "not-an-epoch",
    })).exitCode).toBe(2);
  });

  it("packages a validated project deterministically and refuses overwrite", async () => {
    const project = await prepareProject();
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(project, "inputs/source-files"), {
      recursive: true,
    });
    await writeFile(
      path.join(project, "inputs/source-files/private.txt"),
      "PRIVATE-SOURCE-MARKER\n",
    );
    const output = path.join(temporaryRoot, "delivery.zip");
    const first = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(first.exitCode, JSON.stringify(first.result.issues)).toBe(0);
    expect(first.result.data).toMatchObject({
      project_status: "delivery-ready",
      packaged_files: expect.any(Number),
      package_input_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      excluded_file_count: expect.any(Number),
      excluded_categories: expect.arrayContaining(["generated"]),
    });
    expect(first.result.data).not.toHaveProperty("excluded_files");
    const entries = await readZipEntries(output);
    const paths = entries.map(({ path: entryPath }) => entryPath);
    expect(paths).toContain("package-manifest.json");
    expect(paths).toContain("reports/package-validation.json");
    expect(paths).toContain("inputs/input-inventory.md");
    expect(paths).toContain("assembly/assembly-plan.md");
    expect(paths).toContain("reports/package-scan-policy.yaml");
    expect(paths).not.toContain("reports/validation-report.md");
    expect(paths).not.toContain(".gitignore");
    expect(paths.some((entryPath) =>
      entryPath.startsWith("inputs/source-files/"))).toBe(false);
    expect(Buffer.concat(entries.map(({ bytes: entryBytes }) => entryBytes))
      .includes(Buffer.from("PRIVATE-SOURCE-MARKER"))).toBe(false);
    expect(paths.some((entryPath) => entryPath.startsWith("generated/"))).toBe(false);
    expect(paths.some((entryPath) => entryPath.endsWith(".zip"))).toBe(false);
    const packageManifest = JSON.parse(
      entries.find(({ path: entryPath }) =>
        entryPath === "package-manifest.json").bytes.toString("utf8"),
    );
    expect(packageManifest.self_entry).toBe("excluded");
    expect(packageManifest.files.some(({ path: entryPath }) =>
      entryPath === "package-manifest.json")).toBe(false);
    expect(packageManifest.files.map(({ path: entryPath }) => entryPath))
      .toEqual(paths.filter((entryPath) =>
        entryPath !== "package-manifest.json"));
    for (const entry of packageManifest.files) {
      const archivedBytes = entries.find(({ path: entryPath }) =>
        entryPath === entry.path).bytes;
      expect(entry.sha256, entry.path).toBe(
        createHash("sha256").update(archivedBytes).digest("hex"),
      );
    }
    const reportEntry = packageManifest.files.find(({ path: entryPath }) =>
      entryPath === "reports/package-validation.json");
    const reportBytes = entries.find(({ path: entryPath }) =>
      entryPath === "reports/package-validation.json").bytes;
    expect(reportEntry.sha256).toBe(
      createHash("sha256").update(reportBytes).digest("hex"),
    );
    expect(JSON.parse(reportBytes.toString("utf8")))
      .not.toHaveProperty("manifest_sha256");
    expect(packageManifest.files.map(({ path: entryPath }) => entryPath))
      .toEqual(expect.arrayContaining([
        "inputs/input-inventory.md",
        "assembly/assembly-plan.md",
        "reports/package-scan-policy.yaml",
      ]));
    expect(await lstat(output)).toMatchObject({ mode: expect.any(Number) });
    const customerValidation = await validateProjectDirectory(project);
    expect(
      customerValidation.exitCode,
      JSON.stringify(customerValidation.issues),
    ).toBe(0);

    const bytes = await readFile(output);
    const second = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ]);
    expect(second.exitCode).toBe(1);
    expect(await readFile(output)).toEqual(bytes);
  });

  it("rejects an old extracted package manifest without modifying customer outputs", async () => {
    const project = await prepareProject();
    const firstOutput = path.join(temporaryRoot, "first-delivery.zip");
    const first = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      firstOutput,
    ]);
    expect(first.exitCode, JSON.stringify(first.result.issues)).toBe(0);
    const extractedManifest = (await readZipEntries(firstOutput)).find(
      ({ path: entryPath }) => entryPath === "package-manifest.json",
    ).bytes;
    const packageManifestPath = path.join(project, "package-manifest.json");
    await writeFile(packageManifestPath, extractedManifest);

    const manifestPath = path.join(project, "fde-project.yaml");
    const reportPath = path.join(
      project,
      "reports/package-validation.json",
    );
    const secondOutput = path.join(temporaryRoot, "second-delivery.zip");
    const manifestBefore = await readFile(manifestPath);
    const reportBefore = await readFile(reportPath);

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      secondOutput,
    ]);

    expect(packaged.exitCode).toBe(1);
    expect(packaged.result.issues).toEqual([
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_PACKAGE_MANIFEST_PRESENT",
        path: "package-manifest.json",
      }),
    ]);
    expect(await readFile(packageManifestPath)).toEqual(extractedManifest);
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    expect(await readFile(reportPath)).toEqual(reportBefore);
    await expect(lstat(secondOutput)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it.each(["symlink", "directory"])(
    "rejects a customer-root package manifest %s without modifying outputs",
    async (entryType) => {
      const project = await prepareProject();
      const packageManifestPath = path.join(project, "package-manifest.json");
      if (entryType === "symlink") {
        await symlink("fde-project.yaml", packageManifestPath);
      } else {
        await mkdir(packageManifestPath);
      }
      const manifestPath = path.join(project, "fde-project.yaml");
      const reportPath = path.join(
        project,
        "reports/package-validation.json",
      );
      const output = path.join(
        temporaryRoot,
        `${entryType}-manifest-delivery.zip`,
      );
      const manifestBefore = await readFile(manifestPath);
      const reportBefore = await readFile(reportPath).catch((error) =>
        error?.code === "ENOENT" ? null : Promise.reject(error));

      const packaged = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        output,
      ]);

      expect(packaged.exitCode).toBe(1);
      expect(packaged.result.issues).toEqual([
        expect.objectContaining({
          severity: "BLOCKER",
          code: "B_PACKAGE_MANIFEST_PRESENT",
          path: "package-manifest.json",
        }),
      ]);
      expect(await readFile(manifestPath)).toEqual(manifestBefore);
      expect(await readFile(reportPath).catch((error) =>
        error?.code === "ENOENT" ? null : Promise.reject(error)))
        .toEqual(reportBefore);
      await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
      const present = await lstat(packageManifestPath);
      expect(entryType === "symlink"
        ? present.isSymbolicLink()
        : present.isDirectory()).toBe(true);
    },
    15_000,
  );

  it("rejects a package manifest that appears at a commit boundary and rolls back", async () => {
    const project = await prepareProject();
    const packageManifestPath = path.join(project, "package-manifest.json");
    const manifestPath = path.join(project, "fde-project.yaml");
    const reportPath = path.join(
      project,
      "reports/package-validation.json",
    );
    const output = path.join(temporaryRoot, "manifest-race-delivery.zip");
    const manifestBefore = await readFile(manifestPath);
    const foreignManifest = Buffer.from('{"foreign":true}\n', "utf8");

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeTarget: async ({ failAt }) => {
          if (failAt === "commit-manifest") {
            await writeFile(packageManifestPath, foreignManifest);
          }
        },
      },
    });

    expect(packaged.exitCode).toBe(1);
    expect(packaged.result.issues).toEqual([
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_PACKAGE_MANIFEST_PRESENT",
        path: "package-manifest.json",
      }),
    ]);
    expect(await readFile(packageManifestPath)).toEqual(foreignManifest);
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    await expect(lstat(reportPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it("preserves recovery details when a manifest race meets foreign output drift", async () => {
    const project = await prepareProject();
    const packageManifestPath = path.join(project, "package-manifest.json");
    const manifestPath = path.join(project, "fde-project.yaml");
    const output = path.join(temporaryRoot, "manifest-race-recovery.zip");
    const manifestBefore = await readFile(manifestPath);
    const foreignManifest = Buffer.from('{"foreign":true}\n', "utf8");
    const foreignOutput = Buffer.from("foreign customer manifest\n", "utf8");

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeTarget: async ({ failAt }) => {
          if (failAt === "commit-report") {
            await writeFile(packageManifestPath, foreignManifest);
            await writeFile(manifestPath, foreignOutput);
          }
        },
      },
    });

    expect(packaged.exitCode).toBe(3);
    expect(packaged.result.issues[0]).toMatchObject({
      code: "B_PACKAGE_RUNTIME",
      details: {
        error_code: "B_PACKAGE_MANIFEST_PRESENT",
        transaction_boundary: "commit-report",
      },
    });
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    expect(await readFile(packageManifestPath)).toEqual(foreignManifest);
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
    expect(packaged.result.data.recovery_paths.length).toBeGreaterThan(0);
    const recoveryContents = await Promise.all(
      packaged.result.data.recovery_paths.map((candidate) =>
        readFile(candidate).catch(() => null)),
    );
    expect(recoveryContents.some((bytes) => bytes?.equals(foreignOutput)))
      .toBe(true);
  }, 15_000);

  it("reuses report bytes by its three-key identity across source mode", async () => {
    const project = await prepareProject();
    const firstOutput = path.join(temporaryRoot, "first.zip");
    const secondOutput = path.join(temporaryRoot, "second.zip");
    expect((await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      firstOutput,
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    })).exitCode).toBe(0);
    const reportPath = path.join(project, "reports/package-validation.json");
    const firstReport = await readFile(reportPath);
    const firstManifest = parse(await readFile(
      path.join(project, "fde-project.yaml"),
      "utf8",
    ));

    const second = await invoke([
      project,
      "--include-sources",
      "--confirm-source-risk",
      "--confirm-personal-data",
      "--output",
      secondOutput,
    ], {
      clock: () => new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(second.exitCode, JSON.stringify(second.result.issues)).toBe(0);
    expect(await readFile(reportPath)).toEqual(firstReport);
    expect(JSON.parse(firstReport.toString("utf8")))
      .not.toHaveProperty("sources_included");
    const secondManifest = parse(await readFile(
      path.join(project, "fde-project.yaml"),
      "utf8",
    ));
    expect(secondManifest.stage_status.validate.baseline_revision)
      .toBe(firstManifest.stage_status.validate.baseline_revision);
    expect(await readFile(secondOutput)).not.toEqual(await readFile(firstOutput));
    const firstEntries = await readZipEntries(firstOutput);
    const secondEntries = await readZipEntries(secondOutput);
    const firstPackageManifest = JSON.parse(firstEntries.find(
      ({ path: entryPath }) => entryPath === "package-manifest.json",
    ).bytes.toString("utf8"));
    const secondPackageManifest = JSON.parse(secondEntries.find(
      ({ path: entryPath }) => entryPath === "package-manifest.json",
    ).bytes.toString("utf8"));
    expect(firstPackageManifest.packaged_at)
      .toBe("2026-07-24T01:00:00.000Z");
    expect(secondPackageManifest.packaged_at)
      .toBe("2027-01-01T00:00:00.000Z");
  });

  it("rebuilds same-key reports whose passing evidence was tampered", async () => {
    const project = await prepareProject();
    const reportPath = path.join(project, "reports/package-validation.json");
    const first = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      path.join(temporaryRoot, "report-initial.zip"),
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(first.exitCode).toBe(0);
    const mutations = [
      (report) => { report.status = "failed"; },
      (report) => { report.validation_result.status = "failed"; },
      (report) => { report.validation_result.blocker_count = 1; },
      (report) => { report.validation_result.redactions = [{}]; },
      (report) => {
        report.validation_result.results = [{
          severity: "BLOCKER",
          status: "failed",
        }];
      },
      (report) => { report.packaged_at = "2026-07-24T01:00:00.000Z"; },
      (report) => { report.sources_included = false; },
      (report) => { report.unknown = true; },
      (report) => { report.validation_result.unknown = true; },
      (report) => {
        report.validation_result.redactions = [{
          category: "absolute-source-path",
          path: "fde-project.yaml",
          replacement: "redacted://source/0",
          source_index: 0,
          unknown: true,
        }];
      },
      (report) => {
        report.validation_result.results = [{
          severity: "WARNING",
          status: "passed",
          unknown: true,
        }];
      },
      (report) => {
        report.validation_result.redactions = [{
          category: "absolute-source-path",
          path: "fde-project.yaml",
          replacement: "redacted://source/0",
          source_index: 0,
        }];
      },
      (report) => {
        report.validation_result.results = [{
          severity: "WARNING",
          status: "passed",
        }];
      },
    ];
    for (const [index, mutate] of mutations.entries()) {
      const tampered = JSON.parse(await readFile(reportPath, "utf8"));
      mutate(tampered);
      await writeFile(reportPath, `${JSON.stringify(tampered, null, 2)}\n`);
      const rebuilt = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        path.join(temporaryRoot, `report-rebuilt-${index}.zip`),
      ], {
        clock: () => new Date(
          Date.parse("2026-07-24T01:00:01.000Z") + (index * 1000),
        ),
      });
      expect(rebuilt.exitCode, JSON.stringify(rebuilt.result.issues)).toBe(0);
      const report = JSON.parse(await readFile(reportPath, "utf8"));
      expect(report).toMatchObject({
        status: "passed",
        validation_result: {
          status: "passed",
          blocker_count: 0,
          redactions: [],
        },
      });
      expect(report.validation_result.results ?? []).not.toContainEqual(
        expect.objectContaining({
          severity: "BLOCKER",
        }),
      );
      expect(report.validation_result).not.toHaveProperty("results");
    }
  }, 40_000);

  it.each([
    ["binary", Buffer.from([0xff, 0xfe, 0x00, 0x01])],
    ["invalid JSON", Buffer.from('{"broken":\n', "utf8")],
    [
      "sensitive invalid evidence",
      Buffer.from('{"access_token":"token: leaked-value"}\n', "utf8"),
    ],
  ])(
    "rebuilds a %s old package report instead of scanning replaced bytes",
    async (_description, staleReport) => {
      const project = await prepareProject();
      const reportPath = path.join(
        project,
        "reports/package-validation.json",
      );
      await writeFile(reportPath, staleReport);
      const output = path.join(
        temporaryRoot,
        `${_description.replaceAll(" ", "-")}-report.zip`,
      );

      const packaged = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        output,
      ]);

      expect(packaged.exitCode, JSON.stringify(packaged.result.issues)).toBe(0);
      expect(JSON.parse(await readFile(reportPath, "utf8"))).toMatchObject({
        status: "passed",
        validation_result: {
          status: "passed",
          blocker_count: 0,
        },
      });
      const freshValidation = await validateProjectDirectory(project);
      expect(
        freshValidation.exitCode,
        JSON.stringify(freshValidation.issues),
      ).toBe(0);
      expect(await lstat(output)).toMatchObject({ mode: expect.any(Number) });
    },
    15_000,
  );

  it("rolls back all customer outputs and removes staging after a commit failure", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "delivery.zip");
    const manifestBefore = await readFile(path.join(project, "fde-project.yaml"));
    const reportPath = path.join(project, "reports/package-validation.json");
    const result = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      failAt: "commit-report",
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(result.exitCode).toBe(3);
    expect(await readFile(path.join(project, "fde-project.yaml")))
      .toEqual(manifestBefore);
    await expect(lstat(reportPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await readdir(temporaryRoot)).filter((name) =>
      name.startsWith(".aiworker-package-") ||
      name.startsWith(".tmp-"))).toEqual([]);
  });

  it("includes source files only after the paired explicit risk confirmation", async () => {
    const project = await prepareProject();
    await writeFile(path.join(
      project,
      "inputs/source-files/brief.txt",
    ), "PRIVATE-SOURCE-MARKER\n", {
      flag: "wx",
    }).catch(async (error) => {
      if (error?.code !== "ENOENT") throw error;
      const { mkdir } = await import("node:fs/promises");
      await mkdir(path.join(project, "inputs/source-files"), {
        recursive: true,
      });
      await writeFile(
        path.join(project, "inputs/source-files/brief.txt"),
        "PRIVATE-SOURCE-MARKER\n",
      );
    });
    await writeFile(
      path.join(project, "inputs/source-files/token.txt"),
      "EXCLUDED-SOURCE-TOKEN\n",
    );
    const output = path.join(temporaryRoot, "with-sources.zip");
    const packaged = await invoke([
      project,
      "--include-sources",
      "--confirm-source-risk",
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(packaged.exitCode, JSON.stringify(packaged.result.issues)).toBe(0);
    const entries = await readZipEntries(output);
    expect(entries.map(({ path: entryPath }) => entryPath))
      .toContain("inputs/source-files/brief.txt");
    expect(entries.map(({ path: entryPath }) => entryPath))
      .not.toContain("inputs/source-files/token.txt");
    const packageManifest = JSON.parse(entries.find(
      ({ path: entryPath }) => entryPath === "package-manifest.json",
    ).bytes.toString("utf8"));
    expect(packageManifest.sources_included).toBe(true);
    expect(packageManifest.files.map(({ path: entryPath }) => entryPath))
      .toContain("inputs/source-files/brief.txt");
    expect(entries.find(({ path: entryPath }) =>
      entryPath === "inputs/source-files/brief.txt").bytes.toString("utf8"))
      .toContain("PRIVATE-SOURCE-MARKER");
    const freshValidation = await validateProjectDirectory(project);
    expect(
      freshValidation.exitCode,
      JSON.stringify(freshValidation.issues),
    ).toBe(0);
    expect(freshValidation.data.project_status).toBe("delivery-ready");

    await writeFile(
      path.join(project, "inputs/source-files/brief.txt"),
      "CHANGED-SOURCE-MARKER\n",
    );
    const staleValidation = await validateProjectDirectory(project);
    expect(staleValidation.exitCode).toBe(1);
    expect(staleValidation.issues).toContainEqual(expect.objectContaining({
      code: "B_PACKAGE_EVIDENCE_INVALID",
      path: "reports/package-validation.json",
    }));
  }, 15_000);

  it("rejects source formats that V1 cannot reliably text-scan", async () => {
    const project = await prepareProject();
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(project, "inputs/source-files"), {
      recursive: true,
    });
    await writeFile(
      path.join(project, "inputs/source-files/private.docx"),
      Buffer.from("PK\u0003\u0004PRIVATE-DOCX-MARKER", "utf8"),
    );
    await writeFile(
      path.join(project, "inputs/source-files/private.pdf"),
      Buffer.from("%PDF-1.7\nPRIVATE-PDF-MARKER\n", "utf8"),
    );
    await writeFile(
      path.join(project, "inputs/source-files/private.png"),
      Buffer.from("\u0089PNG\r\n\u001a\nPRIVATE-IMAGE-MARKER", "latin1"),
    );
    await writeFile(
      path.join(project, "inputs/source-files/private.zip"),
      Buffer.from("PK\u0003\u0004PRIVATE-ARCHIVE-MARKER", "utf8"),
    );
    await writeFile(
      path.join(project, "inputs/source-files/invalid.txt"),
      Buffer.from([0xc3, 0x28]),
    );
    await writeFile(
      path.join(project, "inputs/source-files/nul.txt"),
      Buffer.from("visible\u0000hidden", "utf8"),
    );
    await writeFile(
      path.join(project, "inputs/source-files/disguised.txt"),
      Buffer.from("%PDF-1.7\nASCII BUT BINARY MEDIA\n", "ascii"),
    );
    await writeFile(
      path.join(project, "inputs/source-files/token.pdf"),
      Buffer.from("%PDF-1.7\nEXCLUDED-BY-NAME\n", "ascii"),
    );
    const output = path.join(temporaryRoot, "unscannable.zip");

    const packaged = await invoke([
      project,
      "--include-sources",
      "--confirm-source-risk",
      "--confirm-personal-data",
      "--output",
      output,
    ]);

    expect(packaged.exitCode).toBe(1);
    expect(
      packaged.result.issues.filter(({ code }) =>
        code === "B_SOURCE_UNSCANNABLE"),
      JSON.stringify(packaged.result.issues),
    ).toHaveLength(7);
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it("rejects every selected delivery file that cannot be reliably scanned", async () => {
    const project = await prepareProject();
    const selectedBinaryFiles = new Map([
      ["design/private.docx", Buffer.from("PK\u0003\u0004DOCX", "latin1")],
      ["customer.pdf", Buffer.from("%PDF-1.7\nPRIVATE\n", "ascii")],
      ["image.png", Buffer.from(
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      )],
      ["bundle.tar", Buffer.from("ustar archive payload\n", "ascii")],
      ["blob.bin", Buffer.from([0x01, 0x02, 0x03, 0x04])],
    ]);
    for (const [relativePath, bytes] of selectedBinaryFiles) {
      const target = path.join(project, ...relativePath.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    const output = path.join(temporaryRoot, "selected-binary.zip");

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ]);

    expect(packaged.exitCode).toBe(1);
    expect(packaged.result.issues.filter(({ code }) =>
      code === "B_DELIVERY_FILE_UNSCANNABLE")).toHaveLength(
      selectedBinaryFiles.size,
    );
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it("does not scan or block binary source files excluded by default", async () => {
    const project = await prepareProject();
    const sourcePath = path.join(
      project,
      "inputs/source-files/private.pdf",
    );
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, Buffer.from("%PDF-1.7\nPRIVATE\n", "ascii"));
    const output = path.join(temporaryRoot, "sources-excluded.zip");

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ]);

    expect(packaged.exitCode, JSON.stringify(packaged.result.issues)).toBe(0);
    expect((await readZipEntries(output)).map(({ path: entryPath }) => entryPath))
      .not.toContain("inputs/source-files/private.pdf");
  }, 15_000);

  it("claims and verifies prepared files before publishing them", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "temp-claim-race.zip");
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifestBefore = await readFile(manifestPath);
    const foreign = Buffer.from("foreign prepared output\n");
    let displaced;

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeTarget: async ({ failAt, temporary }) => {
          if (failAt === "commit-manifest") {
            displaced = `${temporary}.owned-displaced`;
            await rename(temporary, displaced);
            await writeFile(temporary, foreign, { mode: 0o644 });
          }
        },
      },
    });

    expect(packaged.exitCode).toBe(3);
    expect(packaged.result.issues[0].details.error)
      .toContain("Prepared transaction output changed before claim");
    const recoveryContents = await Promise.all(
      packaged.result.data.recovery_paths.map((candidate) =>
        readFile(candidate).catch(() => null)),
    );
    expect(recoveryContents.some((bytes) => bytes?.equals(foreign))).toBe(true);
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
    expect(displaced).toBeTruthy();
  }, 15_000);

  it.each([
    { relativePath: "design/team-design.md", includeSources: false },
    {
      relativePath: "assembly/payloads/team-private-digiworker-create.json",
      includeSources: false,
    },
    {
      relativePath: "reports/package-scan-policy.yaml",
      includeSources: false,
    },
    {
      relativePath: "inputs/input-inventory.md",
      includeSources: false,
    },
    {
      relativePath: "assembly/assembly-plan.md",
      includeSources: false,
    },
    {
      relativePath: "inputs/source-files/brief.txt",
      includeSources: true,
    },
  ])(
    "aborts package commit when $relativePath changes at an output boundary",
    async ({ relativePath, includeSources }) => {
      const project = await prepareProject();
      const output = path.join(temporaryRoot, "late-design.zip");
      const manifestPath = path.join(project, "fde-project.yaml");
      const manifestBefore = await readFile(manifestPath);
      const changedPath = path.join(project, ...relativePath.split("/"));
      if (includeSources) {
        await mkdir(path.dirname(changedPath), { recursive: true });
        await writeFile(changedPath, "initial source brief\n");
      }
      let injected = false;

      const packaged = await invoke([
        project,
        ...(includeSources
          ? ["--include-sources", "--confirm-source-risk"]
          : []),
        "--confirm-personal-data",
        "--output",
        output,
      ], {
        transactionHooks: {
          beforeTarget: async ({ failAt }) => {
            if (failAt === "commit-report" && !injected) {
              injected = true;
              await writeFile(
                changedPath,
                `${await readFile(changedPath, "utf8")}\nlate package edit\n`,
              );
            }
          },
        },
      });

      expect(injected).toBe(true);
      expect(packaged.exitCode).toBe(3);
      expect(packaged.result.issues[0].details.error)
        .toContain("validation snapshot");
      expect(await readFile(manifestPath)).toEqual(manifestBefore);
      await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
    },
    15_000,
  );

  it("rechecks inputs after the final output publish and rolls everything back", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "final-snapshot.zip");
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifestBefore = await readFile(manifestPath);
    const payloadPath = path.join(
      project,
      "assembly/payloads/team-private-digiworker-create.json",
    );

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        afterAllTargetsPublished: async () => {
          await writeFile(
            payloadPath,
            `${await readFile(payloadPath, "utf8")}\nfinal-boundary edit\n`,
          );
        },
      },
    });

    expect(packaged.exitCode).toBe(3);
    expect(packaged.result.issues[0].details).toMatchObject({
      error_code: "E_VALIDATION_SNAPSHOT_DRIFT",
      transaction_boundary: "commit-final-verification",
    });
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it.each(["edit", "add", "delete"])(
    "binds the exact selected path set and bytes against a late %s",
    async (mutation) => {
      const project = await prepareProject();
      const notesRoot = path.join(project, "notes");
      const existingPath = path.join(notesRoot, "extra.md");
      await mkdir(notesRoot);
      await writeFile(existingPath, "# original extra note\n");
      const output = path.join(temporaryRoot, `selection-${mutation}.zip`);
      const manifestPath = path.join(project, "fde-project.yaml");
      const manifestBefore = await readFile(manifestPath);

      const packaged = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        output,
      ], {
        transactionHooks: {
          beforeTarget: async ({ failAt }) => {
            if (failAt !== "commit-report") return;
            if (mutation === "edit") {
              await writeFile(existingPath, "# changed extra note\n");
            } else if (mutation === "add") {
              await writeFile(path.join(notesRoot, "added.md"), "# added\n");
            } else {
              await rm(existingPath);
            }
          },
        },
      });

      expect(packaged.exitCode).toBe(3);
      expect(packaged.result.issues[0].details).toMatchObject({
        error_code: "E_DELIVERY_SELECTION_DRIFT",
      });
      expect(await readFile(manifestPath)).toEqual(manifestBefore);
      await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
    },
    15_000,
  );

  it.each(["commit-manifest", "commit-report", "commit-zip"])(
    "rolls back all outputs when %s post-link verification detects drift",
    async (failedOutput) => {
      const project = await prepareProject();
      const output = path.join(
        temporaryRoot,
        `${failedOutput}-post-link-drift.zip`,
      );
      const manifestPath = path.join(project, "fde-project.yaml");
      const reportPath = path.join(
        project,
        "reports/package-validation.json",
      );
      const manifestBefore = await readFile(manifestPath);
      const foreign = Buffer.from(`foreign ${failedOutput} output\n`);

      const packaged = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        output,
      ], {
        transactionHooks: {
          afterTargetLinked: async ({ failAt, target }) => {
            if (failAt === failedOutput) {
              await writeFile(target, foreign);
            }
          },
        },
      });

      expect(packaged.exitCode).toBe(3);
      expect(packaged.result.issues[0].details).toMatchObject({
        error_code: "E_PACKAGE_TRANSACTION_DRIFT",
      });
      expect(await readFile(manifestPath)).toEqual(manifestBefore);
      await expect(lstat(reportPath)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
      const recoveryContents = await Promise.all(
        packaged.result.data.recovery_paths.map((candidate) =>
          readFile(candidate).catch(() => null)),
      );
      expect(recoveryContents.some((bytes) => bytes?.equals(foreign)))
        .toBe(true);
    },
    15_000,
  );

  it("rechecks every published output before final commit", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "final-output-check.zip");
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifestBefore = await readFile(manifestPath);
    const foreign = Buffer.from("tampered published archive\n");

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        afterAllTargetsPublished: async () => {
          await writeFile(output, foreign);
        },
      },
    });

    expect(packaged.exitCode).toBe(3);
    expect(packaged.result.issues[0].details).toMatchObject({
      error_code: "E_PACKAGE_TRANSACTION_DRIFT",
      transaction_boundary: "commit-final-verification",
    });
    const recoveryContents = await Promise.all(
      packaged.result.data.recovery_paths.map((candidate) =>
        readFile(candidate).catch(() => null)),
    );
    expect(recoveryContents.some((bytes) => bytes?.equals(foreign))).toBe(true);
    expect(await readFile(manifestPath)).toEqual(manifestBefore);
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it("keeps committed outputs when old-backup cleanup is deferred", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "cleanup-warning.zip");
    const manifestBefore = await readFile(path.join(project, "fde-project.yaml"));
    let retainedBackup;

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeBackupCleanup: async ({ backup }) => {
          if (!retainedBackup) {
            retainedBackup = backup;
            throw new Error("injected backup cleanup failure");
          }
        },
      },
    });

    expect(packaged.exitCode).toBe(0);
    expect(packaged.result.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_TRANSACTION_CLEANUP_DEFERRED",
    }));
    expect(packaged.result.data.recovery_paths).toContain(retainedBackup);
    expect(await readFile(retainedBackup)).toEqual(manifestBefore);
    await expect(lstat(output)).resolves.toMatchObject({});
    expect(await readFile(path.join(project, "fde-project.yaml")))
      .not.toEqual(manifestBefore);
  }, 15_000);

  it("retains a same-content foreign inode in single-file backup cleanup", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "single-file-cleanup-race.zip");
    let injected = false;

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        afterTransactionCleanupEntryVerified: async ({
          claimedPath,
          relativePath,
          recoveryRoot,
        }) => {
          if (
            injected ||
            relativePath !== "." ||
            !recoveryRoot.includes(".tmp-backup-")
          ) {
            return;
          }
          injected = true;
          const bytes = await readFile(claimedPath);
          await rename(claimedPath, `${claimedPath}-displaced-owned`);
          await writeFile(claimedPath, bytes);
          await writeFile(
            path.join(path.dirname(claimedPath), "FOREIGN-SENTINEL.txt"),
            "FOREIGN-SENTINEL\n",
          );
        },
      },
    });

    expect(packaged.exitCode).toBe(0);
    expect(packaged.result.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_TRANSACTION_CLEANUP_DEFERRED",
    }));
    const recoveryPath = packaged.result.data.recovery_paths.find((candidate) =>
      candidate.includes(".tmp-backup-"));
    await expect(lstat(recoveryPath)).resolves.toMatchObject({});
    expect(await readFile(recoveryPath)).toEqual(
      await readFile(`${recoveryPath}-displaced-owned`),
    );
    expect(await readFile(
      path.join(path.dirname(recoveryPath), "FOREIGN-SENTINEL.txt"),
      "utf8",
    )).toBe("FOREIGN-SENTINEL\n");
  }, 15_000);

  it("atomically claims staging and preserves a foreign replacement", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "foreign-staging.zip");
    const foreign = Buffer.from("foreign staging content\n");
    let displaced;

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeStagingCleanup: async ({ stagingRoot }) => {
          displaced = `${stagingRoot}.owned-displaced`;
          await rename(stagingRoot, displaced);
          await mkdir(stagingRoot);
          await writeFile(path.join(stagingRoot, "foreign.txt"), foreign);
        },
      },
    });

    expect(packaged.exitCode).toBe(3);
    expect(packaged.result.issues[0].details.error)
      .toContain("foreign staging directory");
    const preserved = packaged.result.data.recovery_paths[0];
    expect(await readFile(path.join(preserved, "foreign.txt"))).toEqual(foreign);
    await expect(lstat(output)).resolves.toMatchObject({});
    await expect(lstat(displaced)).resolves.toMatchObject({});
  }, 15_000);

  it("preserves staging when an unowned entry appears before cleanup", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "foreign-staging-entry.zip");
    const foreign = Buffer.from("foreign staging entry\n");

    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      transactionHooks: {
        beforeStagingCleanup: async ({ stagingRoot }) => {
          await writeFile(path.join(stagingRoot, "foreign.txt"), foreign);
        },
      },
    });

    expect(packaged.exitCode).toBe(3);
    expect(packaged.result.issues[0].details).toMatchObject({
      error_code: "E_PACKAGE_STAGING_DRIFT",
    });
    const preserved = packaged.result.data.recovery_paths[0];
    expect(await readFile(path.join(preserved, "foreign.txt"))).toEqual(foreign);
    await expect(lstat(output)).resolves.toMatchObject({});
  }, 15_000);

  it.each([
    {
      name: "a claimed directory is replaced",
      hooks: {
        afterStagingCleanupEntryClaimed: async ({
          claimedPath,
          relativePath,
          stagingClaim,
        }) => {
          if (relativePath !== "reports") return;
          await rename(claimedPath, `${stagingClaim}-displaced-reports`);
          await mkdir(claimedPath);
          await writeFile(
            path.join(claimedPath, "foreign.txt"),
            "FOREIGN-SENTINEL\n",
          );
        },
      },
    },
    {
      name: "a verified file is replaced by the same bytes on another inode",
      hooks: {
        afterStagingCleanupEntryVerified: async ({
          claimedPath,
          relativePath,
          stagingClaim,
        }) => {
          if (relativePath !== "delivery.zip") return;
          const bytes = await readFile(claimedPath);
          await rename(claimedPath, `${stagingClaim}-displaced-delivery.zip`);
          await writeFile(claimedPath, bytes);
          await writeFile(
            path.join(stagingClaim, "FOREIGN-SENTINEL.txt"),
            "FOREIGN-SENTINEL\n",
          );
        },
      },
    },
    {
      name: "an unknown entry appears after inventory verification",
      hooks: {
        afterStagingInventoryVerified: async ({ stagingClaim }) => {
          await writeFile(
            path.join(stagingClaim, "FOREIGN-SENTINEL.txt"),
            "FOREIGN-SENTINEL\n",
          );
        },
      },
    },
  ])(
    "retains and reports staging when $name",
    async ({ hooks }) => {
      const project = await prepareProject();
      const output = path.join(
        temporaryRoot,
        "owned-cleanup.zip",
      );

      const packaged = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        output,
      ], {
        transactionHooks: hooks,
      });

      expect(packaged.exitCode).toBe(3);
      expect(packaged.result.issues[0].details).toMatchObject({
        error_code: "E_PACKAGE_STAGING_DRIFT",
      });
      const recoveryPath = packaged.result.data.recovery_paths[0];
      expect(recoveryPath).toBeDefined();
      expect(await treeContainsText(recoveryPath, "FOREIGN-SENTINEL"))
        .toBe(true);
      await expect(lstat(output)).resolves.toMatchObject({});
    },
    15_000,
  );

  it("cleans staging and restores all outputs at every injected package boundary", async () => {
    const project = await prepareProject();
    const manifestBefore = await readFile(path.join(project, "fde-project.yaml"));
    for (const failAt of [
      "scan",
      "render",
      "zip-write",
      "zip-verify",
      "reverse-manifest",
      "commit-manifest",
      "commit-report",
      "commit-zip",
    ]) {
      const output = path.join(temporaryRoot, `${failAt}.zip`);
      const result = await invoke([
        project,
        "--confirm-personal-data",
        "--output",
        output,
      ], {
        failAt,
        clock: () => new Date("2026-07-24T01:00:00.000Z"),
      });
      expect(result.exitCode, failAt).toBe(3);
      expect(await readFile(path.join(project, "fde-project.yaml")))
        .toEqual(manifestBefore);
      await expect(lstat(
        path.join(project, "reports/package-validation.json"),
      )).rejects.toMatchObject({ code: "ENOENT" });
      await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
      expect(
        (await readdir(temporaryRoot)).filter((name) =>
          name.startsWith(".aiworker-package-") ||
          name.startsWith(".tmp-")),
        failAt,
      ).toEqual([]);
    }
  }, 30_000);

  it("never overwrites an archive created after the initial existence check", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "raced.zip");
    const foreign = Buffer.from("foreign archive\n");
    const manifestBefore = await readFile(path.join(project, "fde-project.yaml"));
    const result = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
      transactionHooks: {
        beforeTarget: async ({ failAt }) => {
          if (failAt === "commit-zip") {
            await writeFile(output, foreign, { flag: "wx" });
          }
        },
      },
    });
    expect(result.exitCode).toBe(3);
    expect(await readFile(output)).toEqual(foreign);
    expect(await readFile(path.join(project, "fde-project.yaml")))
      .toEqual(manifestBefore);
    await expect(lstat(
      path.join(project, "reports/package-validation.json"),
    )).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves a report created concurrently with the package transaction", async () => {
    const project = await prepareProject();
    const output = path.join(temporaryRoot, "report-race.zip");
    const reportPath = path.join(project, "reports/package-validation.json");
    const foreign = Buffer.from('{"foreign":true}\n');
    const manifestBefore = await readFile(path.join(project, "fde-project.yaml"));
    const result = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
      transactionHooks: {
        beforeTarget: async ({ failAt }) => {
          if (failAt === "commit-report") {
            await writeFile(reportPath, foreign, { flag: "wx" });
          }
        },
      },
    });
    expect(result.exitCode).toBe(3);
    expect(await readFile(reportPath)).toEqual(foreign);
    expect(await readFile(path.join(project, "fde-project.yaml")))
      .toEqual(manifestBefore);
    await expect(lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("binds explicitly included source bytes into the package input key", async () => {
    const project = await prepareProject();
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(project, "inputs/source-files"), {
      recursive: true,
    });
    const sourcePath = path.join(project, "inputs/source-files/brief.txt");
    await writeFile(sourcePath, "first sanitized brief\n");
    const first = await invoke([
      project,
      "--include-sources",
      "--confirm-source-risk",
      "--confirm-personal-data",
      "--output",
      path.join(temporaryRoot, "source-first.zip"),
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(first.exitCode).toBe(0);
    const firstRevision = first.result.data.baseline_revision;
    await writeFile(sourcePath, "second sanitized brief\n");
    const second = await invoke([
      project,
      "--include-sources",
      "--confirm-source-risk",
      "--confirm-personal-data",
      "--output",
      path.join(temporaryRoot, "source-second.zip"),
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(second.exitCode).toBe(0);
    expect(second.result.data.package_input_hash)
      .not.toBe(first.result.data.package_input_hash);
    expect(second.result.data.baseline_revision).toBe(firstRevision + 1);
    const third = await invoke([
      project,
      "--include-sources",
      "--confirm-source-risk",
      "--confirm-personal-data",
      "--output",
      path.join(temporaryRoot, "source-third.zip"),
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(third.exitCode).toBe(0);
    expect(third.result.data.baseline_revision)
      .toBe(second.result.data.baseline_revision);
  }, 15_000);

  it("redacts file-source paths only in staging and preserves the customer original", async () => {
    const project = await prepareProject();
    const originalPath = ["/Us", "ers/fde/customer/private-brief.txt"].join("");
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.sources = [{
      id: "source.requirements_conversation",
      title: "需求文件",
      kind: "file",
      source_mode: "copy",
      status: "readable",
      portable: true,
      original_path: originalPath,
      copy_path: "inputs/source-files/private-brief.txt",
      sha256: "a".repeat(64),
      media_type: "text/plain",
      read_status: "read",
      copied_at: "2026-07-24T01:00:00Z",
    }];
    await writeFile(manifestPath, stringify(manifest, { lineWidth: 0 }));
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(project, "inputs/source-files"), {
      recursive: true,
    });
    await writeFile(
      path.join(project, "inputs/source-files/private-brief.txt"),
      "brief\n",
    );
    const output = path.join(temporaryRoot, "redacted.zip");
    const packaged = await invoke([
      project,
      "--confirm-personal-data",
      "--output",
      output,
    ], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
    });
    expect(packaged.exitCode, JSON.stringify(packaged.result.issues)).toBe(0);
    const customer = parse(await readFile(manifestPath, "utf8"));
    expect(customer.sources[0].original_path)
      .toBe(originalPath);
    const entries = await readZipEntries(output);
    const delivered = parse(entries.find(
      ({ path: entryPath }) => entryPath === "fde-project.yaml",
    ).bytes.toString("utf8"));
    expect(delivered.sources[0].original_path).toBe("redacted://source/0");
  }, 15_000);
});

async function treeContainsText(root, expectedText) {
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const metadata = await lstat(current);
    if (metadata.isDirectory()) {
      for (const child of await readdir(current)) {
        pending.push(path.join(current, child));
      }
    } else if (
      metadata.isFile() &&
      (await readFile(current)).includes(Buffer.from(expectedText))
    ) {
      return true;
    }
  }
  return false;
}
