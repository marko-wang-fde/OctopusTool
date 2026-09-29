import { constants as fileConstants } from "node:fs";
import {
  access as defaultAccess,
  cp,
  lstat,
  link,
  mkdtemp,
  mkdir,
  open as defaultOpen,
  readFile,
  readdir,
  rename,
  rmdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSafeYaml } from "../../src/contracts/safe-data.js";
import { main } from "../../src/commands/init-project.js";
import {
  initializeProject,
  resumeProject,
} from "../../src/project/initialize.js";
import {
  canonicalBytes,
  sha256Bytes,
} from "../../src/shared/canonical.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { stringify } from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = path.join(ROOT, "test/fixtures");
const TEMPLATE_ROOT = path.join(ROOT, "assets/project-template");
const FIXED_CLOCK = () => new Date("2026-01-02T03:04:05.000Z");
const FIXED = [
  ".gitignore",
  "fde-project.yaml",
  "inputs/input-inventory.md",
  "discovery/facts-and-assumptions.md",
  "discovery/open-questions.md",
  "discovery/scenario-model.md",
  "design/team-design.md",
  "design/collaboration-and-dataflow.md",
  "design/platform-capability-selection.md",
  "design/data-foundation.md",
  "design/identity-and-access.md",
  "arcubase/decision.yaml",
  "assembly/assembly-plan.md",
  "assembly/operations.yaml",
  "acceptance/acceptance-plan.md",
  "acceptance/test-cases.yaml",
  "reports/validation-report.md",
  "delivery-summary.md",
];
const CONDITIONAL = [
  "design/external-station.md",
  "design/taskboard.md",
  "design/browser-webskill.md",
];

let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-init-test-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    clock: FIXED_CLOCK,
    ...options,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  expect(chunks).toHaveLength(1);
  expect(chunks[0].match(/\n/gu)).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function manifest(project) {
  return parseSafeYaml(
    await readFile(path.join(project, "fde-project.yaml"), "utf8"),
    "fde-project.yaml",
  );
}

async function copyFixture(name, destination) {
  await cp(path.join(FIXTURES, name), destination, { recursive: true });
}

describe("init-project command arguments and preview", () => {
  test("prints exactly one JSON help result", async () => {
    const { exitCode, result } = await invoke(["--help"]);
    expect(exitCode).toBe(0);
    expect(result).toMatchObject({
      exitCode: 0,
      issues: [],
      data: { usage: expect.stringContaining("init-project --mode") },
    });
  });

  test.each([
    [["--unknown"], "B_ARGUMENT_UNKNOWN"],
    [
      [
        "--mode",
        "new",
        "--customer",
        "星河科技",
        "--scenario",
        "客户线索收集",
        "--parent",
        "relative",
      ],
      "B_ARGUMENT_INVALID",
    ],
    [
      [
        "--mode",
        "materials",
        "--customer",
        "星河科技",
        "--scenario",
        "客户线索收集",
        "--parent",
        "/tmp",
      ],
      "B_ARGUMENT_MISSING",
    ],
    [
      [
        "--mode",
        "resume",
        "--project",
        "/tmp/project",
        "--confirm-import",
        "a".repeat(64),
        "--confirm-migration",
        "b".repeat(64),
      ],
      "B_ARGUMENT_CONFLICT",
    ],
  ])("returns exit 2 for invalid invocation %#", async (args, code) => {
    const { exitCode, result } = await invoke(args);
    expect(exitCode).toBe(2);
    expect(result.exitCode).toBe(2);
    expect(result.issues[0].code).toBe(code);
  });

  test("previews a deterministic new project without writing anything", async () => {
    const { exitCode, result } = await invoke([
      "--mode",
      "new",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data).toMatchObject({
      name: "星河科技客户线索收集数字员工",
      slug: "xinghe-lead-collector-fde",
      absolute_path: path.join(temporaryRoot, "xinghe-lead-collector-fde"),
      entry_mode: "new",
      source_mode: "copy",
      requires_confirmation: true,
    });
    expect(await readdir(temporaryRoot)).toEqual([]);
  });

  test("previews materials without checking a missing source or creating target", async () => {
    const missing = path.join(temporaryRoot, "missing.txt");
    const { exitCode, result } = await invoke([
      "--mode",
      "materials",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      "--source",
      missing,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data).toMatchObject({
      entry_mode: "materials",
      source_mode: "copy",
      requires_confirmation: true,
    });
    expect(await readdir(temporaryRoot)).toEqual([]);
  });
});

describe("confirmed project initialization", () => {
  test("creates exactly the fixed skeleton and a schema-valid conversation source", async () => {
    const { exitCode, result } = await invoke([
      "--mode",
      "new",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      "--confirm",
    ]);
    const project = result.data.absolute_path;

    expect(exitCode).toBe(0);
    for (const relativePath of FIXED) {
      expect((await lstat(path.join(project, relativePath))).isFile()).toBe(true);
    }
    for (const relativePath of CONDITIONAL) {
      await expect(lstat(path.join(project, relativePath))).rejects.toMatchObject({
        code: "ENOENT",
      });
    }
    expect(await lstat(path.join(project, ".gitignore"))).toBeDefined();
    expect(await manifest(project)).toMatchObject({
      project: {
        name: "星河科技客户线索收集数字员工",
        slug: "xinghe-lead-collector-fde",
        entry_mode: "new",
      },
      sources: [
        {
          id: "source.conversation_requirement",
          kind: "conversation",
          portable: true,
          status: "recorded",
          evidence_text: "客户线索收集",
          recorded_at: "2026-01-02T03:04:05.000Z",
        },
      ],
      stage_status: {
        initialize: {
          status: "complete",
          baseline_revision: 1,
          approved_at: "2026-01-02T03:04:05.000Z",
        },
      },
    });
  });

  test("copies materials with deterministic collision-safe names and metadata", async () => {
    const firstDirectory = path.join(temporaryRoot, "a");
    const secondDirectory = path.join(temporaryRoot, "b");
    await mkdir(firstDirectory);
    await mkdir(secondDirectory);
    const first = path.join(firstDirectory, "requirements.txt");
    const second = path.join(secondDirectory, "requirements.txt");
    await writeFile(first, "first\n");
    await writeFile(second, "second\n");

    const { exitCode, result } = await invoke([
      "--mode",
      "materials",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      "--source",
      second,
      "--source",
      first,
      "--confirm",
    ]);
    const projectManifest = await manifest(result.data.absolute_path);

    expect(exitCode).toBe(0);
    expect(projectManifest.sources.map(({ copy_path: copyPath }) => copyPath)).toEqual([
      "inputs/source-files/requirements.txt",
      "inputs/source-files/requirements-2.txt",
    ]);
    expect(projectManifest.sources[0]).toMatchObject({
      original_path: first,
      source_mode: "copy",
      portable: true,
      read_status: "read",
      media_type: "text/plain",
      copied_at: "2026-01-02T03:04:05.000Z",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(
      await readFile(
        path.join(result.data.absolute_path, projectManifest.sources[0].copy_path),
        "utf8",
      ),
    ).toBe("first\n");
  });

  test("never collides generated names with natural or case-only basenames", async () => {
    const directories = ["a", "b", "c", "d"];
    await Promise.all(
      directories.map((directory) => mkdir(path.join(temporaryRoot, directory))),
    );
    const sources = [
      path.join(temporaryRoot, "a/report.txt"),
      path.join(temporaryRoot, "b/report.txt"),
      path.join(temporaryRoot, "c/report-2.txt"),
      path.join(temporaryRoot, "d/REPORT.txt"),
    ];
    await Promise.all(
      sources.map((source, index) => writeFile(source, `source-${index}\n`)),
    );

    const { exitCode, result } = await invoke([
      "--mode",
      "materials",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      ...sources.flatMap((source) => ["--source", source]),
      "--confirm",
    ]);
    const records = (await manifest(result.data.absolute_path)).sources;
    const normalizedNames = records.map(({ copy_path: copyPath }) =>
      copyPath.normalize("NFC").toLowerCase(),
    );

    expect(exitCode).toBe(0);
    expect(new Set(normalizedNames)).toHaveLength(records.length);
    for (const [index, record] of records.entries()) {
      const copied = await readFile(
        path.join(result.data.absolute_path, record.copy_path),
        "utf8",
      );
      expect(copied).toBe(`source-${index}\n`);
    }
  });

  test("records reference sources without copying and discloses portability", async () => {
    const source = path.join(FIXTURES, "source-materials/requirements.txt");
    const { exitCode, result } = await invoke([
      "--mode",
      "materials",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      "--source",
      source,
      "--source-mode",
      "reference",
      "--confirm",
    ]);
    const projectManifest = await manifest(result.data.absolute_path);

    expect(exitCode).toBe(0);
    expect(result.data.package_implication).toMatch(/not portable/iu);
    expect(projectManifest.sources[0]).toMatchObject({
      original_path: source,
      source_mode: "reference",
      portable: false,
      status: "reference-only",
      read_status: "read",
    });
    await expect(
      lstat(path.join(result.data.absolute_path, "inputs/source-files")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  test.each(["missing", "directory", "symlink"])(
    "returns exit 3 and leaves no target for a %s source",
    async (kind) => {
      const source = path.join(temporaryRoot, `${kind}.txt`);
      if (kind === "directory") await mkdir(source);
      if (kind === "symlink") {
        const realSource = path.join(temporaryRoot, "real.txt");
        await writeFile(realSource, "material");
        await symlink(realSource, source);
      }

      const { exitCode, result } = await invoke([
        "--mode",
        "materials",
        "--customer",
        "星河科技",
        "--scenario",
        "客户线索收集",
        "--parent",
        temporaryRoot,
        "--source",
        source,
        "--confirm",
      ]);

      expect(exitCode).toBe(3);
      expect(result.exitCode).toBe(3);
      expect(result.issues[0].code).toBe("B_SOURCE_UNREADABLE");
      expect(await readdir(temporaryRoot)).not.toContain(
        "xinghe-lead-collector-fde",
      );
    },
  );

  test("does not overwrite an existing target", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    await mkdir(target);
    await writeFile(path.join(target, "user.txt"), "keep");

    const { exitCode, result } = await invoke([
      "--mode",
      "new",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      "--confirm",
    ]);

    expect(exitCode).toBe(1);
    expect(result.data.next_actions).toEqual(["resume", "new-slug", "cancel"]);
    expect(await readFile(path.join(target, "user.txt"), "utf8")).toBe("keep");
  });

  test("does not overwrite an empty target that races publication", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    let injectedRace = false;
    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            if (directory === target && !injectedRace) {
              injectedRace = true;
              await mkdir(directory);
            }
            return mkdir(directory, options);
          },
        },
      },
    );

    expect(injectedRace).toBe(true);
    expect(result.exitCode).toBe(1);
    expect((await lstat(target)).isDirectory()).toBe(true);
    expect(await readdir(target)).toEqual([]);
    expect(result.data.recovery_paths).toEqual([]);
  });

  test("does not overwrite a concurrent non-empty target claimed by mkdir", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const foreign = "concurrent owner\n";
    let foreignIdentity;

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            if (directory === target && !foreignIdentity) {
              await mkdir(directory);
              await writeFile(path.join(directory, "foreign.txt"), foreign);
              foreignIdentity = await lstat(directory);
            }
            return mkdir(directory, options);
          },
        },
      },
    );

    const currentIdentity = await lstat(target);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_TARGET_EXISTS");
    expect(currentIdentity.dev).toBe(foreignIdentity.dev);
    expect(currentIdentity.ino).toBe(foreignIdentity.ino);
    expect(await readFile(path.join(target, "foreign.txt"), "utf8")).toBe(
      foreign,
    );
  });

  test("never replaces a target inode swapped at the former rename boundary", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    let replacementIdentity;

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          lstat: async (filePath) => {
            const metadata = await lstat(filePath);
            if (filePath === target && !replacementIdentity) {
              await rmdir(target);
              await mkdir(target);
              replacementIdentity = await lstat(target);
            }
            return metadata;
          },
        },
      },
    );

    const currentIdentity = await lstat(target);
    expect(replacementIdentity).toBeDefined();
    expect(result.exitCode).toBe(3);
    expect(currentIdentity.dev).toBe(replacementIdentity.dev);
    expect(currentIdentity.ino).toBe(replacementIdentity.ino);
    expect(result.data.recovery_paths).toEqual(
      expect.arrayContaining([target, marker]),
    );
    expect((await lstat(marker)).isDirectory()).toBe(true);
  });

  test("retains and reports a partial target with its marker when assembly fails", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    let injected = false;

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath.startsWith(`${target}${path.sep}`) &&
              (flags & fileConstants.O_EXCL) !== 0 &&
              !injected
            ) {
              injected = true;
              return {
                close: handle.close.bind(handle),
                stat: handle.stat.bind(handle),
                sync: handle.sync.bind(handle),
                writeFile: async (bytes) => {
                  await handle.writeFile(bytes.subarray(0, 8));
                  const error = new Error("injected assembly EIO");
                  error.code = "EIO";
                  throw error;
                },
              };
            }
            return handle;
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(3);
    expect(result.data.recovery_paths).toEqual(
      expect.arrayContaining([target, marker]),
    );
    expect((await lstat(target)).isDirectory()).toBe(true);
    expect((await lstat(marker)).isDirectory()).toBe(true);
  });

  test("retains the claimed target when exclusive assembly fails", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath.startsWith(`${target}${path.sep}`) &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              const error = new Error("injected exclusive assembly failure");
              error.code = "EIO";
              throw error;
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].details.recovery_paths).toEqual(
      result.data.recovery_paths,
    );
    expect(result.data.recovery_paths).toEqual(
      expect.arrayContaining([target, marker]),
    );
    expect((await lstat(target)).isDirectory()).toBe(true);
    expect((await lstat(marker)).isDirectory()).toBe(true);
  });

  test("rejects inputs replaced by a symlink before final content reads", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const inputsPath = path.join(target, "inputs");
    const inputInventoryPath = path.join(inputsPath, "input-inventory.md");
    const externalInputs = path.join(temporaryRoot, "external-inputs");
    const ownedInputs = path.join(temporaryRoot, "owned-inputs");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    const expected = await readFile(
      path.join(TEMPLATE_ROOT, "inputs/input-inventory.md"),
    );
    await mkdir(externalInputs);
    await writeFile(
      path.join(externalInputs, "input-inventory.md"),
      expected,
    );
    let injected = false;

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          lstat: async (filePath) => {
            const metadata = await lstat(filePath);
            if (filePath === inputInventoryPath && !injected) {
              injected = true;
              await rename(inputsPath, ownedInputs);
              await symlink(externalInputs, inputsPath, "dir");
            }
            return metadata;
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(3);
    expect(result.data.recovery_paths).toEqual(
      expect.arrayContaining([target, marker]),
    );
    expect(
      await readFile(path.join(externalInputs, "input-inventory.md")),
    ).toEqual(expected);
  });

  test("rechecks a replaced parent before opening a leaf", async () => {
    const source = path.join(FIXTURES, "source-materials/requirements.txt");
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const sourceFilesPath = path.join(target, "inputs/source-files");
    const externalSourceFiles = path.join(
      temporaryRoot,
      "external-source-files",
    );
    const ownedSourceFiles = path.join(
      temporaryRoot,
      "owned-source-files",
    );
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    await mkdir(externalSourceFiles);
    let parentChecks = 0;
    let injected = false;

    const result = await initializeProject(
      {
        mode: "materials",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
        sources: [source],
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          lstat: async (filePath) => {
            const metadata = await lstat(filePath);
            if (filePath === sourceFilesPath) {
              parentChecks += 1;
              if (parentChecks === 2) {
                injected = true;
                await rename(sourceFilesPath, ownedSourceFiles);
                await symlink(
                  externalSourceFiles,
                  sourceFilesPath,
                  "dir",
                );
              }
            }
            return metadata;
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(3);
    expect(result.data.recovery_paths).toEqual(
      expect.arrayContaining([target, marker]),
    );
    expect(await readdir(externalSourceFiles)).toEqual([]);
  });

  test("returns committed success when marker cleanup is deferred", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          rmdir: async (directory) => {
            if (directory === marker) {
              const error = new Error("injected committed marker EIO");
              error.code = "EIO";
              throw error;
            }
            return rmdir(directory);
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.initialized).toBe(true);
    expect(result.data.recovery_paths).toEqual([marker]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        severity: "WARNING",
        code: "W_INITIALIZATION_CLEANUP_DEFERRED",
        details: expect.objectContaining({
          recovery_paths: [marker],
        }),
      }),
    ]);
    expect((await lstat(target)).isDirectory()).toBe(true);
    expect((await lstat(marker)).isDirectory()).toBe(true);
  });

  test("does not claim a target when schema validation rejects the manifest", async () => {
    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        validateProject: async () => ({
          valid: false,
          errors: [{ message: "injected invalid schema" }],
        }),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_SCHEMA_INVALID");
    expect(result.issues[0].details.recovery_paths).toEqual(
      result.data.recovery_paths,
    );
    expect(result.data.recovery_paths).toEqual([]);
    expect(await readdir(temporaryRoot)).toEqual([]);
  });

  test("preserves a foreign marker replacement during target-race cleanup", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    const foreign = "foreign marker data\n";
    let injected = false;

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            if (directory === target && !injected) {
              injected = true;
              await mkdir(target);
              await rename(marker, `${marker}.owned`);
              await mkdir(marker);
              await writeFile(path.join(marker, "foreign.txt"), foreign);
            }
            return mkdir(directory, options);
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_TARGET_EXISTS");
    expect(result.issues[0].details.recovery_paths).toEqual(
      result.data.recovery_paths,
    );
    expect(result.data.recovery_paths).toEqual([marker]);
    expect(await readFile(path.join(marker, "foreign.txt"), "utf8")).toBe(
      foreign,
    );
  });

  test("reports the marker when target-race marker cleanup fails", async () => {
    const target = path.join(temporaryRoot, "xinghe-lead-collector-fde");
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            if (directory === target) {
              await mkdir(target);
            }
            return mkdir(directory, options);
          },
          rmdir: async (directory) => {
            if (directory === marker) {
              const error = new Error("injected marker rmdir failure");
              error.code = "EIO";
              throw error;
            }
            return rmdir(directory);
          },
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_TARGET_EXISTS");
    expect(result.data.recovery_paths).toEqual([marker]);
    expect(result.issues[0].details.recovery_paths).toEqual(
      result.data.recovery_paths,
    );
    expect((await lstat(marker)).isDirectory()).toBe(true);
  });

  test("reports the marker when its identity cannot be read", async () => {
    const marker = path.join(
      temporaryRoot,
      ".xinghe-lead-collector-fde.fde-project.yaml.transaction.lock",
    );
    let markerCreated = false;
    let injected = false;

    const result = await initializeProject(
      {
        mode: "new",
        customer: "星河科技",
        scenario: "客户线索收集",
        parent: temporaryRoot,
        confirm: true,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            const value = await mkdir(directory, options);
            if (directory === marker) markerCreated = true;
            return value;
          },
          lstat: async (filePath) => {
            if (filePath === marker && markerCreated && !injected) {
              injected = true;
              const error = new Error("injected marker identity EIO");
              error.code = "EIO";
              throw error;
            }
            return lstat(filePath);
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(3);
    expect(result.data.recovery_paths).toEqual([marker]);
    expect(result.issues[0].details.recovery_paths).toEqual(
      result.data.recovery_paths,
    );
    expect((await lstat(marker)).isDirectory()).toBe(true);
  });
});

describe("resume existing projects", () => {
  test("recognizes an initialization marker before the project directory exists", async () => {
    const project = path.join(temporaryRoot, "initializing-project");
    const marker = path.join(
      temporaryRoot,
      ".initializing-project.fde-project.yaml.transaction.lock",
    );
    await mkdir(marker);

    const result = await resumeProject({ project }, { clock: FIXED_CLOCK });

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("refuses to read a partial manifest while a transaction lock exists", async () => {
    const project = path.join(temporaryRoot, "locked-project");
    await mkdir(project);
    await writeFile(path.join(project, "fde-project.yaml"), "schema_");
    const lockPath = path.join(
      temporaryRoot,
      ".locked-project.fde-project.yaml.transaction.lock",
    );
    await mkdir(lockPath);

    const result = await resumeProject({ project }, { clock: FIXED_CLOCK });

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
    expect(await readFile(path.join(project, "fde-project.yaml"), "utf8"))
      .toBe("schema_");
  });

  test("discards a snapshot when a transaction lock appears during read", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const lockPath = path.join(
      temporaryRoot,
      ".old-schema-project.fde-project.yaml.transaction.lock",
    );

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (filePath !== manifestPath) return handle;
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              readFile: async (...readArgs) => {
                const bytes = await handle.readFile(...readArgs);
                await mkdir(lockPath);
                return bytes;
              },
            };
          },
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("discards a snapshot when a transaction lock appears and disappears during read", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const replacementPath = path.join(project, ".concurrent-manifest");
    const lockPath = path.join(
      temporaryRoot,
      ".old-schema-project.fde-project.yaml.transaction.lock",
    );
    let injected = false;

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (filePath !== manifestPath || injected) return handle;
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              readFile: async (...readArgs) => {
                const bytes = await handle.readFile(...readArgs);
                injected = true;
                await mkdir(lockPath);
                await writeFile(
                  replacementPath,
                  `${bytes.toString("utf8")}\n# concurrent replacement\n`,
                );
                await rename(replacementPath, manifestPath);
                await rmdir(lockPath);
                return bytes;
              },
            };
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("discards an import proposal when a manifest appears during inventory", async () => {
    const project = path.join(temporaryRoot, "import-manifest-race");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    let injected = false;

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        fs: {
          readdir: async (directory, options) => {
            const entries = await readdir(directory, options);
            if (directory === project && !injected) {
              injected = true;
              await writeFile(manifestPath, "schema_version: 2\n", {
                flag: "wx",
              });
            }
            return entries;
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
    expect(await readFile(manifestPath, "utf8")).toBe("schema_version: 2\n");
  });

  test("discards an import proposal when a manifest appears after the final lock check", async () => {
    const project = path.join(temporaryRoot, "import-final-window");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const lockPath = path.join(
      temporaryRoot,
      ".import-final-window.fde-project.yaml.transaction.lock",
    );
    let lockChecks = 0;

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        fs: {
          lstat: async (filePath) => {
            try {
              return await lstat(filePath);
            } catch (error) {
              if (filePath === lockPath) {
                lockChecks += 1;
                if (lockChecks === 3) {
                  await writeFile(manifestPath, "schema_version: 2\n", {
                    flag: "wx",
                  });
                }
              }
              throw error;
            }
          },
        },
      },
    );

    expect(lockChecks).toBeGreaterThanOrEqual(3);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
    expect(await readFile(manifestPath, "utf8")).toBe("schema_version: 2\n");
  });

  test.each(["import", "migration"])(
    "maps a concurrent %s writer lock race to the locked blocker",
    async (operation) => {
      const project = path.join(temporaryRoot, `${operation}-lock-race`);
      await copyFixture(
        operation === "import"
          ? "import-project-without-manifest"
          : "old-schema-project",
        project,
      );
      const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
      const options =
        operation === "import"
          ? { project, confirmImport: preview.data.proposal_sha256 }
          : { project, confirmMigration: preview.data.preview_sha256 };
      let injected = false;

      const result = await resumeProject(options, {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, mkdirOptions) => {
            if (directory.includes(".transaction.lock") && !injected) {
              injected = true;
              await mkdir(directory, mkdirOptions);
            }
            return mkdir(directory, mkdirOptions);
          },
        },
      });

      expect(injected).toBe(true);
      expect(result.exitCode).toBe(1);
      expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
      expect(result.data.lock_path).toContain(".transaction.lock");
    },
  );

  test("reports and retains a transaction lock when its identity cannot be read", async () => {
    const project = path.join(temporaryRoot, "import-lock-identity");
    await copyFixture("import-project-without-manifest", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const lockPath = path.join(
      temporaryRoot,
      ".import-lock-identity.fde-project.yaml.transaction.lock",
    );
    let lockCreated = false;
    let injected = false;

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            const value = await mkdir(directory, options);
            if (directory === lockPath) lockCreated = true;
            return value;
          },
          lstat: async (filePath) => {
            if (filePath === lockPath && lockCreated && !injected) {
              injected = true;
              const error = new Error("injected lock identity EIO");
              error.code = "EIO";
              throw error;
            }
            return lstat(filePath);
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_IMPORT_RUNTIME");
    expect(result.data.lock_path).toBe(lockPath);
    expect(result.issues[0].details.lock_path).toBe(lockPath);
    expect((await lstat(lockPath)).isDirectory()).toBe(true);
  });

  test("validates without rewriting and reports the closest resumable stage", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const before = await readFile(path.join(project, "fde-project.yaml"), "utf8");

    const { exitCode, result } = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data).toMatchObject({
      project_path: project,
      closest_resumable_stage: "discover",
      changed_paths: [],
      missing_paths: [],
    });
    expect(await readFile(path.join(project, "fde-project.yaml"), "utf8")).toBe(
      before,
    );
  });

  test("discards a normal resume snapshot changed after schema validation", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    let injected = false;

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        validateProject: async () => {
          const bytes = await readFile(manifestPath);
          await writeFile(
            path.join(project, ".replacement-manifest"),
            Buffer.concat([bytes, Buffer.from("\n# validation race\n")]),
          );
          await rename(
            path.join(project, ".replacement-manifest"),
            manifestPath,
          );
          injected = true;
          return { valid: true, errors: [] };
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("discards a normal resume snapshot changed during stage hash inspection", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const recordedPath = path.join(project, "design/legacy.md");
    const value = await manifest(project);
    value.stage_status.initialize.output_hashes = {
      "design/legacy.md": sha256Bytes(await readFile(recordedPath)),
    };
    await writeFile(manifestPath, stringify(value));
    let injected = false;

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (filePath !== recordedPath || injected) return handle;
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              readFile: async (...readArgs) => {
                const bytes = await handle.readFile(...readArgs);
                const manifestBytes = await readFile(manifestPath);
                await writeFile(
                  path.join(project, ".replacement-manifest"),
                  Buffer.concat([
                    manifestBytes,
                    Buffer.from("\n# stage hash race\n"),
                  ]),
                );
                await rename(
                  path.join(project, ".replacement-manifest"),
                  manifestPath,
                );
                injected = true;
                return bytes;
              },
            };
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("reads the manifest through a no-follow handle instead of its pathname", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        fs: {
          readFile: async (filePath, ...args) => {
            if (filePath === manifestPath) {
              throw new Error("unsafe pathname-based manifest read");
            }
            return readFile(filePath, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.manifest_valid).toBe(true);
  });

  test("allows read-only resume inspection without requesting write access", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);

    const result = await resumeProject(
      { project },
      {
        fs: {
          access: async (filePath, mode) => {
            if ((mode & fileConstants.W_OK) !== 0) {
              const error = new Error("injected read-only project");
              error.code = "EACCES";
              throw error;
            }
            return defaultAccess(filePath, mode);
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.manifest_valid).toBe(true);
  });

  test("classifies manifest filesystem errors as exit 3 rather than corruption", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");

    const result = await resumeProject(
      { project },
      {
        fs: {
          open: async (filePath, ...args) => {
            if (filePath === manifestPath) {
              const error = new Error("injected EACCES");
              error.code = "EACCES";
              throw error;
            }
            return defaultOpen(filePath, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MANIFEST_UNREADABLE");
  });

  test("reports recorded hash drift as a user modification", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const value = await manifest(project);
    value.stage_status.initialize.output_hashes = {
      "design/legacy.md": "0".repeat(64),
      "design/missing.md": "1".repeat(64),
    };
    await writeFile(manifestPath, stringify(value));

    const { exitCode, result } = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data.closest_resumable_stage).toBe("initialize");
    expect(result.data.changed_paths).toEqual(["design/legacy.md"]);
    expect(result.data.missing_paths).toEqual(["design/missing.md"]);
    expect(result.issues.map(({ code }) => code)).toEqual([
      "W_USER_MODIFICATION",
      "W_RECORDED_PATH_MISSING",
    ]);
  });

  test("does not follow a symlinked ancestor while checking stage hashes", async () => {
    const project = path.join(temporaryRoot, "resume-project");
    await copyFixture("resume-project", project);
    const outside = path.join(temporaryRoot, "outside");
    await mkdir(outside);
    const outsideFile = path.join(outside, "evidence.md");
    await writeFile(outsideFile, "outside evidence\n");
    await symlink(outside, path.join(project, "linked"));
    const value = await manifest(project);
    value.stage_status.initialize.output_hashes = {
      "linked/evidence.md": sha256Bytes(Buffer.from("outside evidence\n")),
    };
    await writeFile(path.join(project, "fde-project.yaml"), stringify(value));

    const { exitCode, result } = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
    ]);

    expect(exitCode).toBe(0);
    expect(result.data.changed_paths).toEqual(["linked/evidence.md"]);
    expect(result.issues[0].code).toBe("W_USER_MODIFICATION");
  });

  test("reports drift in a recorded reference source", async () => {
    const source = path.join(temporaryRoot, "reference.txt");
    await writeFile(source, "before\n");
    const created = await invoke([
      "--mode",
      "materials",
      "--customer",
      "星河科技",
      "--scenario",
      "客户线索收集",
      "--parent",
      temporaryRoot,
      "--source",
      source,
      "--source-mode",
      "reference",
      "--confirm",
    ]);
    await writeFile(source, "after\n");

    const resumed = await invoke([
      "--mode",
      "resume",
      "--project",
      created.result.data.absolute_path,
    ]);

    expect(resumed.exitCode).toBe(0);
    expect(resumed.result.data.closest_resumable_stage).toBe("initialize");
    expect(resumed.result.data.changed_paths).toEqual([source]);
    expect(resumed.result.issues[0].code).toBe("W_USER_MODIFICATION");
  });

  test("proposes and confirms a canonical import without modifying legacy files", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const legacyPath = path.join(project, "design/legacy.md");
    const before = await readFile(legacyPath, "utf8");

    const preview = await invoke(["--mode", "resume", "--project", project]);
    expect(preview.exitCode).toBe(0);
    expect(preview.result.data).toMatchObject({
      requires_confirmation: true,
      proposal_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      inventory: ["design/legacy.md"],
    });
    expect(sha256Bytes(canonicalBytes(preview.result.data.proposal))).toBe(
      preview.result.data.proposal_sha256,
    );
    await expect(lstat(path.join(project, "fde-project.yaml"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const confirmed = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
      "--confirm-import",
      preview.result.data.proposal_sha256,
    ]);
    expect(confirmed.exitCode).toBe(0);
    expect((await manifest(project)).project).toMatchObject({
      name: "legacy-import-fde",
      slug: "legacy-import-fde",
      entry_mode: "resume",
    });
    expect(await readFile(legacyPath, "utf8")).toBe(before);
    expect((await readdir(project)).sort()).toEqual([
      "design",
      "fde-project.yaml",
    ]);
    expect(confirmed.result.data.quarantine_paths).toHaveLength(1);
    for (const quarantinePath of confirmed.result.data.quarantine_paths) {
      const relative = path.relative(project, quarantinePath);
      expect(
        relative === ".." || relative.startsWith(`..${path.sep}`),
      ).toBe(true);
      const liveIdentity = await lstat(
        path.join(project, "fde-project.yaml"),
      );
      const recoveryIdentity = await lstat(quarantinePath);
      expect(
        liveIdentity.dev === recoveryIdentity.dev &&
          liveIdentity.ino === recoveryIdentity.ino,
      ).toBe(false);
    }
    const importedBytes = await readFile(
      path.join(project, "fde-project.yaml"),
    );
    await writeFile(
      confirmed.result.data.quarantine_paths[0],
      "mutated detached import recovery\n",
    );
    expect(await readFile(path.join(project, "fde-project.yaml"))).toEqual(
      importedBytes,
    );
  });

  test("discards an imported result changed after transaction lock cleanup", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const lockPath = path.join(
      temporaryRoot,
      ".legacy-import-fde.fde-project.yaml.transaction.lock",
    );
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let injected = false;

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          rmdir: async (directory) => {
            const value = await rmdir(directory);
            if (directory === lockPath && !injected) {
              await writeFile(
                path.join(project, ".replacement-manifest"),
                "schema_version: 2\n",
              );
              await rename(
                path.join(project, ".replacement-manifest"),
                manifestPath,
              );
              injected = true;
            }
            return value;
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("publishes import through an exclusive independent inode", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let exclusiveOpen = false;
    let linkCalled = false;

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              exclusiveOpen = true;
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
        link: async () => {
          linkCalled = true;
          throw new Error("hard-link publication is forbidden");
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(exclusiveOpen).toBe(true);
    expect(linkCalled).toBe(false);
  });

  test("detects an in-place edit during published schema validation", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const concurrent = "schema_version: 2\n# schema validation race\n";
    let validations = 0;

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        validateProject: async () => {
          validations += 1;
          if (validations === 2) {
            await writeFile(manifestPath, concurrent);
          }
          return { valid: true, errors: [] };
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
  });

  test("preserves a partial exclusive import publication for recovery", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath !== manifestPath ||
              (flags & fileConstants.O_EXCL) === 0
            ) {
              return handle;
            }
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              sync: handle.sync.bind(handle),
              writeFile: async (bytes) => {
                await handle.writeFile(bytes.subarray(0, 32));
                const error = new Error("injected partial import write");
                error.code = "EIO";
                throw error;
              },
            };
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_IMPORT_RUNTIME");
    expect((await lstat(manifestPath)).isFile()).toBe(true);
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
    const retained = await Promise.all(
      result.data.quarantine_paths.map((recoveryPath) =>
        readFile(recoveryPath),
      ),
    );
    expect(retained.some((bytes) => bytes.length === 32)).toBe(true);
  });

  test("retains a live partial import and lock when detached recovery setup fails", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdtemp: async (prefix) => {
            if (prefix.includes("partial-publication-")) {
              const error = new Error("injected detached recovery EACCES");
              error.code = "EACCES";
              throw error;
            }
            return mkdtemp(prefix);
          },
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath !== manifestPath ||
              (flags & fileConstants.O_EXCL) === 0
            ) {
              return handle;
            }
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              sync: handle.sync.bind(handle),
              writeFile: async (bytes) => {
                await handle.writeFile(bytes.subarray(0, 32));
                const error = new Error("injected partial import write");
                error.code = "EIO";
                throw error;
              },
            };
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_IMPORT_RUNTIME");
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect(result.data.quarantine_paths).not.toContain(manifestPath);
    expect((await lstat(manifestPath)).isFile()).toBe(true);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
  });

  test("retains live publication when post-write lstat fails", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let publicationOpened = false;
    let injected = false;

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              publicationOpened = true;
            }
            return defaultOpen(filePath, flags, ...args);
          },
          lstat: async (filePath) => {
            if (filePath === manifestPath && publicationOpened && !injected) {
              injected = true;
              const error = new Error("injected post-write lstat EIO");
              error.code = "EIO";
              throw error;
            }
            return lstat(filePath);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
  });

  test("never overwrites a concurrent detached recovery target", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const foreign = "foreign detached recovery\n";
    let recoveryPath;

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath.includes("partial-publication-") &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              recoveryPath = filePath;
              await writeFile(filePath, foreign, { flag: "wx" });
              return defaultOpen(filePath, flags, ...args);
            }
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              return {
                close: handle.close.bind(handle),
                stat: handle.stat.bind(handle),
                sync: handle.sync.bind(handle),
                writeFile: async (bytes) => {
                  await handle.writeFile(bytes.subarray(0, 32));
                  throw new Error("injected partial publication");
                },
              };
            }
            return handle;
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(await readFile(recoveryPath, "utf8")).toBe(foreign);
    expect(result.data.quarantine_paths).toContain(recoveryPath);
    expect(result.data.live_recovery_paths).toContain(manifestPath);
  });

  test("returns committed import success when lock cleanup fails", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });

    const result = await resumeProject(
      { project, confirmImport: preview.data.proposal_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          rmdir: async (directory) => {
            if (directory.includes(".transaction.lock")) {
              const error = new Error("injected transaction rmdir EIO");
              error.code = "EIO";
              throw error;
            }
            return rmdir(directory);
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.imported).toBe(true);
    expect(result.issues[0].code).toBe("W_IMPORT_CLEANUP_DEFERRED");
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
  });

  test("preserves an import temp replaced at the publication boundary", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const concurrent = "concurrent import temp\n";
    const temporaryPath = path.join(
      project,
      `.fde-project.yaml.import-${preview.data.proposal_sha256}.tmp`,
    );

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath !== path.join(project, "fde-project.yaml") ||
              (flags & fileConstants.O_EXCL) === 0
            ) {
              return handle;
            }
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              sync: handle.sync.bind(handle),
              writeFile: async (bytes) => {
                await handle.writeFile(bytes);
                await unlink(temporaryPath);
                await writeFile(temporaryPath, concurrent, { flag: "wx" });
              },
            };
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.imported).toBe(true);
    expect(result.data.quarantine_paths).toHaveLength(1);
    expect(
      await readFile(result.data.quarantine_paths[0], "utf8"),
    ).toBe(concurrent);
  });

  test("reports an import quarantine directory when source loss cleanup fails", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let quarantineDirectory;

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          rename: async (source, target) => {
            if (
              path.basename(source).startsWith(
                ".fde-project.yaml.import-",
              ) &&
              target.includes(".import-quarantine-")
            ) {
              await unlink(source);
            }
            return rename(source, target);
          },
          rmdir: async (directory) => {
            if (directory.includes(".import-quarantine-")) {
              quarantineDirectory = directory;
              const error = new Error("injected import rmdir failure");
              error.code = "EIO";
              throw error;
            }
            return rmdir(directory);
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.imported).toBe(true);
    expect(quarantineDirectory).toBeDefined();
    expect(result.data.quarantine_paths).toContain(quarantineDirectory);
    expect(result.issues[0]).toMatchObject({
      severity: "WARNING",
      code: "W_IMPORT_CLEANUP_DEFERRED",
      details: {
        quarantine_paths: result.data.quarantine_paths,
      },
    });
    expect((await lstat(quarantineDirectory)).isDirectory()).toBe(true);
  });

  test("propagates non-committed import cleanup warnings", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const concurrent = "schema_version: 2\n";
    let quarantineDirectory;

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              await writeFile(manifestPath, concurrent, { flag: "wx" });
            }
            return defaultOpen(filePath, flags, ...args);
          },
          rename: async (source, target) => {
            if (
              path.basename(source).startsWith(
                ".fde-project.yaml.import-",
              ) &&
              target.includes(".import-quarantine-")
            ) {
              await unlink(source);
            }
            return rename(source, target);
          },
          rmdir: async (directory) => {
            if (directory.includes(".import-quarantine-")) {
              quarantineDirectory = directory;
              const error = new Error("injected non-committed rmdir EIO");
              error.code = "EIO";
              throw error;
            }
            return rmdir(directory);
          },
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_IMPORT_TARGET_EXISTS");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "WARNING",
          code: "W_IMPORT_CLEANUP_DEFERRED",
          details: expect.objectContaining({
            error: "injected non-committed rmdir EIO",
            quarantine_paths: result.data.quarantine_paths,
          }),
        }),
      ]),
    );
    expect(result.data.quarantine_paths).toContain(quarantineDirectory);
  });

  test("returns committed import success when cleanup isolation fails", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let temporaryPath;
    let quarantineDirectory;

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          rename: async (source, target) => {
            if (
              path.basename(source).startsWith(
                ".fde-project.yaml.import-",
              ) &&
              target.includes(".import-quarantine-")
            ) {
              temporaryPath = source;
              quarantineDirectory = path.dirname(target);
              const error = new Error("injected import cleanup EIO");
              error.code = "EIO";
              throw error;
            }
            return rename(source, target);
          },
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.data.imported).toBe(true);
    expect(await manifest(project)).toEqual(preview.data.proposal.manifest);
    expect(result.issues[0]).toMatchObject({
      severity: "WARNING",
      code: "W_IMPORT_CLEANUP_DEFERRED",
      details: {
        quarantine_paths: result.data.quarantine_paths,
      },
    });
    expect(result.data.quarantine_paths).toEqual(
      expect.arrayContaining([temporaryPath, quarantineDirectory]),
    );
    const liveManifestPath = path.join(project, "fde-project.yaml");
    const liveIdentity = await lstat(liveManifestPath);
    const liveBytes = await readFile(liveManifestPath);
    for (const recoveryPath of result.data.quarantine_paths) {
      const recoveryIdentity = await lstat(recoveryPath);
      if (!recoveryIdentity.isFile()) continue;
      expect(
        recoveryIdentity.dev === liveIdentity.dev &&
          recoveryIdentity.ino === liveIdentity.ino,
      ).toBe(false);
      await writeFile(recoveryPath, "mutated deferred import recovery\n");
    }
    expect(await readFile(liveManifestPath)).toEqual(liveBytes);
  });

  test("preflights import recovery before writing a manifest temp", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const projectWrites = [];

    const result = await resumeProject(
      {
        project,
        confirmImport: preview.data.proposal_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdtemp: async (prefix) => {
            if (prefix.includes(".import-quarantine-")) {
              const error = new Error("injected import recovery EACCES");
              error.code = "EACCES";
              throw error;
            }
            return mkdtemp(prefix);
          },
          writeFile: async (filePath, ...args) => {
            if (filePath.startsWith(`${project}${path.sep}`)) {
              projectWrites.push(filePath);
            }
            return writeFile(filePath, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_IMPORT_RUNTIME");
    expect(projectWrites).toEqual([]);
    expect((await readdir(project)).sort()).toEqual(["design"]);
  });

  test("rejects a stale import proposal with zero writes", async () => {
    const project = path.join(temporaryRoot, "legacy-import-fde");
    await copyFixture("import-project-without-manifest", project);

    const { exitCode, result } = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
      "--confirm-import",
      "0".repeat(64),
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_IMPORT_PROPOSAL_MISMATCH");
    await expect(lstat(path.join(project, "fde-project.yaml"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test.each([
    ["corrupt", "schema_version: [", "B_MANIFEST_CORRUPT"],
    ["newer", "schema_version: 2\n", "B_SCHEMA_VERSION_UNSUPPORTED"],
  ])("blocks a %s manifest without writes", async (_label, content, code) => {
    const project = path.join(temporaryRoot, "blocked");
    await mkdir(project);
    const manifestPath = path.join(project, "fde-project.yaml");
    await writeFile(manifestPath, content);

    const { exitCode, result } = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues[0].code).toBe(code);
    expect(await readFile(manifestPath, "utf8")).toBe(content);
  });

  test("discards a migration preview snapshot changed after schema validation", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    let injected = false;

    const result = await resumeProject(
      { project },
      {
        clock: FIXED_CLOCK,
        validateProject: async () => {
          const bytes = await readFile(manifestPath);
          await writeFile(
            path.join(project, ".replacement-manifest"),
            Buffer.concat([bytes, Buffer.from("\n# migration race\n")]),
          );
          await rename(
            path.join(project, ".replacement-manifest"),
            manifestPath,
          );
          injected = true;
          return { valid: true, errors: [] };
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("previews and confirms deterministic v0 migration with a backup", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");

    const preview = await invoke(["--mode", "resume", "--project", project]);
    expect(preview.exitCode).toBe(0);
    expect(preview.result.data).toMatchObject({
      requires_confirmation: true,
      preview_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      migration: "v0-to-v1",
    });
    expect(sha256Bytes(canonicalBytes(preview.result.data.preview))).toBe(
      preview.result.data.preview_sha256,
    );
    expect(await readFile(manifestPath, "utf8")).toBe(before);

    const confirmed = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
      "--confirm-migration",
      preview.result.data.preview_sha256,
    ]);
    expect(confirmed.exitCode).toBe(0);
    const migrated = await manifest(project);
    expect(migrated).toMatchObject({
      schema_version: 1,
      project: {
        name: "旧版线索数字员工",
        slug: "legacy-lead-fde",
        customer_name: "星河科技",
        primary_scenario: "客户线索收集",
        entry_mode: "materials",
      },
    });
    expect(
      await readFile(
        path.join(
          project,
          "reports/backups/2026-01-02T03-04-05.000Z/fde-project.yaml",
        ),
        "utf8",
      ),
    ).toBe(before);
    expect((await readdir(project)).sort()).toEqual([
      "fde-project.yaml",
      "reports",
    ]);
    expect(confirmed.result.data.quarantine_paths.length).toBeGreaterThan(0);
    const liveManifestPath = path.join(project, "fde-project.yaml");
    const liveIdentity = await lstat(liveManifestPath);
    for (const quarantinePath of confirmed.result.data.quarantine_paths) {
      const relative = path.relative(project, quarantinePath);
      expect(
        relative === ".." || relative.startsWith(`..${path.sep}`),
      ).toBe(true);
      const recoveryIdentity = await lstat(quarantinePath);
      expect(
        liveIdentity.dev === recoveryIdentity.dev &&
          liveIdentity.ino === recoveryIdentity.ino,
      ).toBe(false);
    }
    const migratedBytes = await readFile(liveManifestPath);
    for (const quarantinePath of confirmed.result.data.quarantine_paths) {
      await writeFile(quarantinePath, "mutated detached migration recovery\n");
    }
    expect(await readFile(liveManifestPath)).toEqual(migratedBytes);
  });

  test("discards a migrated result changed after transaction lock cleanup", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const lockPath = path.join(
      temporaryRoot,
      ".old-schema-project.fde-project.yaml.transaction.lock",
    );
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let injected = false;

    const result = await resumeProject(
      { project, confirmMigration: preview.data.preview_sha256 },
      {
        clock: FIXED_CLOCK,
        fs: {
          rmdir: async (directory) => {
            const value = await rmdir(directory);
            if (directory === lockPath && !injected) {
              await writeFile(
                path.join(project, ".replacement-manifest"),
                "schema_version: 2\n",
              );
              await rename(
                path.join(project, ".replacement-manifest"),
                manifestPath,
              );
              injected = true;
            }
            return value;
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_PROJECT_TRANSACTION_LOCKED");
  });

  test("preflights migration recovery before any project mutation", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const projectMutations = [];

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdtemp: async (prefix) => {
            if (prefix.includes(".migration-quarantine-")) {
              const error = new Error("injected migration recovery EACCES");
              error.code = "EACCES";
              throw error;
            }
            return mkdtemp(prefix);
          },
          link: async (source, target) => {
            projectMutations.push(["link", source, target]);
            return link(source, target);
          },
          mkdir: async (directory, options) => {
            if (directory.startsWith(`${project}${path.sep}`)) {
              projectMutations.push(["mkdir", directory]);
            }
            return mkdir(directory, options);
          },
          rename: async (source, target) => {
            projectMutations.push(["rename", source, target]);
            return rename(source, target);
          },
          writeFile: async (filePath, ...args) => {
            projectMutations.push(["writeFile", filePath]);
            return writeFile(filePath, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MIGRATION_RUNTIME");
    expect(projectMutations).toEqual([]);
    expect((await readdir(project)).sort()).toEqual(["fde-project.yaml"]);
  });

  test("preserves a partial exclusive migration publication and restores v0", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath !== manifestPath ||
              (flags & fileConstants.O_EXCL) === 0 ||
              injected
            ) {
              return handle;
            }
            injected = true;
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              sync: handle.sync.bind(handle),
              writeFile: async (bytes) => {
                await handle.writeFile(bytes.subarray(0, 32));
                const error = new Error("injected partial migration write");
                error.code = "EIO";
                throw error;
              },
            };
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect((await readFile(manifestPath)).subarray(0, 32)).toEqual(
      (await readFile(manifestPath)),
    );
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
    const retained = await Promise.all(
      result.data.quarantine_paths.map((recoveryPath) =>
        readFile(recoveryPath),
      ),
    );
    expect(retained.some((bytes) => bytes.length === 32)).toBe(true);
  });

  test("retains migration quarantine entries instead of pathname-deleting them", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const foreign = "foreign quarantine replacement\n";
    let quarantineDeletionAttempted = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          unlink: async (filePath) => {
            if (
              filePath.includes(".migration-quarantine-") &&
              !quarantineDeletionAttempted
            ) {
              quarantineDeletionAttempted = true;
              await unlink(filePath);
              await writeFile(filePath, foreign, { flag: "wx" });
              return unlink(filePath);
            }
            return unlink(filePath);
          },
        },
      },
    );

    expect(quarantineDeletionAttempted).toBe(false);
    expect(result.exitCode).toBe(0);
    expect(result.data.quarantine_paths.length).toBeGreaterThan(0);
    for (const quarantinePath of result.data.quarantine_paths) {
      expect((await lstat(quarantinePath)).isFile()).toBe(true);
      const relative = path.relative(project, quarantinePath);
      expect(
        relative === ".." || relative.startsWith(`..${path.sep}`),
      ).toBe(true);
    }
    expect((await readdir(project)).sort()).toEqual([
      "fde-project.yaml",
      "reports",
    ]);
  });

  test("preserves a concurrent edit made before the migration claim", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const before = await readFile(manifestPath, "utf8");
    const concurrent = `${before}# concurrent edit before claim\n`;
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        rename: async (source, target) => {
          if (source === manifestPath && !injected) {
            injected = true;
            await writeFile(manifestPath, concurrent);
          }
          return rename(source, target);
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_MIGRATION_SOURCE_CHANGED");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    expect(result.issues[0].details.quarantine_paths).toEqual(
      result.data.quarantine_paths,
    );
    expect(result.data.quarantine_paths.length).toBeGreaterThan(0);
    for (const quarantinePath of result.data.quarantine_paths) {
      expect((await lstat(quarantinePath)).isFile()).toBe(true);
    }
  });

  test("restores a source replacement moved by the migration claim", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const displacedOriginalPath = path.join(project, "original-v0.saved");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const before = await readFile(manifestPath, "utf8");
    const concurrent = "schema_version: 2\n# replacement during claim\n";
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        rename: async (source, target) => {
          if (source === manifestPath && !injected) {
            injected = true;
            await rename(manifestPath, displacedOriginalPath);
            await writeFile(manifestPath, concurrent, { flag: "wx" });
          }
          return rename(source, target);
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_MIGRATION_SOURCE_CHANGED");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    expect(await readFile(displacedOriginalPath, "utf8")).toBe(before);
  });

  test("preserves a target recreated before exclusive migration publication", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const concurrent = "schema_version: 2\n# concurrent replacement\n";
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0 &&
              !injected
            ) {
              injected = true;
              await writeFile(manifestPath, concurrent, { flag: "wx" });
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_MIGRATION_TARGET_RACE");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    expect(result.issues[0].details.quarantine_paths).toEqual(
      result.data.quarantine_paths,
    );
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents).toContain(concurrent);
    expect(retainedContents.some((value) => value.includes("schema_version: 0")))
      .toBe(true);
  });

  test("retains the claimed v0 recovery copy when publication loses a race", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const before = await readFile(manifestPath, "utf8");
    const concurrent = "schema_version: 2\n# publication race winner\n";

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              await writeFile(manifestPath, concurrent, { flag: "wx" });
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_MIGRATION_TARGET_RACE");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents).toContain(concurrent);
    expect(retainedContents).toContain(before);
  });

  test("preserves a concurrent in-place edit after exclusive publication", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const concurrent = "schema_version: 2\n# concurrent in-place edit\n";
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath !== manifestPath ||
              (flags & fileConstants.O_EXCL) === 0 ||
              injected
            ) {
              return handle;
            }
            injected = true;
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              sync: handle.sync.bind(handle),
              writeFile: async (bytes) => {
                await handle.writeFile(bytes);
                await writeFile(manifestPath, concurrent);
              },
            };
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MIGRATION_RUNTIME");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
    expect(result.data.quarantine_paths.length).toBeGreaterThan(0);
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents.length).toBeGreaterThan(0);
  });

  test("rejects a stale migration preview with zero writes", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");

    const { exitCode, result } = await invoke([
      "--mode",
      "resume",
      "--project",
      project,
      "--confirm-migration",
      "0".repeat(64),
    ]);

    expect(exitCode).toBe(1);
    expect(result.issues[0].code).toBe("B_MIGRATION_PREVIEW_MISMATCH");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    await expect(lstat(path.join(project, "reports"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("rolls back a failed migration and removes partial backup files", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        rename: async () => {
          const error = new Error("injected migration rename failure");
          error.code = "EIO";
          throw error;
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    await expect(lstat(path.join(project, "reports"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("removes owned parent directories when backup staging fails", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const backupDirectory = path.join(
      project,
      "reports/backups/2026-01-02T03-04-05.000Z",
    );

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          mkdir: async (directory, options) => {
            if (directory === backupDirectory) {
              const error = new Error("injected backup staging failure");
              error.code = "EIO";
              throw error;
            }
            return mkdir(directory, options);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(result.issues[0].details.quarantine_paths).toEqual(
      result.data.quarantine_paths,
    );
    for (const quarantinePath of result.data.quarantine_paths) {
      expect((await lstat(quarantinePath)).isFile()).toBe(true);
    }
  });

  test.each([
    [
      "lock acquisition",
      () => ({
        fs: {
          writeFile: async (filePath, ...args) => {
            if (filePath.endsWith(".migration.lock")) {
              throw new Error("injected lock write failure");
            }
            return writeFile(filePath, ...args);
          },
        },
      }),
    ],
    [
      "migrated temp preparation",
      () => ({
        fs: {
          writeFile: async (filePath, ...args) => {
            if (filePath.endsWith(".migrated-manifest.tmp")) {
              throw new Error("injected temp write failure");
            }
            return writeFile(filePath, ...args);
          },
        },
      }),
    ],
    [
      "exclusive publication",
      (manifestPath) => {
        let injected = false;
        return {
          fs: {
            open: async (filePath, flags, ...args) => {
              if (
                filePath === manifestPath &&
                (flags & fileConstants.O_EXCL) !== 0 &&
                !injected
              ) {
                injected = true;
                throw new Error("injected publication failure");
              }
              return defaultOpen(filePath, flags, ...args);
            },
          },
        };
      },
    ],
    [
      "post-publication acknowledgement",
      (manifestPath) => {
        let injected = false;
        return {
          fs: {
            open: async (filePath, flags, ...args) => {
              const handle = await defaultOpen(filePath, flags, ...args);
              if (
                filePath !== manifestPath ||
                (flags & fileConstants.O_EXCL) === 0 ||
                injected
              ) {
                return handle;
              }
              injected = true;
              return {
                close: handle.close.bind(handle),
                stat: handle.stat.bind(handle),
                writeFile: handle.writeFile.bind(handle),
                sync: async () => {
                  throw new Error("injected post-publication failure");
                },
              };
            },
          },
        };
      },
    ],
  ])("restores v0 after a %s failure", async (label, dependencyFactory) => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        ...dependencyFactory(manifestPath),
      },
    );

    expect(result.exitCode).toBe(3);
    if (label === "post-publication acknowledgement") {
      expect((await manifest(project)).schema_version).toBe(1);
      expect(result.data.live_recovery_paths).toContain(manifestPath);
      expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
    } else {
      expect(await readFile(manifestPath, "utf8")).toBe(before);
    }
    expect(result.issues[0].details.quarantine_paths).toEqual(
      result.data.quarantine_paths,
    );
    for (const quarantinePath of result.data.quarantine_paths) {
      expect((await lstat(quarantinePath)).isFile()).toBe(true);
    }
  });

  test("does not delete a concurrently replaced migration temp file", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const backupPath = path.join(
      project,
      "reports/backups/2026-01-02T03-04-05.000Z",
    );
    const temporaryPath = path.join(
      backupPath,
      ".migrated-manifest.tmp",
    );
    const concurrent = "concurrent process data\n";
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0 &&
              !injected
            ) {
              injected = true;
              await unlink(temporaryPath);
              await writeFile(temporaryPath, concurrent, { flag: "wx" });
              throw new Error(
                "injected publication failure after temp replacement",
              );
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MIGRATION_ROLLBACK_FAILED");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(await readFile(temporaryPath, "utf8")).toBe(concurrent);
    expect(result.issues[0].details.quarantine_paths).toEqual(
      result.data.quarantine_paths,
    );
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents).toContain(concurrent);
  });

  test("preserves a temp replacement made at the cleanup deletion boundary", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const temporaryPath = path.join(
      project,
      "reports/backups/2026-01-02T03-04-05.000Z/.migrated-manifest.tmp",
    );
    const concurrent = "concurrent temp replacement at deletion\n";
    let injected = false;
    let injectedAt;

    async function replaceTemporary(boundary) {
      injected = true;
      injectedAt = boundary;
      await unlink(temporaryPath);
      await writeFile(temporaryPath, concurrent, { flag: "wx" });
    }

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          rename: async (source, target) => {
            if (
              source === temporaryPath &&
              target.includes(".migration-quarantine-") &&
              !injected
            ) {
              await replaceTemporary("rename");
            }
            return rename(source, target);
          },
          unlink: async (filePath) => {
            if (filePath === temporaryPath && !injected) {
              await replaceTemporary("unlink");
            }
            return unlink(filePath);
          },
        },
      },
    );

    expect(injected).toBe(true);
    expect(injectedAt).toBe("rename");
    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MIGRATION_ROLLBACK_FAILED");
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    expect(await readFile(temporaryPath, "utf8")).toBe(concurrent);
    expect(result.issues[0].details.quarantine_paths).toEqual(
      result.data.quarantine_paths,
    );
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents).toContain(concurrent);
  });

  test("never overwrites a manifest replaced at rollback deletion", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const concurrent = "schema_version: 2\n# concurrent rollback replacement\n";
    let injected = false;
    let injectedAt;
    let publicationFailureInjected = false;

    async function replaceManifest(boundary) {
      injected = true;
      injectedAt = boundary;
      await unlink(manifestPath);
      await writeFile(manifestPath, concurrent, { flag: "wx" });
    }

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          rename: async (source, target) => {
            if (
              source === manifestPath &&
              target.includes(".migration-quarantine-") &&
              !injected
            ) {
              await replaceManifest("rename");
            }
            return rename(source, target);
          },
          unlink: async (filePath) => {
            if (filePath === manifestPath && !injected) {
              await replaceManifest("unlink");
            }
            return unlink(filePath);
          },
          open: async (filePath, flags, ...args) => {
            const handle = await defaultOpen(filePath, flags, ...args);
            if (
              filePath !== manifestPath ||
              (flags & fileConstants.O_EXCL) === 0 ||
              publicationFailureInjected
            ) {
              return handle;
            }
            publicationFailureInjected = true;
            return {
              close: handle.close.bind(handle),
              stat: handle.stat.bind(handle),
              writeFile: handle.writeFile.bind(handle),
              sync: async () => {
                throw new Error("injected post-publication rollback");
              },
            };
          },
        },
      },
    );

    expect(injected).toBe(false);
    expect(injectedAt).toBeUndefined();
    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MIGRATION_RUNTIME");
    expect((await manifest(project)).schema_version).toBe(1);
    expect(result.data.live_recovery_paths).toContain(manifestPath);
    expect((await lstat(result.data.lock_path)).isDirectory()).toBe(true);
  });

  test("does not restore a concurrently replaced migration backup", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const backupPath = path.join(
      project,
      "reports/backups/2026-01-02T03-04-05.000Z/fde-project.yaml",
    );
    const concurrent = "concurrent backup replacement\n";
    let injected = false;

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath === manifestPath &&
              (flags & fileConstants.O_EXCL) !== 0 &&
              !injected
            ) {
              injected = true;
              await writeFile(backupPath, concurrent);
              throw new Error(
                "injected publication failure after backup replacement",
              );
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0].code).toBe("B_MIGRATION_ROLLBACK_FAILED");
    expect(await readFile(manifestPath, "utf8")).toBe(concurrent);
    await expect(lstat(backupPath)).rejects.toMatchObject({ code: "ENOENT" });
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents).toContain(concurrent);
  });

  test("restores v0 when injected rename commits and then reports failure", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const manifestPath = path.join(project, "fde-project.yaml");
    const before = await readFile(manifestPath, "utf8");
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        rename: async (source, target) => {
          await rename(source, target);
          const error = new Error("injected post-commit failure");
          error.code = "EIO";
          throw error;
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(await readFile(manifestPath, "utf8")).toBe(before);
    await expect(lstat(path.join(project, "reports"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("reports uncertain preservation and retains backup when rollback fails", async () => {
    const project = path.join(temporaryRoot, "old-schema-project");
    await copyFixture("old-schema-project", project);
    const preview = await resumeProject({ project }, { clock: FIXED_CLOCK });
    const backupPath = path.join(
      project,
      "reports/backups/2026-01-02T03-04-05.000Z",
    );

    const result = await resumeProject(
      {
        project,
        confirmMigration: preview.data.preview_sha256,
      },
      {
        clock: FIXED_CLOCK,
        fs: {
          open: async (filePath, flags, ...args) => {
            if (
              filePath.endsWith("fde-project.yaml") &&
              (flags & fileConstants.O_EXCL) !== 0
            ) {
              const error = new Error("injected restore failure");
              error.code = "EIO";
              throw error;
            }
            return defaultOpen(filePath, flags, ...args);
          },
        },
        rename: async (source, target) => {
          await rename(source, target);
          throw new Error("injected post-commit failure");
        },
      },
    );

    expect(result.exitCode).toBe(3);
    expect(result.issues[0]).toMatchObject({
      code: "B_MIGRATION_ROLLBACK_FAILED",
      message: expect.stringMatching(/preservation is uncertain/iu),
    });
    expect(result.data.backup_path).toBe(backupPath);
    const retainedContents = await Promise.all(
      result.data.quarantine_paths.map((quarantinePath) =>
        readFile(quarantinePath, "utf8"),
      ),
    );
    expect(retainedContents.some((value) => value.includes("schema_version: 0")))
      .toBe(true);
  });
});
