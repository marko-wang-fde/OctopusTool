import { execFile } from "node:child_process";
import {
  chmod,
  cp,
  link,
  lstat,
  mkdtemp,
  mkdir,
  open as fsOpen,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";

import { main } from "../../src/commands/validate-project.js";
import { main as installMain } from "../../src/commands/install.js";
import { main as renderDryrunMain } from "../../src/commands/render-dryrun-script.js";
import {
  validateProjectDirectory,
} from "../../src/contracts/project-validator.js";
import {
  writeValidationTransaction,
} from "../../src/project/validation-report.js";
import {
  canonicalBytes,
  normalizeMarkdown,
  sha256Bytes,
} from "../../src/shared/canonical.js";
import {
  selectDeliveryFiles,
} from "../../src/delivery/file-selection.js";
import {
  createPackageManifest,
} from "../../src/delivery/package-manifest.js";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, "../..");
const TEMPLATE = path.join(ROOT, "assets/project-template");
const SCRIPT = path.join(ROOT, "scripts/validate-project");
const DELIVERY_EXACT = new Set([
  "fde-project.yaml",
  "assembly/operations.yaml",
  "assembly/octopus-cli-assemble.sh",
  "delivery-summary.md",
]);
const DELIVERY_PREFIXES = [
  "discovery/",
  "design/",
  "employees/",
  "skills/",
  "arcubase/",
  "assembly/payloads/",
  "acceptance/",
];

async function projectFixture() {
  const parent = await mkdtemp(path.join(tmpdir(), "fde-validate-"));
  const project = path.join(parent, "project");
  await cp(TEMPLATE, project, { recursive: true });
  return project;
}

async function deliveryFiles(project, relativeDirectory = "") {
  const directory = path.join(project, relativeDirectory);
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      found.push(...await deliveryFiles(project, relativePath));
    } else if (
      entry.isFile() &&
      (
        DELIVERY_EXACT.has(relativePath) ||
        DELIVERY_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
      )
    ) {
      found.push(relativePath);
    }
  }
  return found.sort((left, right) =>
    Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

function canonicalDeliveryBytes(relativePath, bytes) {
  if (relativePath === "fde-project.yaml") {
    const value = parse(bytes.toString("utf8"));
    delete value.project.status;
    delete value.stage_status.validate;
    return canonicalBytes(value);
  }
  if (relativePath === "assembly/operations.yaml") {
    const value = parse(bytes.toString("utf8"));
    return canonicalBytes(value);
  }
  if (relativePath.endsWith(".yaml") || relativePath.endsWith(".yml")) {
    return canonicalBytes(parse(bytes.toString("utf8")));
  }
  if (relativePath.endsWith(".json")) {
    return canonicalBytes(JSON.parse(bytes.toString("utf8")));
  }
  if (relativePath.endsWith(".md")) {
    return Buffer.from(normalizeMarkdown(bytes.toString("utf8")), "utf8");
  }
  return bytes;
}

async function writeAuthoritativePackageEvidence(project, overrides = {}) {
  const manifest = parse(
    await readFile(path.join(project, "fde-project.yaml"), "utf8"),
  );
  const policy = overrides.policy ?? {
    schema_version: 1,
    exceptions: [],
  };
  await writeFile(
    path.join(project, "reports/package-scan-policy.yaml"),
    stringify(policy),
  );
  const paths = await deliveryFiles(project);
  const records = [];
  for (const relativePath of paths) {
    const bytes = await readFile(path.join(project, relativePath));
    records.push(
      Buffer.from(
        `${relativePath}\0${sha256Bytes(
          canonicalDeliveryBytes(relativePath, bytes),
        )}\n`,
        "utf8",
      ),
    );
  }
  const packageInputHash =
    overrides.packageInputHash ?? sha256Bytes(Buffer.concat(records));
  const { stdout: kitCommit } = await execFileAsync(
    "git",
    ["rev-parse", "HEAD"],
    { cwd: ROOT },
  );
  const report = {
    schema_version: 1,
    status: "passed",
    package_input_hash: packageInputHash,
    scan_policy_hash:
      overrides.scanPolicyHash ?? sha256Bytes(canonicalBytes(policy)),
    kit_commit: overrides.kitCommit ?? kitCommit.trim(),
    validated_at: "2026-07-24T00:00:00.000Z",
    project_slug: manifest.project.slug,
    validation_result: {
      status: "passed",
      blocker_count: 0,
      redactions: [],
    },
  };
  await writeFile(
    path.join(project, "reports/package-validation.json"),
    `${JSON.stringify(report)}\n`,
  );
  const selected = await selectDeliveryFiles(project);
  selected.files.delete(".gitignore");
  selected.files.delete("reports/validation-report.json");
  selected.files.delete("reports/validation-report.md");
  const packageManifest = createPackageManifest(selected.files, {
    packageInputHash,
    packagedAt: "2026-07-24T01:00:00.000Z",
    projectSlug: manifest.project.slug,
    sourcesIncluded: false,
  });
  const entries = packageManifest.files;
  packageManifest.files = overrides.files ?? entries;
  await writeFile(
    path.join(project, "package-manifest.json"),
    `${JSON.stringify(packageManifest)}\n`,
  );
  return { entries, packageInputHash, report };
}

function arcubaseFixture() {
  return {
    schema_version: 1,
    mode: "new",
    app: {
      id: "app.leads",
      name: "Leads",
      ownership: "customer",
      isolation_boundary: "dedicated",
    },
    tables: [{
      id: "table.leads",
      key: "leads",
      name: "Leads",
      fields: [{
        id: "field.name",
        key: "name",
        name: "Name",
        type: "text",
        required: true,
        select_options: [],
        link: null,
        states: [],
        derived: null,
      }],
    }],
    access_policies: [],
  };
}

async function run(args) {
  try {
    const { stdout } = await execFileAsync(SCRIPT, args);
    return { code: 0, result: JSON.parse(stdout) };
  } catch (error) {
    return {
      code: error.code,
      result: JSON.parse(error.stdout),
    };
  }
}

describe("validate-project command", () => {
  it("documents an exact positional CLI with no caller-controlled hash list", async () => {
    const help = await run(["--help"]);
    expect(help.code).toBe(0);
    expect(help.result.data.usage).toBe(
      "Usage: validate-project <absolute-project-dir> " +
      "[--accept-stage <stage-id>] " +
      "[--cli-fixture-dir <absolute-dir> | --cli-path <absolute-binary>] " +
      "[--run-assembly --profile <name> --team <id>]",
    );

    const project = await projectFixture();
    const invalid = await run([project, "--hash-path", "design/team-design.md"]);
    expect(invalid.code).toBe(2);
    expect(invalid.result.issues[0].code).toBe("B_ARGUMENT_UNKNOWN");
    const report = JSON.parse(
      await readFile(path.join(project, "reports/validation-report.json"), "utf8"),
    );
    expect(report.exit_code).toBe(2);
    expect(report.command).toBe("validate-project");
  });

  it("catalogs exactly seven authoritative stages and all contract keys", async () => {
    const catalog = parse(
      await readFile(path.join(ROOT, "catalog/stage-artifacts.yaml"), "utf8"),
    );
    expect(catalog.schema_version).toBe(1);
    expect(catalog.stages.map(({ id }) => id)).toEqual([
      "initialize",
      "discover",
      "team-design",
      "foundation-design",
      "author",
      "assemble",
      "validate",
    ]);
    for (const stage of catalog.stages) {
      expect(Object.keys(stage).sort()).toEqual([
        "approval_field",
        "depends_on",
        "id",
        "required_inputs",
        "required_outputs",
      ]);
    }
    expect(catalog.stages).toEqual([
      {
        id: "initialize",
        depends_on: [],
        required_inputs: [],
        required_outputs: ["inputs/input-inventory.md"],
        approval_field: "stage_status.initialize.approved_at",
      },
      {
        id: "discover",
        depends_on: ["initialize"],
        required_inputs: ["inputs/input-inventory.md"],
        required_outputs: [
          "discovery/facts-and-assumptions.md",
          "discovery/open-questions.md",
          "discovery/scenario-model.md",
        ],
        approval_field: "stage_status.discover.approved_at",
      },
      {
        id: "team-design",
        depends_on: ["discover"],
        required_inputs: [
          "discovery/facts-and-assumptions.md",
          "discovery/scenario-model.md",
        ],
        required_outputs: [
          "design/team-design.md",
          "design/collaboration-and-dataflow.md",
          {
            path: "design/external-station.md",
            condition: "station-required",
          },
        ],
        approval_field: "stage_status.team-design.approved_at",
      },
      {
        id: "foundation-design",
        depends_on: ["team-design"],
        required_inputs: [
          "design/team-design.md",
          "design/collaboration-and-dataflow.md",
        ],
        required_outputs: [
          "design/platform-capability-selection.md",
          "design/data-foundation.md",
          "design/identity-and-access.md",
          "arcubase/decision.yaml",
          {
            path: "arcubase/schema.yaml",
            condition: "arcubase-required",
          },
          {
            path: "arcubase/access-matrix.md",
            condition: "arcubase-access-required",
          },
          {
            path: "design/taskboard.md",
            condition: "taskboard-required",
          },
          {
            path: "design/browser-webskill.md",
            condition: "browser-webskill-required",
          },
        ],
        approval_field: null,
      },
      {
        id: "author",
        depends_on: ["foundation-design"],
        required_inputs: [
          "design/platform-capability-selection.md",
          "design/data-foundation.md",
          "design/identity-and-access.md",
          "arcubase/decision.yaml",
        ],
        required_outputs: ["employees/**/*.md", "skills/**/SKILL.md"],
        approval_field: null,
      },
      {
        id: "assemble",
        depends_on: ["author"],
        required_inputs: ["employees/**/*.md", "skills/**/SKILL.md"],
        required_outputs: [
          "assembly/assembly-plan.md",
          "assembly/operations.yaml",
          "acceptance/acceptance-plan.md",
          "acceptance/test-cases.yaml",
          {
            path: "assembly/octopus-cli-assemble.sh",
            condition: "assembly-script-required",
          },
        ],
        approval_field: null,
      },
      {
        id: "validate",
        depends_on: ["assemble"],
        required_inputs: [
          "assembly/operations.yaml",
          "acceptance/test-cases.yaml",
        ],
        required_outputs: ["reports/package-validation.json"],
        approval_field: null,
      },
    ]);
  });

  it("returns 0 for a readable valid project and synchronizes JSON/Markdown reports", async () => {
    const project = await projectFixture();
    const execution = await run([project]);
    expect(execution.code, JSON.stringify(execution.result)).toBe(0);
    const json = JSON.parse(
      await readFile(path.join(project, "reports/validation-report.json"), "utf8"),
    );
    const markdown = await readFile(
      path.join(project, "reports/validation-report.md"),
      "utf8",
    );
    expect(json.report_id).toMatch(/^[a-f0-9]{64}$/u);
    expect(markdown).toContain(`Report ID: \`${json.report_id}\``);
    expect(markdown).toContain(`Exit code: \`${json.exit_code}\``);
  });

  it.each([
    ["damaged YAML", "schema_version: [", "B_PROJECT_PARSE"],
    ["unknown schema", "schema_version: 999\n", "B_PROJECT_SCHEMA"],
  ])("returns 1 and a report for %s", async (_name, manifestText, expected) => {
    const project = await projectFixture();
    await writeFile(path.join(project, "fde-project.yaml"), manifestText);
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(expected);
    await expect(
      readFile(path.join(project, "reports/validation-report.json"), "utf8"),
    ).resolves.toContain(expected);
  });

  it("reports a schema-invalid manifest during stage acceptance", async () => {
    const project = await projectFixture();
    await writeFile(
      path.join(project, "fde-project.yaml"),
      "schema_version: 999\n",
    );
    const execution = await run([project, "--accept-stage", "initialize"]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PROJECT_SCHEMA",
    );
    const report = JSON.parse(
      await readFile(
        path.join(project, "reports/validation-report.json"),
        "utf8",
      ),
    );
    expect(report.failed_stage).toBe("initialize");
    expect(report.exit_code).toBe(1);
  });

  it("maps a readable but invalid external contract to exit 1", async () => {
    const project = await projectFixture();
    await writeFile(
      path.join(project, "acceptance/test-cases.yaml"),
      "schema_version: 1\n",
    );
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PROJECT_SCHEMA",
    );
  });

  it("keeps accepted early stages reviewable when acceptance data is invalid", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    for (const stage of ["initialize", "discover", "team-design"]) {
      manifest.stage_status[stage].approved_at =
        "2026-07-24T00:00:00.000Z";
    }
    await writeFile(manifestPath, stringify(manifest));
    for (const stage of ["initialize", "discover", "team-design"]) {
      expect((await run([project, "--accept-stage", stage])).code).toBe(0);
    }
    await writeFile(
      path.join(project, "acceptance/test-cases.yaml"),
      "schema_version: 1\ncases: invalid\n",
    );
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.data.stage_states.initialize).toBe("complete");
    expect(execution.result.data.stage_states.discover).toBe("complete");
    expect(execution.result.data.stage_states["team-design"]).toBe("complete");
    expect(execution.result.data.stage_states.assemble).not.toBe("complete");
    expect(execution.result.data.project_status).toBe("reviewable");
  });

  it("safely parses the conditional Arcubase schema artifact", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.data_foundation = arcubaseFixture();
    await writeFile(manifestPath, stringify(manifest));
    await writeFile(
      path.join(project, "arcubase/decision.yaml"),
      stringify(manifest.data_foundation),
    );
    await writeFile(path.join(project, "arcubase/schema.yaml"), "bad: [\n");
    await writeFile(path.join(project, "arcubase/access-matrix.md"), "# access\n");
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PROJECT_PARSE",
    );
  });

  it.each([
    ["not JSON", "not-json\n"],
    ["forged", "{\"schema_version\":1,\"status\":\"passed\"}\n"],
    [
      "failed",
      `${JSON.stringify({
        schema_version: 1,
        status: "failed",
        package_input_hash: "a".repeat(64),
        scan_policy_hash: "b".repeat(64),
        kit_commit: "deadbeef",
        validated_at: "2026-07-24T00:00:00.000Z",
        project_slug: "pending-fde-project",
      })}\n`,
    ],
  ])("rejects %s package validation evidence", async (_name, reportText) => {
    const project = await projectFixture();
    await writeFile(
      path.join(project, "reports/package-validation.json"),
      reportText,
    );
    await writeFile(
      path.join(project, "package-manifest.json"),
      `${JSON.stringify({
        schema_version: 1,
        self_entry: "excluded",
        project_slug: "pending-fde-project",
        package_input_hash: "a".repeat(64),
        files: [],
      })}\n`,
    );
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
    expect(execution.result.data.stage_states.validate).not.toBe("complete");
  });

  it("rejects an empty package manifest even when its report is bound", async () => {
    const project = await projectFixture();
    const manifest = parse(
      await readFile(path.join(project, "fde-project.yaml"), "utf8"),
    );
    const packageManifestText = `${JSON.stringify({
      schema_version: 1,
      self_entry: "excluded",
      project_slug: manifest.project.slug,
      package_input_hash: "a".repeat(64),
      files: [],
    })}\n`;
    await writeFile(
      path.join(project, "package-manifest.json"),
      packageManifestText,
    );
    await writeFile(
      path.join(project, "reports/package-validation.json"),
      `${JSON.stringify({
        schema_version: 1,
        status: "passed",
        package_input_hash: "a".repeat(64),
        scan_policy_hash: "b".repeat(64),
        kit_commit: "deadbeef",
        validated_at: "2026-07-24T00:00:00.000Z",
        project_slug: manifest.project.slug,
      })}\n`,
    );
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it("rejects forged evidence that lists only delivery-summary with arbitrary hashes", async () => {
    const project = await projectFixture();
    const manifest = parse(
      await readFile(path.join(project, "fde-project.yaml"), "utf8"),
    );
    const summary = await readFile(path.join(project, "delivery-summary.md"));
    const packageManifestText = `${JSON.stringify({
      schema_version: 1,
      self_entry: "excluded",
      project_slug: manifest.project.slug,
      package_input_hash: "a".repeat(64),
      files: [{
        path: "delivery-summary.md",
        type: "file",
        mode: "0644",
        sha256: sha256Bytes(summary),
        classification: "delivery",
      }],
    })}\n`;
    await writeFile(
      path.join(project, "package-manifest.json"),
      packageManifestText,
    );
    await writeFile(
      path.join(project, "reports/package-validation.json"),
      `${JSON.stringify({
        schema_version: 1,
        status: "passed",
        package_input_hash: "a".repeat(64),
        scan_policy_hash: "b".repeat(64),
        kit_commit: "deadbeef",
        validated_at: "2026-07-24T00:00:00.000Z",
        project_slug: manifest.project.slug,
      })}\n`,
    );
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it.each([
    ["package input", { packageInputHash: "a".repeat(64) }],
    ["scan policy", { scanPolicyHash: "b".repeat(64) }],
    ["Kit commit", { kitCommit: "c".repeat(40) }],
  ])("recomputes the authoritative %s binding", async (_name, overrides) => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project, overrides);
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it("accepts only a clean, exact installed-copy manifest as Kit commit authority", async () => {
    const project = await projectFixture();
    const installRoot = path.dirname(project);
    const home = path.join(installRoot, "home");
    const xdg = path.join(installRoot, "xdg");
    const kitCommit = "a".repeat(40);
    const installChunks = [];
    const installExit = await installMain([
      "--target",
      "codex",
      "--mode",
      "copy",
    ], {
      env: { HOME: home, XDG_CONFIG_HOME: xdg },
      sourceMetadata: {
        source_commit: kitCommit,
        source_dirty: false,
        issues: [],
        runGit: async () => ({ stdout: "" }),
      },
      sourceRoot: ROOT,
      writeStdout: (chunk) => installChunks.push(chunk),
    });
    expect(installExit, installChunks.join("")).toBe(0);
    const installed = path.join(
      home,
      ".agents/skills/design-aiworker-solutions",
    );
    const manifestPath = path.join(
      xdg,
      "aiworker-fde-kit/installations/codex.json",
    );
    const originalManifest = await readFile(manifestPath, "utf8");
    await writeAuthoritativePackageEvidence(project, { kitCommit });

    const validateInstalled = () => validateProjectDirectory(project, {
      kitRoot: installed,
      env: { HOME: home, XDG_CONFIG_HOME: xdg },
    });
    const clean = await validateInstalled();
    expect(clean.issues.map(({ code }) => code))
      .not.toContain("B_PACKAGE_EVIDENCE_INVALID");

    await mkdir(path.join(installed, ".git"));
    await writeFile(path.join(installed, ".git/HEAD"), `${kitCommit}\n`);
    const injectedCheckout = await validateInstalled();
    expect(injectedCheckout.issues.map(({ code }) => code))
      .toContain("B_PACKAGE_EVIDENCE_INVALID");
    const dirtyManifest = {
      ...JSON.parse(originalManifest),
      source_dirty: true,
    };
    await writeFile(manifestPath, `${JSON.stringify(dirtyManifest)}\n`);
    const invalidManifestWithGit = await validateInstalled();
    expect(invalidManifestWithGit.issues.map(({ code }) => code))
      .toContain("B_PACKAGE_EVIDENCE_INVALID");
    await rm(path.join(installed, ".git"), { recursive: true });

    for (const mutate of [
      (manifest) => ({ ...manifest, source_dirty: true }),
      (manifest) => ({ ...manifest, source_commit: null }),
      (manifest) => ({ ...manifest, target_path: path.join(home, "other") }),
      (manifest) => ({ ...manifest, mode: "symlink" }),
      (manifest) => ({ ...manifest, source_tree_hash: "0".repeat(64) }),
    ]) {
      const manifest = mutate(JSON.parse(originalManifest));
      await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
      const rejected = await validateInstalled();
      expect(rejected.issues.map(({ code }) => code))
        .toContain("B_PACKAGE_EVIDENCE_INVALID");
    }

    await writeFile(manifestPath, originalManifest);
    const skillPath = path.join(installed, "SKILL.md");
    const originalSkill = await readFile(skillPath);
    await writeFile(skillPath, Buffer.concat([originalSkill, Buffer.from("\n")]));
    const changedSnapshot = await validateInstalled();
    expect(changedSnapshot.issues.map(({ code }) => code))
      .toContain("B_PACKAGE_EVIDENCE_INVALID");

    await writeFile(skillPath, originalSkill);
    const displaced = `${installed}-displaced`;
    await rename(installed, displaced);
    await symlink(displaced, installed);
    const replacedTarget = await validateInstalled();
    expect(replacedTarget.issues.map(({ code }) => code))
      .toContain("B_PACKAGE_EVIDENCE_INVALID");
  }, 30_000);

  it.each([
    ["packaged_at", (value) => {
      value.packaged_at = "2026-07-24T01:00:00.000Z";
    }],
    ["top-level extension", (value) => { value.unknown = true; }],
    ["validation-result extension", (value) => {
      value.validation_result.unknown = true;
    }],
    ["result extension", (value) => {
      value.validation_result.results = [{
        severity: "WARNING",
        status: "passed",
        unknown: true,
      }];
    }],
    ["date-only validated_at", (value) => {
      value.validated_at = "2026-07-24";
    }],
    ["offset validated_at", (value) => {
      value.validated_at = "2026-07-24T08:00:00+08:00";
    }],
    ["normalizable validated_at", (value) => {
      value.validated_at = "2026-07-24T00:00:00Z";
    }],
  ])("rejects package report %s", async (_name, mutate) => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project);
    const reportPath = path.join(project, "reports/package-validation.json");
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    mutate(report);
    await writeFile(reportPath, `${JSON.stringify(report)}\n`);

    const execution = await run([project]);

    expect(execution.result.issues).toContainEqual(expect.objectContaining({
      code: "B_PACKAGE_EVIDENCE_INVALID",
      path: "reports/package-validation.json",
    }));
  });

  it.each([
    ["manifest", true, false],
    ["operations", false, true],
  ])("invalidates package evidence when the %s assembly execution contract changes", async (
    _name,
    mutateManifest,
    mutateOperations,
  ) => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const operationsPath = path.join(project, "assembly/operations.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    const operations = parse(await readFile(operationsPath, "utf8"));
    if (mutateManifest) {
      manifest.assembly.assembly_execution.status = "not-generated";
    }
    if (mutateOperations) {
      operations.assembly_execution.status = "not-generated";
    }
    await writeFile(manifestPath, stringify(manifest));
    await writeFile(operationsPath, stringify(operations));

    const execution = await run([project]);

    expect(execution.result.issues).toContainEqual(expect.objectContaining({
      code: "B_PACKAGE_EVIDENCE_INVALID",
      path: "reports/package-validation.json",
    }));
  });

  it("blocks package evidence when its scan policy authority is absent", async () => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project);
    await rm(path.join(project, "reports/package-scan-policy.yaml"));
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it("rejects an unscoped scan-policy regex instead of trusting its hash", async () => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project, {
      policy: {
        schema_version: 1,
        exceptions: [{
          pattern: ".*",
          reason: "broad bypass",
        }],
      },
    });
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it.each([
    ["type", { type: "directory" }],
    ["mode", { mode: "0777" }],
  ])("rejects package manifest %s drift", async (_name, change) => {
    const project = await projectFixture();
    const evidence = await writeAuthoritativePackageEvidence(project);
    const files = structuredClone(evidence.entries);
    Object.assign(files[0], change);
    await writeAuthoritativePackageEvidence(project, { files });
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it.each([
    ["missing packaged_at", (value) => { delete value.packaged_at; }],
    ["non-UTC packaged_at", (value) => {
      value.packaged_at = "2026-07-24T09:00:00+08:00";
    }],
    ["top-level extension", (value) => { value.unknown = true; }],
    ["entry extension", (value) => { value.files[0].unknown = true; }],
  ])("rejects package manifest %s", async (_name, mutate) => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project);
    const manifestPath = path.join(project, "package-manifest.json");
    const packageManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    mutate(packageManifest);
    await writeFile(manifestPath, `${JSON.stringify(packageManifest)}\n`);

    const execution = await run([project]);

    expect(execution.result.issues).toContainEqual(expect.objectContaining({
      code: "B_PACKAGE_EVIDENCE_INVALID",
      path: expect.stringMatching(/^package-manifest\.json/u),
    }));
  });

  it("reports a malformed package entry as a project blocker", async () => {
    const project = await projectFixture();
    await writeAuthoritativePackageEvidence(project, { files: [null] });
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it.each([
    [
      "duplicate path",
      (entries) => [entries[0], entries[0], ...entries.slice(1)],
    ],
    [
      "escaping path",
      (entries) => [
        { ...entries[0], path: "../escape.md" },
        ...entries.slice(1),
      ],
    ],
    [
      "excluded ZIP",
      (entries) => [
        ...entries,
        {
          path: "delivery/old.zip",
          type: "file",
          mode: "0644",
          sha256: "a".repeat(64),
          classification: "delivery",
        },
      ],
    ],
  ])("rejects a manifest with a %s entry", async (_name, mutate) => {
    const project = await projectFixture();
    const evidence = await writeAuthoritativePackageEvidence(project);
    await writeAuthoritativePackageEvidence(project, {
      files: mutate(structuredClone(evidence.entries)),
    });
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PACKAGE_EVIDENCE_INVALID",
    );
  });

  it("does not complete validate before package evidence exists", async () => {
    const project = await projectFixture();
    const execution = await run([project]);
    expect(execution.result.data.stage_states.validate).not.toBe("complete");
    expect(execution.result.data.project_status).not.toBe("delivery-ready");
  });

  it("rejects a manually promoted project status", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.project.status = "delivery-ready";
    await writeFile(manifestPath, stringify(manifest));
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_PROJECT_STATUS_DRIFT",
    );
  });

  it("compares synchronized YAML documents semantically, not by key order", async () => {
    const project = await projectFixture();
    const assembly = parse(
      await readFile(path.join(project, "assembly/operations.yaml"), "utf8"),
    );
    const reordered = Object.fromEntries(Object.entries(assembly).reverse());
    await writeFile(
      path.join(project, "assembly/operations.yaml"),
      stringify(reordered),
    );
    expect((await run([project])).code).toBe(0);
  });

  it("rejects unknown stages with exit 2 and no writes", async () => {
    const project = await projectFixture();
    const before = await readFile(path.join(project, "fde-project.yaml"));
    const execution = await run([project, "--accept-stage", "unknown"]);
    expect(execution.code).toBe(2);
    await expect(readFile(path.join(project, "fde-project.yaml"))).resolves
      .toEqual(before);
  });

  it("failed acceptance leaves manifest and business artifacts unchanged but writes recovery report", async () => {
    const project = await projectFixture();
    const beforeManifest = await readFile(path.join(project, "fde-project.yaml"));
    const beforeBusiness = await readFile(
      path.join(project, "discovery/scenario-model.md"),
    );
    const execution = await run([project, "--accept-stage", "discover"]);
    expect(execution.code).toBe(1);
    await expect(
      readFile(path.join(project, "fde-project.yaml")),
    ).resolves.toEqual(beforeManifest);
    await expect(
      readFile(path.join(project, "discovery/scenario-model.md"),
    )).resolves.toEqual(beforeBusiness);
    const report = JSON.parse(
      await readFile(path.join(project, "reports/validation-report.json"), "utf8"),
    );
    expect(report.command).toBe("validate-project --accept-stage discover");
    expect(report.failed_stage).toBe("discover");
    expect(report.exit_code).toBe(1);
    expect(report.recovery).toBeTruthy();
  });

  it("accepts one stage with all authoritative hashes and is idempotent", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    const originalMode = (await stat(manifestPath)).mode & 0o777;

    expect((await run([project, "--accept-stage", "initialize"])).code).toBe(0);
    const accepted = parse(await readFile(manifestPath, "utf8"));
    expect(accepted.stage_status.initialize.status).toBe("complete");
    expect(accepted.stage_status.initialize.baseline_revision).toBe(1);
    expect(Object.keys(accepted.stage_status.initialize.output_hashes).sort())
      .toEqual(expect.arrayContaining(["inputs/input-inventory.md"]));
    expect(accepted.stage_status.discover.status).toBe("stale");
    expect((await stat(manifestPath)).mode & 0o777).toBe(originalMode);

    expect((await run([project, "--accept-stage", "initialize"])).code).toBe(0);
    const repeated = parse(await readFile(manifestPath, "utf8"));
    expect(repeated.stage_status.initialize.baseline_revision).toBe(1);
  });

  it("refuses acceptance when the manifest changes after validation", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const lateBytes = Buffer.from(
      `${await readFile(manifestPath, "utf8")}# late user edit\n`,
      "utf8",
    );
    let stdout = "";

    const code = await main(
      [project, "--accept-stage", "initialize"],
      {
        writeStdout: (value) => { stdout += value; },
        validateProject: async (...args) => {
          const validation = await validateProjectDirectory(...args);
          await writeFile(manifestPath, lateBytes);
          return validation;
        },
      },
    );

    const result = JSON.parse(stdout);
    expect(code).toBe(3);
    expect(result.issues[0].code).toBe("B_REPORT_WRITE");
    expect(result.issues[0].details.error).toMatch(/validation snapshot/iu);
    expect(result.issues[0].details.error_code)
      .toBe("E_VALIDATION_SNAPSHOT_DRIFT");
    expect(result.issues[0].details.drift_paths)
      .toEqual(["fde-project.yaml"]);
    await expect(readFile(manifestPath)).resolves.toEqual(lateBytes);
  });

  it("refuses acceptance when an authoritative artifact changes after validation", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const artifactPath = path.join(project, "inputs/input-inventory.md");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const manifestBefore = await readFile(manifestPath);
    const lateBytes = Buffer.from("# late authoritative edit\n", "utf8");
    let stdout = "";

    const code = await main(
      [project, "--accept-stage", "initialize"],
      {
        writeStdout: (value) => { stdout += value; },
        validateProject: async (...args) => {
          const validation = await validateProjectDirectory(...args);
          await writeFile(artifactPath, lateBytes);
          return validation;
        },
      },
    );

    const result = JSON.parse(stdout);
    expect(code).toBe(3);
    expect(result.issues[0].code).toBe("B_REPORT_WRITE");
    expect(result.issues[0].details.error).toMatch(/validation snapshot/iu);
    expect(result.issues[0].details.error_code)
      .toBe("E_VALIDATION_SNAPSHOT_DRIFT");
    expect(result.issues[0].details.drift_paths)
      .toEqual(["inputs/input-inventory.md"]);
    await expect(readFile(manifestPath)).resolves.toEqual(manifestBefore);
    await expect(readFile(artifactPath)).resolves.toEqual(lateBytes);
  });

  it("refuses acceptance when the manifest changes while report temps are prepared", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const lateBytes = Buffer.from(
      `${await readFile(manifestPath, "utf8")}# edit during temp preparation\n`,
      "utf8",
    );
    let injected = false;
    let stdout = "";

    const code = await main(
      [project, "--accept-stage", "initialize"],
      {
        writeStdout: (value) => { stdout += value; },
        writeReports: (root, result, options) =>
          writeValidationTransaction(root, result, {
            ...options,
            fs: {
              open: async (target, ...args) => {
                const handle = await fsOpen(target, ...args);
                if (
                  target.includes(".validation-report.json.") &&
                  target.endsWith(".tmp") &&
                  !injected
                ) {
                  injected = true;
                  await writeFile(manifestPath, lateBytes);
                }
                return handle;
              },
            },
          }),
      },
    );

    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0].details.error_code)
      .toBe("E_VALIDATION_SNAPSHOT_DRIFT");
    expect(result.issues[0].details.drift_paths)
      .toContain("fde-project.yaml");
    await expect(readFile(manifestPath)).resolves.toEqual(lateBytes);
  });

  it("refuses acceptance when glob members are added while report temps are prepared", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    for (const stage of ["initialize", "discover", "team-design"]) {
      manifest.stage_status[stage].approved_at =
        "2026-07-24T00:00:00.000Z";
    }
    await writeFile(manifestPath, stringify(manifest));
    await mkdir(path.join(project, "employees"));
    await mkdir(path.join(project, "skills/placeholder"), { recursive: true });
    await writeFile(path.join(project, "employees/placeholder.md"), "# Employee\n");
    await writeFile(
      path.join(project, "skills/placeholder/SKILL.md"),
      "# Skill\n",
    );
    for (const stage of [
      "initialize",
      "discover",
      "team-design",
      "foundation-design",
    ]) {
      expect((await run([project, "--accept-stage", stage])).code).toBe(0);
    }
    const lateEmployee = path.join(project, "employees/late.md");
    const lateSkill = path.join(project, "skills/late/SKILL.md");
    let injected = false;
    let stdout = "";

    const code = await main([project, "--accept-stage", "author"], {
      writeStdout: (value) => { stdout += value; },
      writeReports: (root, result, options) =>
        writeValidationTransaction(root, result, {
          ...options,
          fs: {
            open: async (target, ...args) => {
              const handle = await fsOpen(target, ...args);
              if (
                target.includes(".validation-report.json.") &&
                target.endsWith(".tmp") &&
                !injected
              ) {
                injected = true;
                await mkdir(path.dirname(lateSkill));
                await writeFile(lateEmployee, "# Late employee\n");
                await writeFile(lateSkill, "# Late Skill\n");
              }
              return handle;
            },
          },
        }),
    });

    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0].details.error_code)
      .toBe("E_VALIDATION_SNAPSHOT_DRIFT");
    expect(result.issues[0].details.drift_paths).toEqual(
      expect.arrayContaining([
        "employees/late.md",
        "skills/late/SKILL.md",
      ]),
    );
    await expect(readFile(lateEmployee, "utf8")).resolves
      .toBe("# Late employee\n");
    await expect(readFile(lateSkill, "utf8")).resolves.toBe("# Late Skill\n");
  }, 15_000);

  it("repairs a manually promoted status on an idempotent stage acceptance", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    let manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    expect((await run([project, "--accept-stage", "initialize"])).code).toBe(0);

    manifest = parse(await readFile(manifestPath, "utf8"));
    const revision = manifest.stage_status.initialize.baseline_revision;
    manifest.project.status = "delivery-ready";
    await writeFile(manifestPath, stringify(manifest));

    const execution = await run([project, "--accept-stage", "initialize"]);
    expect(execution.code, JSON.stringify(execution.result)).toBe(0);
    expect(execution.result.data.changed).toBe(true);
    manifest = parse(await readFile(manifestPath, "utf8"));
    expect(manifest.project.status).toBe("draft");
    expect(manifest.stage_status.initialize.baseline_revision).toBe(revision);
  });

  it("requires an Arcubase access matrix in existing mode", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    const foundation = arcubaseFixture();
    foundation.mode = "existing";
    foundation.tables = [];
    foundation.access_policies = [];
    manifest.data_foundation = foundation;
    await writeFile(manifestPath, stringify(manifest));
    await writeFile(
      path.join(project, "arcubase/decision.yaml"),
      stringify(foundation),
    );
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues).toContainEqual(
      expect.objectContaining({
        code: "B_ARTIFACT_MISSING",
        path: "arcubase/access-matrix.md",
      }),
    );
    expect(execution.result.data.stage_states["foundation-design"])
      .not.toBe("complete");
  });

  it("refuses a downstream acceptance when a recorded-complete dependency is stale", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    let manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    expect((await run([project, "--accept-stage", "initialize"])).code).toBe(0);

    await writeFile(
      path.join(project, "inputs/input-inventory.md"),
      "# changed after baseline\n",
    );
    manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.discover.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const execution = await run([project, "--accept-stage", "discover"]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues.map(({ code }) => code)).toContain(
      "B_STAGE_DEPENDENCY",
    );
  });

  it("accepts all seven stages and detects later raw package-byte drift", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    const assemblyFixture = path.join(
      ROOT,
      "test/fixtures/assembly/renderable-project/assembly",
    );
    const operations = parse(await readFile(
      path.join(assemblyFixture, "operations.yaml"),
      "utf8",
    ));
    manifest.assembly = operations;
    manifest.workers = [{
      id: "worker.lead_collector",
      name: "Lead Collector",
      responsibility: "Collect approved leads.",
      audience: "Sales",
      skills: ["skill.collect_lead"],
      toolkit_keys: [],
      station_reachable: false,
      prompt_spec: {
        role: "Lead collector",
        objective: "Collect approved leads.",
        boundaries: ["Do not exceed scope."],
        identity_guards: ["Confirm the active team."],
        human_gates: ["Require approval before writes."],
      },
      quick_starts: ["Collect a lead."],
    }];
    manifest.skills = [{
      id: "skill.collect_lead",
      name: "Collect Lead",
      owner_worker: "worker.lead_collector",
      reads: [],
      writes: [],
      toolkit_keys: [],
    }];
    manifest.acceptance_cases = [
      ["normal", "normal"],
      ["refusal", "refusal"],
      ["permission", "permission"],
      ["human-gate", "human_gate"],
    ].map(([category, suffix]) => ({
      id: `acceptance.${suffix}`,
      title: `${category} skill.collect_lead team-private-digiworker.create`,
      category,
      preconditions: [],
      steps: ["Exercise skill.collect_lead and team-private-digiworker.create."],
      expected_results: ["Expected controlled result."],
    }));
    for (const stage of ["initialize", "discover", "team-design"]) {
      manifest.stage_status[stage].approved_at =
        "2026-07-24T00:00:00.000Z";
    }
    await writeFile(manifestPath, stringify(manifest));
    await mkdir(path.join(project, "employees"));
    await mkdir(path.join(project, "skills/collect-lead"), { recursive: true });
    await mkdir(path.join(project, "assembly/payloads"), { recursive: true });
    await writeFile(
      path.join(project, "assembly/operations.yaml"),
      stringify(operations),
    );
    await cp(
      path.join(assemblyFixture, "payloads/example.json"),
      path.join(project, "assembly/payloads/example.json"),
    );
    await writeFile(
      path.join(project, "acceptance/test-cases.yaml"),
      stringify({
        schema_version: 1,
        cases: manifest.acceptance_cases,
      }),
    );
    await writeFile(
      path.join(project, "employees/lead-collector.md"),
      [
        "---",
        "id: worker.lead_collector",
        "skills: [skill.collect_lead]",
        "toolkit_keys: []",
        "prompt_spec:",
        "  role: Lead collector",
        "  objective: Collect approved leads.",
        "  boundaries: [Do not exceed scope.]",
        "  identity_guards: [Confirm the active team.]",
        "  human_gates: [Require approval before writes.]",
        "---",
        "",
        "# Employee",
        "",
      ].join("\n"),
    );
    await writeFile(
      path.join(project, "skills/collect-lead/SKILL.md"),
      "---\nname: collect-lead\n---\n\n# Skill\n",
    );
    let renderOutput = "";
    expect(await renderDryrunMain([
      project,
      "--cli-evidence",
      path.join(ROOT, "test/fixtures/assembly/renderable-cli"),
    ], {
      writeStdout: (value) => { renderOutput += value; },
    }), renderOutput).toBe(0);
    for (const stage of [
      "initialize",
      "discover",
      "team-design",
      "foundation-design",
      "author",
      "assemble",
    ]) {
      const execution = await run([project, "--accept-stage", stage]);
      expect(
        execution.result.issues.map(({ code }) => code),
        stage,
      ).not.toContain("B_PROJECT_STATUS_DRIFT");
      expect(execution.code, stage).toBe(0);
    }
    await writeAuthoritativePackageEvidence(project);
    const execution = await run([project, "--accept-stage", "validate"]);
    expect(execution.result.issues.map(({ code }) => code))
      .not.toContain("B_PROJECT_STATUS_DRIFT");
    expect(execution.code, JSON.stringify(execution.result)).toBe(0);
    expect(
      parse(await readFile(manifestPath, "utf8")).project.status,
    ).toBe("delivery-ready");

    const binary = path.join(path.dirname(project), "octopus-cli");
    await writeFile(binary, "#!/bin/sh\nexit 0\n");
    await chmod(binary, 0o755);
    let executionStdout = "";
    const executionCode = await main([
      project,
      "--cli-path",
      binary,
      "--run-assembly",
      "--profile",
      "fde",
      "--team",
      "team-1",
    ], {
      inspectCli: async ({ output }) => {
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
            versions: {
              npm_package: "0.1.1",
              cli_self_reported: "0.1.0",
            },
          },
        };
      },
      runDryrun: async (invocation) => ({
        exitCode: 0,
        runId: "run-seven-stages",
        diagnostics: [],
        evidence: {
          schema_version: 1,
          run_id: "run-seven-stages",
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
            argv_sha256: sha256Bytes(canonicalBytes([
              "skill",
              "set",
              "create",
              "--body-file",
              "assembly/payloads/example.json",
              "--json",
            ])),
          }],
        },
      }),
      writeStdout: (value) => { executionStdout += value; },
    });
    const executionRun = {
      code: executionCode,
      result: JSON.parse(executionStdout),
    };
    expect(executionRun.code, JSON.stringify(executionRun.result)).toBe(1);
    expect(executionRun.result.issues).toContainEqual(expect.objectContaining({
      code: "B_PACKAGE_EVIDENCE_INVALID",
    }));
    const fresh = await validateProjectDirectory(project);
    expect(fresh.data.project_status).toBe("reviewable");
    expect(fresh.data.stage_states.validate).not.toBe("complete");
  }, 15_000);

  it("maps parameter, inaccessible project and report runtime failures to 2/3", async () => {
    expect((await run([])).code).toBe(2);
    expect((await run(["relative/project"])).code).toBe(2);
    expect((await run([path.join(tmpdir(), "missing-fde-project")])).code).toBe(3);

    let stdout = "";
    const code = await main(["/absolute/project"], {
      writeStdout: (value) => { stdout += value; },
      validateProject: async () => ({
        exitCode: 0,
        issues: [],
        data: { stage_states: {}, project_status: "draft" },
      }),
      writeReports: async () => {
        throw new Error("injected report failure");
      },
    });
    expect(code).toBe(3);
    expect(JSON.parse(stdout).issues[0].code).toBe("B_REPORT_WRITE");
  });

  it("does not damage an old report when report replacement fails", async () => {
    const project = await projectFixture();
    const old = "# old report\n";
    await writeFile(path.join(project, "reports/validation-report.md"), old);
    const code = await main([project], {
      writeStdout: () => {},
      reportFault: "before-commit",
    });
    expect(code).toBe(3);
    expect(
      await readFile(path.join(project, "reports/validation-report.md"), "utf8"),
    ).toBe(old);
  });

  it("rolls both reports back when replacement fails after the first publish", async () => {
    const project = await projectFixture();
    const oldMarkdown = "# old report\n";
    const oldJson = "{\"old\":true}\n";
    await writeFile(
      path.join(project, "reports/validation-report.md"),
      oldMarkdown,
    );
    await writeFile(
      path.join(project, "reports/validation-report.json"),
      oldJson,
    );
    const code = await main([project], {
      writeStdout: () => {},
      reportFault: "after-first-publish",
    });
    expect(code).toBe(3);
    expect(
      await readFile(path.join(project, "reports/validation-report.md"), "utf8"),
    ).toBe(oldMarkdown);
    expect(
      await readFile(path.join(project, "reports/validation-report.json"), "utf8"),
    ).toBe(oldJson);
  });

  it("rolls reports and manifest back when acceptance fails before manifest publish", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    const before = await readFile(manifestPath);
    const code = await main([project, "--accept-stage", "initialize"], {
      writeStdout: () => {},
      reportFault: "before-manifest-publish",
    });
    expect(code).toBe(3);
    await expect(readFile(manifestPath)).resolves.toEqual(before);
  });

  it("aborts an acceptance commit when a design input changes between output boundaries", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const designPath = path.join(project, "design/team-design.md");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const manifestBefore = await readFile(manifestPath);
    let injected = false;
    let stdout = "";

    const code = await main([project, "--accept-stage", "initialize"], {
      writeStdout: (value) => { stdout += value; },
      fs: {
        link: async (source, target) => {
          await link(source, target);
          if (
            target.endsWith("reports/validation-report.json") &&
            !injected
          ) {
            injected = true;
            await writeFile(
              designPath,
              `${await readFile(designPath, "utf8")}\nlate design edit\n`,
            );
          }
        },
      },
    });

    const result = JSON.parse(stdout);
    expect(injected, JSON.stringify(result)).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0]).toMatchObject({
      code: "B_REPORT_WRITE",
      details: { error_code: "E_VALIDATION_SNAPSHOT_DRIFT" },
    });
    expect(result.issues[0].details.drift_paths)
      .toContain("design/team-design.md");
    await expect(readFile(manifestPath)).resolves.toEqual(manifestBefore);
  });

  it("rechecks validation inputs after the final manifest publish", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const designPath = path.join(project, "design/team-design.md");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const manifestBefore = await readFile(manifestPath);
    let injected = false;
    let stdout = "";

    const code = await main([project, "--accept-stage", "initialize"], {
      writeStdout: (value) => { stdout += value; },
      fs: {
        link: async (source, target) => {
          await link(source, target);
          if (target === manifestPath && !injected) {
            injected = true;
            await writeFile(
              designPath,
              `${await readFile(designPath, "utf8")}\nfinal validation edit\n`,
            );
          }
        },
      },
    });

    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0]).toMatchObject({
      code: "B_REPORT_WRITE",
      details: { error_code: "E_VALIDATION_SNAPSHOT_DRIFT" },
    });
    expect(result.issues[0].details.drift_paths)
      .toContain("design/team-design.md");
    await expect(readFile(manifestPath)).resolves.toEqual(manifestBefore);
  });

  it("rechecks validation outputs after the final manifest publish", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const reportPath = path.join(project, "reports/validation-report.json");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const manifestBefore = await readFile(manifestPath);
    const foreign = Buffer.from('{"tampered":true}\n');
    let injected = false;
    let stdout = "";

    const code = await main([project, "--accept-stage", "initialize"], {
      writeStdout: (value) => { stdout += value; },
      fs: {
        link: async (source, target) => {
          await link(source, target);
          if (target === manifestPath && !injected) {
            injected = true;
            await writeFile(reportPath, foreign);
          }
        },
      },
    });

    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0]).toMatchObject({
      code: "B_REPORT_WRITE",
      details: { error_code: "E_VALIDATION_TRANSACTION_DRIFT" },
    });
    const recoveryContents = await Promise.all(
      result.data.recovery_paths.map((candidate) =>
        readFile(candidate).catch(() => null)),
    );
    expect(recoveryContents.some((bytes) => bytes?.equals(foreign))).toBe(true);
    await expect(readFile(manifestPath)).resolves.toEqual(manifestBefore);
  });

  it("does not overwrite a manifest edited in place at the claim boundary", async () => {
    const project = await projectFixture();
    const manifestPath = path.join(project, "fde-project.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8"));
    manifest.stage_status.initialize.approved_at =
      "2026-07-24T00:00:00.000Z";
    await writeFile(manifestPath, stringify(manifest));
    const concurrent = Buffer.from(
      `${stringify(manifest)}# concurrent in-place edit\n`,
      "utf8",
    );
    let injected = false;
    let stdout = "";
    const code = await main(
      [project, "--accept-stage", "initialize"],
      {
        writeStdout: (value) => { stdout += value; },
        fs: {
          rename: async (source, target) => {
            if (
              source === manifestPath &&
              target.includes(".bak") &&
              !injected
            ) {
              injected = true;
              await writeFile(manifestPath, concurrent);
            }
            return rename(source, target);
          },
        },
      },
    );
    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0].code).toBe("B_REPORT_WRITE");
    const candidates = [
      manifestPath,
      ...(result.data.recovery_paths ?? []),
    ];
    const contents = await Promise.all(candidates.map(async (candidate) => {
      try {
        return await readFile(candidate);
      } catch {
        return null;
      }
    }));
    expect(contents.some((bytes) => bytes?.equals(concurrent))).toBe(true);
  });

  it("does not overwrite a report path replaced at the claim boundary", async () => {
    const project = await projectFixture();
    const reportPath = path.join(project, "reports/validation-report.md");
    const concurrent = Buffer.from("# concurrent report replacement\n", "utf8");
    let injected = false;
    let stdout = "";
    const code = await main([project], {
      writeStdout: (value) => { stdout += value; },
      fs: {
        rename: async (source, target) => {
          if (
            source === reportPath &&
            target.includes(".bak") &&
            !injected
          ) {
            injected = true;
            await unlink(reportPath);
            await writeFile(reportPath, concurrent, { flag: "wx" });
          }
          return rename(source, target);
        },
      },
    });
    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0].code).toBe("B_REPORT_WRITE");
    const candidates = [
      reportPath,
      ...(result.data.recovery_paths ?? []),
    ];
    const contents = await Promise.all(candidates.map(async (candidate) => {
      try {
        return await readFile(candidate);
      } catch {
        return null;
      }
    }));
    expect(contents.some((bytes) => bytes?.equals(concurrent))).toBe(true);
  });

  it("propagates deferred report cleanup as a warning and recovery path", async () => {
    const project = await projectFixture();
    const retained = path.join(project, "reports/.retained.bak");
    let stdout = "";
    const code = await main([project], {
      writeStdout: (value) => { stdout += value; },
      validateProject: async () => ({
        exitCode: 0,
        issues: [],
        data: { stage_states: {}, project_status: "draft" },
      }),
      writeReports: async () => ({ cleanupPaths: [retained] }),
    });
    const result = JSON.parse(stdout);
    expect(code).toBe(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        severity: "WARNING",
        code: "W_TRANSACTION_CLEANUP_DEFERRED",
      }),
    );
    expect(result.data.recovery_paths).toContain(retained);
  });

  it("refuses a symlinked reports directory without writing outside the project", async () => {
    const project = await projectFixture();
    const external = path.join(path.dirname(project), "external-reports");
    await mkdir(external);
    await rm(path.join(project, "reports"), { recursive: true });
    await symlink(external, path.join(project, "reports"));
    const execution = await run([project]);
    expect(execution.code).toBe(3);
    await expect(
      readFile(path.join(external, "validation-report.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses a reports directory replaced by a symlink after inspection", async () => {
    const project = await projectFixture();
    const reports = path.join(project, "reports");
    const external = path.join(path.dirname(project), "late-external-reports");
    await mkdir(external);
    let injected = false;
    let stdout = "";

    const code = await main([project], {
      writeStdout: (value) => { stdout += value; },
      writeReports: (root, result, options) =>
        writeValidationTransaction(root, result, {
          ...options,
          fs: {
            lstat: async (target) => {
              const metadata = await lstat(target);
              if (target === reports && !injected) {
                injected = true;
                await rm(reports, { recursive: true });
                await symlink(external, reports);
              }
              return metadata;
            },
          },
        }),
    });

    const result = JSON.parse(stdout);
    expect(injected).toBe(true);
    expect(code).toBe(3);
    expect(result.issues[0].code).toBe("B_REPORT_WRITE");
    await expect(readdir(external)).resolves.toEqual([]);
  });

  it("does not read or write through another cooperative project transaction", async () => {
    const project = await projectFixture();
    const old = "# prior report\n";
    await writeFile(path.join(project, "reports/validation-report.md"), old);
    const lock = path.join(
      path.dirname(project),
      `.${path.basename(project)}.fde-project.yaml.transaction.lock`,
    );
    await writeFile(lock, "{}\n");
    const execution = await run([project]);
    expect(execution.code).toBe(1);
    expect(execution.result.issues[0].code).toBe(
      "B_PROJECT_TRANSACTION_LOCKED",
    );
    expect(
      await readFile(path.join(project, "reports/validation-report.md"), "utf8"),
    ).toBe(old);
  });

  it("reports and safely cleans a marker when lock initialization fails", async () => {
    const project = await projectFixture();
    const lock = path.join(
      path.dirname(project),
      `.${path.basename(project)}.fde-project.yaml.transaction.lock`,
    );
    const injectedOpen = async (...args) => {
      const handle = await fsOpen(...args);
      if (args[0] !== lock) return handle;
      return {
        close: handle.close.bind(handle),
        stat: handle.stat.bind(handle),
        sync: handle.sync.bind(handle),
        writeFile: async () => {
          throw new Error("injected marker write failure");
        },
      };
    };
    let stdout = "";
    const code = await main([project], {
      fs: { open: injectedOpen },
      writeStdout: (value) => { stdout += value; },
    });
    const result = JSON.parse(stdout);
    expect(code).toBe(3);
    expect(result.data.lock_path).toBe(lock);
    expect(result.data.recovery).toBeTruthy();
    await expect(stat(lock)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
