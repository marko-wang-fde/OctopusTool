import {
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

import { main } from "../../src/commands/test-example.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const EXAMPLE = path.join(ROOT, "assets/examples/lead-collector");
const EXPECTED_PACKAGE_PATHS = [
  "acceptance/acceptance-plan.md",
  "acceptance/test-cases.yaml",
  "arcubase/access-matrix.md",
  "arcubase/decision.yaml",
  "arcubase/schema.yaml",
  "assembly/assembly-plan.md",
  "assembly/octopus-cli-assemble.sh",
  "assembly/operations.yaml",
  "assembly/payloads/team-private-digiworker-create.json",
  "delivery-summary.md",
  "design/collaboration-and-dataflow.md",
  "design/data-foundation.md",
  "design/identity-and-access.md",
  "design/platform-capability-selection.md",
  "design/team-design.md",
  "discovery/facts-and-assumptions.md",
  "discovery/open-questions.md",
  "discovery/scenario-model.md",
  "employees/lead-collector.md",
  "fde-project.yaml",
  "inputs/input-inventory.md",
  "package-manifest.json",
  "reports/package-scan-policy.yaml",
  "reports/package-validation.json",
  "skills/collect-sales-leads/SKILL.md",
];
let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-example-test-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
    temporaryParent: temporaryRoot,
  });
  expect(chunks).toHaveLength(1);
  expect(chunks[0].match(/\n/gu)).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function treeSnapshot(root, relativeDirectory = "") {
  const entries = [];
  const directory = relativeDirectory
    ? path.join(root, ...relativeDirectory.split("/"))
    : root;
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) =>
    Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)));
  for (const child of children) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${child.name}`
      : child.name;
    const absolutePath = path.join(directory, child.name);
    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      entries.push({
        path: relativePath,
        type: "symlink",
        mode: metadata.mode & 0o777,
        link_target: await readlink(absolutePath),
      });
    } else if (metadata.isDirectory()) {
      entries.push({ path: relativePath, type: "directory", mode: metadata.mode & 0o777 });
      entries.push(...await treeSnapshot(root, relativePath));
    } else {
      const bytes = await readFile(absolutePath);
      entries.push({
        path: relativePath,
        type: "file",
        mode: metadata.mode & 0o777,
        raw_sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return entries;
}

describe("test-example command boundary", () => {
  it("prints its exact interface and accepts only the fixed example", async () => {
    const help = await invoke(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.result.data.usage).toBe(
      "Usage: test-example --example lead-collector",
    );
    for (const args of [
      [],
      ["--example"],
      ["--example", "unknown"],
      ["--unknown", "lead-collector"],
      ["--example", "lead-collector", "--extra"],
    ]) {
      expect((await invoke(args)).exitCode).toBe(2);
    }
  });

  it("uses only the checked-in fixture, validates exactly 23 files, and cleans its temporary directory", async () => {
    const beforeFixtureTree = await treeSnapshot(EXAMPLE);
    const artifactsPath = path.join(EXAMPLE, "expected-artifacts.yaml");
    const beforeArtifacts = {
      bytes: await readFile(artifactsPath),
      mode: (await lstat(artifactsPath)).mode & 0o777,
    };
    const beforeArtifactsHash = createHash("sha256")
      .update(beforeArtifacts.bytes).digest("hex");
    const projectRoot = path.join(EXAMPLE, "expected-project");
    const beforeTree = await treeSnapshot(projectRoot);
    const manifestPath = path.join(projectRoot, "fde-project.yaml");
    const beforeManifest = {
      bytes: await readFile(manifestPath),
      mode: (await lstat(manifestPath)).mode & 0o777,
    };
    const globalCli = vi.fn(() => {
      throw new Error("Golden fixture mode must never spawn a global CLI.");
    });
    const network = vi.fn(() => {
      throw new Error("Golden fixture mode must never use the network.");
    });
    const llm = vi.fn(() => {
      throw new Error("Golden fixture mode must never use an LLM.");
    });
    const localProcess = vi.fn((command, args) => {
      expect(command).toMatch(/^\/(?:bin\/bash|.+\/bash)$/u);
      expect(args).toHaveLength(2);
      expect(args[0]).toBe("-n");
      expect(path.isAbsolute(args[1])).toBe(true);
      expect(args[1]).toContain("aiworker-bash-syntax-");
      return { status: 0, signal: null, error: null };
    });

    const { exitCode, result } = await invoke(
      ["--example", "lead-collector"],
      {
        dependencies: {
          globalCli,
          network,
          llm,
          localProcess,
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(result.data).toMatchObject({
      example: "lead-collector",
      matched_files: 23,
      expected_files: 23,
      blockers: 0,
      fixture_only: true,
      offline_external_calls: {
        global_cli: 0,
        network: 0,
        llm: 0,
      },
      dependency_calls: {
        global_cli_calls: 0,
        network_calls: 0,
        llm_calls: 0,
        allowed_local_shell_calls: 13,
      },
      package_boundary: {
        verified: true,
        package_paths: EXPECTED_PACKAGE_PATHS,
        contains_manifest: true,
        contains_validation_report: true,
        contains_sources: false,
        contains_generated: false,
        contains_old_zip: false,
        package_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      },
    });
    expect(result.issues).toEqual([]);
    expect(globalCli).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
    expect(localProcess).toHaveBeenCalledTimes(13);
    expect(await readdir(temporaryRoot)).toEqual([]);
    expect(await treeSnapshot(EXAMPLE)).toEqual(beforeFixtureTree);
    expect(await readFile(artifactsPath)).toEqual(beforeArtifacts.bytes);
    expect((await lstat(artifactsPath)).mode & 0o777)
      .toBe(beforeArtifacts.mode);
    expect(createHash("sha256").update(await readFile(artifactsPath))
      .digest("hex")).toBe(beforeArtifactsHash);
    expect(await treeSnapshot(projectRoot)).toEqual(beforeTree);
    expect(await readFile(manifestPath)).toEqual(beforeManifest.bytes);
    expect((await lstat(manifestPath)).mode & 0o777)
      .toBe(beforeManifest.mode);
  }, 15_000);

  it("allows child processes only through the two reviewed process adapters", async () => {
    const sourceRoot = path.join(ROOT, "src");
    const sourceTree = await treeSnapshot(sourceRoot);
    const javascriptFiles = sourceTree.filter(({ type, path: sourcePath }) =>
      type === "file" && sourcePath.endsWith(".js"));
    const directImports = [];
    for (const { path: sourcePath } of javascriptFiles) {
      const text = await readFile(path.join(sourceRoot, sourcePath), "utf8");
      if (/from\s+["']node:child_process["']/u.test(text)) {
        directImports.push(`src/${sourcePath}`);
      }
      expect(text).not.toMatch(
        /(?:import\s*\(\s*|require\s*\(\s*)["']node:child_process["']/u,
      );
    }
    expect(directImports.sort()).toEqual([
      "src/assembly/cli-runner.js",
      "src/shared/local-process.js",
    ]);
  });

  it("atomically quarantines and reports a foreign temp-root replacement without deleting it", async () => {
    const foreign = Buffer.from("foreign replacement\n", "utf8");
    let liveRunRoot;
    const { exitCode, result } = await invoke(
      ["--example", "lead-collector"],
      {
        cleanupHooks: {
          beforeClaim: async ({ runRoot }) => {
            liveRunRoot = runRoot;
            await rename(runRoot, `${runRoot}.displaced-owned`);
            await mkdir(runRoot, { mode: 0o700 });
            await writeFile(path.join(runRoot, "foreign.txt"), foreign);
          },
        },
      },
    );

    expect(exitCode).toBe(3);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_EXAMPLE_CLEANUP_RETAINED",
    }));
    expect(result.data.foreign_paths).toHaveLength(1);
    expect(result.data.recovery_paths).toEqual(result.data.foreign_paths);
    await expect(readFile(path.join(
      result.data.foreign_paths[0],
      "foreign.txt",
    ))).resolves.toEqual(foreign);
    await expect(lstat(liveRunRoot)).rejects.toMatchObject({ code: "ENOENT" });
  }, 15_000);

  it("returns deterministic summaries and comparison hashes", async () => {
    const first = await invoke(["--example", "lead-collector"]);
    const second = await invoke(["--example", "lead-collector"]);
    expect(second).toEqual(first);
  }, 20_000);

  it("emits identical raw ZIP bytes for two complete fixed-clock runs", async () => {
    const archives = [];
    const run = () => invoke(["--example", "lead-collector"], {
      clock: () => new Date("2026-07-24T01:00:00.000Z"),
      cleanupHooks: {
        beforeClaim: async ({ runRoot }) => {
          archives.push(await readFile(path.join(
            runRoot,
            "lead-collector-delivery.zip",
          )));
        },
      },
    });

    expect((await run()).exitCode).toBe(0);
    expect((await run()).exitCode).toBe(0);
    expect(archives).toHaveLength(2);
    expect(archives[1]).toEqual(archives[0]);
  }, 20_000);

  it("returns exit 1 for a readable Golden or project-contract mismatch", async () => {
    const exampleRoot = path.join(temporaryRoot, "tampered-example");
    await cp(EXAMPLE, exampleRoot, { recursive: true });
    await writeFile(
      path.join(exampleRoot, "expected-project/delivery-summary.md"),
      "# tampered\n",
    );
    const isolatedTemps = path.join(temporaryRoot, "isolated-temps");
    await (await import("node:fs/promises")).mkdir(isolatedTemps);

    const { exitCode, result } = await invoke(
      ["--example", "lead-collector"],
      { exampleRoot, temporaryParent: isolatedTemps },
    );

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: "BLOCKER",
      code: expect.stringMatching(/^B_(?:GOLDEN|PROJECT|ASSEMBLY)/u),
    }));
    expect(await readdir(isolatedTemps)).toEqual([]);
  });

  it("returns exit 1 when the readable expectation contract is invalid", async () => {
    const exampleRoot = path.join(temporaryRoot, "bad-contract-example");
    await cp(EXAMPLE, exampleRoot, { recursive: true });
    await writeFile(
      path.join(exampleRoot, "expected-artifacts.yaml"),
      "schema_version: 1\nfiles: []\nupdate: true\n",
    );
    const isolatedTemps = path.join(temporaryRoot, "contract-temps");
    await (await import("node:fs/promises")).mkdir(isolatedTemps);

    const { exitCode, result } = await invoke(
      ["--example", "lead-collector"],
      { exampleRoot, temporaryParent: isolatedTemps },
    );

    expect(exitCode).toBe(1);
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_GOLDEN_CONTRACT",
    }));
    expect(await readdir(isolatedTemps)).toEqual([]);
  });

  it("returns exit 3 when fixture or temporary storage cannot be used", async () => {
    const missing = path.join(temporaryRoot, "missing-example");
    const { exitCode, result } = await invoke(
      ["--example", "lead-collector"],
      { exampleRoot: missing },
    );
    expect(exitCode).toBe(3);
    expect(result.issues[0]).toMatchObject({
      severity: "BLOCKER",
      code: "B_EXAMPLE_RUNTIME",
    });
  });

  it("cleans the owned private root when an operation fails after allocation", async () => {
    const exampleRoot = path.join(temporaryRoot, "broken-project-example");
    await cp(EXAMPLE, exampleRoot, { recursive: true });
    await rm(path.join(exampleRoot, "expected-project"), {
      recursive: true,
      force: true,
    });
    await writeFile(path.join(exampleRoot, "expected-project"), "not a tree\n");
    const isolatedTemps = path.join(temporaryRoot, "runtime-temps");
    await mkdir(isolatedTemps);

    const { exitCode, result } = await invoke(
      ["--example", "lead-collector"],
      { exampleRoot, temporaryParent: isolatedTemps },
    );

    expect(exitCode).toBe(3);
    expect(result.issues[0]).toMatchObject({
      severity: "BLOCKER",
      code: "B_EXAMPLE_RUNTIME",
    });
    expect(result.data).toMatchObject({
      recovery_paths: [],
      foreign_paths: [],
      offline_external_calls: {
        global_cli: 0,
        network: 0,
        llm: 0,
      },
    });
    expect(await readdir(isolatedTemps)).toEqual([]);
  });

  it("ships exactly 23 declared artifacts with zero blocked assembly operations", async () => {
    const expected = parse(await readFile(
      path.join(EXAMPLE, "expected-artifacts.yaml"),
      "utf8",
    ));
    expect(expected.files.map(({ path: artifactPath }) => artifactPath)).toEqual([
      "acceptance/acceptance-plan.md",
      "acceptance/test-cases.yaml",
      "arcubase/access-matrix.md",
      "arcubase/decision.yaml",
      "arcubase/schema.yaml",
      "assembly/assembly-plan.md",
      "assembly/octopus-cli-assemble.sh",
      "assembly/operations.yaml",
      "assembly/payloads/team-private-digiworker-create.json",
      "delivery-summary.md",
      "design/collaboration-and-dataflow.md",
      "design/data-foundation.md",
      "design/identity-and-access.md",
      "design/platform-capability-selection.md",
      "design/team-design.md",
      "discovery/facts-and-assumptions.md",
      "discovery/open-questions.md",
      "discovery/scenario-model.md",
      "employees/lead-collector.md",
      "fde-project.yaml",
      "inputs/input-inventory.md",
      "reports/validation-report.md",
      "skills/collect-sales-leads/SKILL.md",
    ]);
    expect(expected.files.filter(({ kind }) => kind === "markdown")
      .every(({ sha256, required_literals: required, forbidden_literals: forbidden }) =>
        sha256 === null &&
        required.length > 0 &&
        Array.isArray(forbidden))).toBe(true);
    const operations = parse(await readFile(
      path.join(EXAMPLE, "expected-project/assembly/operations.yaml"),
      "utf8",
    ));
    expect(operations.operations.filter(({ support }) =>
      support === "supported")).toHaveLength(1);
    expect(operations.operations.filter(({ support }) =>
      support === "manual-required")).toHaveLength(4);
    expect(operations.operations.filter(({ support }) =>
      support === "blocked")).toHaveLength(0);
    expect(operations.operations.filter(({ support }) =>
      support === "manual-required").map(({ operation_id }) => operation_id))
      .toEqual([
        "skill-package.upload",
        "arcubase-app.create",
        "arcubase-table.create",
        "skill-set.create",
      ]);
    expect(parse(await readFile(
      path.join(EXAMPLE, "package-scan-policy.yaml"),
      "utf8",
    ))).toEqual({
      schema_version: 1,
      exceptions: [
        {
          path: "acceptance/test-cases.yaml",
          category: "personal-phone",
          reason: "Synthetic acceptance phone confirmed for the offline fixture.",
        },
        {
          path: "fde-project.yaml",
          category: "personal-phone",
          reason: "Synthetic acceptance phone confirmed for the offline fixture.",
        },
      ],
    });
  });

  it("pins the one-worker, one-Skill, nine-field, nine-case scenario", async () => {
    const project = parse(await readFile(
      path.join(EXAMPLE, "expected-project/fde-project.yaml"),
      "utf8",
    ));
    const acceptance = parse(await readFile(
      path.join(EXAMPLE, "expected-project/acceptance/test-cases.yaml"),
      "utf8",
    ));
    expect(project.workers).toEqual([
      expect.objectContaining({
        id: "worker.lead_collector",
        name: "小采 · 线索收集专员",
        skills: ["skill.collect_sales_leads"],
        toolkit_keys: ["feat.arcubase_user", "feat.organization_view"],
        station_reachable: false,
      }),
    ]);
    expect(project.skills).toEqual([
      expect.objectContaining({
        id: "skill.collect_sales_leads",
        owner_worker: "worker.lead_collector",
      }),
    ]);
    expect(project.roles.map(({ id }) => id)).toEqual([
      "role.sales",
      "role.sales_manager",
    ]);
    const table = project.data_foundation.tables[0];
    expect(table.id).toBe("table.sales_leads");
    expect(table.fields.map(({ key }) => key)).toEqual([
      "company_name",
      "contact_name",
      "contact_method",
      "requirement_summary",
      "source",
      "submitter_arcubase_user_id",
      "submitter_name",
      "status",
      "created_at",
    ]);
    expect(project.acceptance_cases).toHaveLength(9);
    expect(acceptance.cases).toEqual(project.acceptance_cases);
    expect(project.acceptance_cases[0].steps).toEqual([
      "销售张楠输入：登记苏州星禾包装有限公司，王芳，13900000002，希望了解经销商线索管理，来源展会",
      "销售张楠输入：确认登记",
    ]);
    expect(project.acceptance_cases[0].expected_results).toContain(
      "确认后固定输出：登记成功，记录ID=rec.fixture.sz-xinghe-001。",
    );
    expect(project.acceptance_cases[1].steps).toEqual([
      "销售张楠输入：登记苏州启明包装，联系人赵蕾，需要报价，来源转介绍",
    ]);
    expect(project.acceptance_cases[2].steps).toEqual([
      "销售张楠输入：登记 杭州清禾食品有限公司，李明，138-0000-0001，需要样品，展会",
      "销售张楠输入：取消",
    ]);
    expect(project.acceptance_cases[4].steps).toEqual([
      "实习生输入：列出所有销售线索",
    ]);
    expect(project.acceptance_cases[3].expected_results).toContain(
      "取消后固定输出：已取消，本次未登记线索。",
    );
    expect(project.acceptance_cases[4].expected_results).toContain(
      "固定输出：权限不足：你无权查看全部销售线索。",
    );
    expect(project.acceptance_cases[5].expected_results).toContain(
      "固定输出：已按提交人“销售张楠”筛选，仅返回你提交的线索。",
    );
    expect(project.acceptance_cases[6].expected_results).toContain(
      "固定输出：已返回全部销售线索（只读）。",
    );
    expect(project.assembly.operations.filter(({ support }) =>
      support === "supported").map(({ operation_id }) => operation_id))
      .toEqual([
        "team-private-digiworker.create",
      ]);
    expect(project.assembly.operations.filter(({ support }) =>
      support === "manual-required").every((operation) =>
        !Object.hasOwn(operation, "payload_file"))).toBe(true);
  });
});
