import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { spawnCommand } from "../../src/assembly/cli-runner.js";
import { main as installMain } from "../../src/commands/install.js";
import {
  capturePathState,
  samePathState,
} from "../../src/install/path-state.js";
import {
  inspectRuntimeBundle,
} from "../../src/repository/runtime-bundle.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const execFileAsync = promisify(execFile);
const COMMANDS = [
  "check-repository",
  "init-project",
  "inspect-octopus-cli",
  "install",
  "package-delivery",
  "render-assemble-script",
  "render-dryrun-script",
  "test-example",
  "validate-forward-test",
  "validate-project",
];
let temporaryRoot;

async function executeFile(command, args, options) {
  try {
    const result = await execFileAsync(command, args, options);
    return { exitCode: 0, stderr: result.stderr, stdout: result.stdout };
  } catch (error) {
    return {
      exitCode: error.code,
      stderr: error.stderr,
      stdout: error.stdout,
    };
  }
}

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-runtime-bundle-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe("installed copy runtime bundle", () => {
  it("executes every installed command help without source or dependencies", async () => {
    const home = path.join(temporaryRoot, "home");
    const xdg = path.join(temporaryRoot, "xdg");
    const chunks = [];
    const exitCode = await installMain([
      "--target",
      "codex",
      "--mode",
      "copy",
    ], {
      env: { HOME: home, XDG_CONFIG_HOME: xdg },
      sourceRoot: ROOT,
      writeStdout: (chunk) => chunks.push(chunk),
    });
    expect(exitCode, chunks.join("")).toBe(0);
    const installed = path.join(
      home,
      ".agents/skills/design-aiworker-solutions",
    );
    expect(await readFile(path.join(installed, "SKILL.md"), "utf8"))
      .toContain("Design AIWorker Solutions");
    const before = await capturePathState(installed);

    for (const command of COMMANDS) {
      const result = await spawnCommand(
        path.join(installed, "scripts", command),
        ["--help"],
        { shell: false },
      );
      expect(
        result.exitCode,
        `${command}: ${result.stderr.toString("utf8")}`,
      ).toBe(0);
      expect(() => JSON.parse(result.stdout.toString("utf8"))).not.toThrow();
    }
    expect(samePathState(before, await capturePathState(installed))).toBe(true);
  });

  it("runs the installed Golden validation and creates a verified ZIP from a clean copy manifest", async () => {
    const home = path.join(temporaryRoot, "golden-home");
    const xdg = path.join(temporaryRoot, "golden-xdg");
    const kitCommit = "a".repeat(40);
    const chunks = [];
    const exitCode = await installMain([
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
      writeStdout: (chunk) => chunks.push(chunk),
    });
    expect(exitCode, chunks.join("")).toBe(0);

    const installed = path.join(
      home,
      ".agents/skills/design-aiworker-solutions",
    );
    expect(await readFile(
      path.join(
        installed,
        "assets/examples/lead-collector/package-scan-policy.yaml",
      ),
      "utf8",
    )).toContain("schema_version: 1");

    const execution = await executeFile(
      path.join(installed, "scripts/test-example"),
      ["--example", "lead-collector"],
      {
        env: {
          ...process.env,
          HOME: home,
          XDG_CONFIG_HOME: xdg,
        },
      },
    );
    expect(execution.exitCode, execution.stderr).toBe(0);
    const result = JSON.parse(execution.stdout);
    expect(result).toMatchObject({
      exitCode: 0,
      issues: [],
      data: {
        expected_files: 23,
        matched_files: 23,
        blockers: 0,
        package_boundary: {
          verified: true,
          exact_paths: true,
          kit_commit: kitCommit,
          package_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      },
    });

    await mkdir(path.join(installed, ".git"));
    await writeFile(path.join(installed, ".git/HEAD"), `${"c".repeat(40)}\n`);
    const injectedCheckout = await executeFile(
      path.join(installed, "scripts/test-example"),
      ["--example", "lead-collector"],
      {
        env: {
          ...process.env,
          HOME: home,
          XDG_CONFIG_HOME: xdg,
        },
      },
    );
    expect(injectedCheckout.exitCode).toBe(3);
    expect(JSON.parse(injectedCheckout.stdout)).toMatchObject({
      exitCode: 3,
      issues: [expect.objectContaining({
        code: "B_PACKAGE_RUNTIME",
        details: expect.objectContaining({
          error: expect.stringMatching(/installed copy.*\.git/iu),
        }),
      })],
    });
  }, 30_000);

  it("runs Golden packaging through a real clean symlink install and rejects later source dirtiness", async () => {
    const source = path.join(temporaryRoot, "clean-source");
    const home = path.join(temporaryRoot, "symlink-home");
    const xdg = path.join(temporaryRoot, "symlink-xdg");
    await mkdir(source);
    for (const relativePath of ["LICENSE", "SKILL.md"]) {
      await cp(path.join(ROOT, relativePath), path.join(source, relativePath));
    }
    for (const relativePath of [
      "agents",
      "assets",
      "catalog",
      "references",
      "schemas",
      "scripts",
    ]) {
      await cp(path.join(ROOT, relativePath), path.join(source, relativePath), {
        recursive: true,
      });
    }
    await execFileAsync("git", ["init", "--quiet"], { cwd: source });
    await execFileAsync(
      "git",
      ["config", "user.name", "FDE Test"],
      { cwd: source },
    );
    await execFileAsync(
      "git",
      [
        "config",
        "user.email",
        ["fde-test", "@", "example.invalid"].join(""),
      ],
      { cwd: source },
    );
    await execFileAsync("git", ["add", "."], { cwd: source });
    await execFileAsync(
      "git",
      ["commit", "--quiet", "-m", "clean install source"],
      { cwd: source },
    );

    const chunks = [];
    const exitCode = await installMain([
      "--target",
      "codex",
    ], {
      env: { HOME: home, XDG_CONFIG_HOME: xdg },
      sourceRoot: source,
      writeStdout: (chunk) => chunks.push(chunk),
    });
    expect(exitCode, chunks.join("")).toBe(0);
    const installed = path.join(
      home,
      ".agents/skills/design-aiworker-solutions",
    );
    const clean = await executeFile(
      path.join(installed, "scripts/test-example"),
      ["--example", "lead-collector"],
      {
        env: {
          ...process.env,
          HOME: home,
          XDG_CONFIG_HOME: xdg,
        },
      },
    );
    expect(clean.exitCode, clean.stdout).toBe(0);
    expect(JSON.parse(clean.stdout)).toMatchObject({
      exitCode: 0,
      data: {
        expected_files: 23,
        matched_files: 23,
        package_boundary: {
          verified: true,
          package_sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        },
      },
    });

    await writeFile(
      path.join(source, "SKILL.md"),
      `${await readFile(path.join(source, "SKILL.md"), "utf8")}\n`,
    );
    const dirty = await executeFile(
      path.join(installed, "scripts/test-example"),
      ["--example", "lead-collector"],
      {
        env: {
          ...process.env,
          HOME: home,
          XDG_CONFIG_HOME: xdg,
        },
      },
    );
    expect(dirty.exitCode).toBe(3);
    expect(JSON.parse(dirty.stdout).issues).toContainEqual(
      expect.objectContaining({ code: "B_PACKAGE_RUNTIME" }),
    );
  }, 30_000);

  it("detects changed runtime inputs and changed bundle bytes", async () => {
    expect(await inspectRuntimeBundle(ROOT)).toEqual({
      issues: [],
      valid: true,
    });

    const sourceChanged = path.join(temporaryRoot, "source-changed");
    await cp(ROOT, sourceChanged, {
      recursive: true,
      filter: (sourcePath) =>
        !sourcePath.includes(`${path.sep}.git${path.sep}`) &&
        !sourcePath.includes(`${path.sep}node_modules${path.sep}`),
    });
    await writeFile(
      path.join(sourceChanged, "src/shared/result.js"),
      `${await readFile(path.join(sourceChanged, "src/shared/result.js"), "utf8")}\n`,
    );
    expect((await inspectRuntimeBundle(sourceChanged)).issues.map(({ code }) =>
      code)).toContain("B_RUNTIME_BUNDLE_STALE");

    const bundleChanged = path.join(temporaryRoot, "bundle-changed");
    await cp(sourceChanged, bundleChanged, { recursive: true });
    await cp(
      path.join(ROOT, "src/shared/result.js"),
      path.join(bundleChanged, "src/shared/result.js"),
    );
    await writeFile(
      path.join(bundleChanged, "scripts/runtime/aiworker-fde-runtime.mjs"),
      "tampered\n",
    );
    expect((await inspectRuntimeBundle(bundleChanged)).issues.map(({ code }) =>
      code)).toContain("B_RUNTIME_BUNDLE_HASH");
  });

  it("refuses installation from stale or tampered runtime sources", async () => {
    for (const mutation of ["source", "bundle"]) {
      const candidate = path.join(temporaryRoot, mutation);
      await cp(ROOT, candidate, {
        recursive: true,
        filter: (sourcePath) =>
          !sourcePath.includes(`${path.sep}.git${path.sep}`) &&
          !sourcePath.includes(`${path.sep}node_modules${path.sep}`),
      });
      const changed = mutation === "source"
        ? path.join(candidate, "src/shared/result.js")
        : path.join(candidate, "scripts/runtime/aiworker-fde-runtime.mjs");
      await writeFile(changed, `${await readFile(changed, "utf8")}\n`);
      const chunks = [];
      const home = path.join(temporaryRoot, `${mutation}-home`);
      const exitCode = await installMain(["--target", "codex"], {
        env: { HOME: home, XDG_CONFIG_HOME: path.join(home, ".config") },
        sourceRoot: candidate,
        writeStdout: (chunk) => chunks.push(chunk),
      });
      expect(exitCode).toBe(1);
      expect(JSON.parse(chunks.join("")).issues.map(({ code }) => code))
        .toContain(
          mutation === "source"
            ? "B_RUNTIME_BUNDLE_STALE"
            : "B_RUNTIME_BUNDLE_HASH",
        );
    }
  });

  it("keeps launchers self-contained and free of repository source paths", async () => {
    for (const command of COMMANDS) {
      const launcher = await readFile(path.join(ROOT, "scripts", command), "utf8");
      expect(launcher).toContain("runtime/aiworker-fde-runtime.mjs");
      expect(launcher).not.toContain("../src/");
      expect(launcher).not.toContain("node_modules");
    }
  });
});
