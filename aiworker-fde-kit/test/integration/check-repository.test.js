import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, test, vi } from "vitest";

import { main } from "../../src/commands/check-repository.js";

const commandPath = fileURLToPath(
  new URL("../../src/commands/check-repository.js", import.meta.url),
);
const temporaryRoots = [];

async function createFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "aiworker-fde-kit-"));
  temporaryRoots.push(root);

  await mkdir(path.join(root, "docs"), { recursive: true });
  await mkdir(path.join(root, "schemas"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await writeFile(path.join(root, "SKILL.md"), "# Skill\n\n[Guide](docs/guide.md)\n");
  await writeFile(path.join(root, "docs", "guide.md"), "# Guide\n");
  await writeFile(
    path.join(root, "schemas", "example.schema.json"),
    JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
    }),
  );
  await writeFile(path.join(root, "scripts", "example"), "#!/bin/sh\nexit 0\n", {
    mode: 0o755,
  });

  return root;
}

async function createOutsideFile(name, contents = "# Outside\n", mode = 0o644) {
  const outsideRoot = await mkdtemp(path.join(tmpdir(), "aiworker-outside-"));
  temporaryRoots.push(outsideRoot);
  const filePath = path.join(outsideRoot, name);
  await writeFile(filePath, contents, { mode });
  return filePath;
}

function runCommand(root, args = []) {
  const completed = spawnSync(process.execPath, [commandPath, ...args], {
    cwd: root,
    encoding: "utf8",
  });

  return {
    status: completed.status,
    stderr: completed.stderr,
    result: JSON.parse(completed.stdout),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("check-repository command", () => {
  test("reports a missing root SKILL.md", async () => {
    const root = await createFixture();
    await unlink(path.join(root, "SKILL.md"));

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_SKILL_MISSING",
    );
  });

  test("reports a root SKILL.md that is not a regular file", async () => {
    const root = await createFixture();
    await unlink(path.join(root, "SKILL.md"));
    await mkdir(path.join(root, "SKILL.md"));

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_SKILL_MISSING",
    );
  });

  test("reports scripts that are not mode 0755", async () => {
    const root = await createFixture();
    await chmod(path.join(root, "scripts", "example"), 0o644);

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_SCRIPT_MODE",
    );
  });

  test("rejects dangling symlinks beneath scripts", async () => {
    const root = await createFixture();
    await symlink("missing-launcher", path.join(root, "scripts", "dangling"));

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_SCRIPT_SYMLINK",
        path: "scripts/dangling",
      }),
    );
  });

  test("rejects script symlinks that target files outside the repository", async () => {
    const root = await createFixture();
    const outsideScript = await createOutsideFile(
      "external-launcher",
      "#!/bin/sh\nexit 0\n",
      0o755,
    );
    await symlink(outsideScript, path.join(root, "scripts", "external"));

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_SCRIPT_SYMLINK",
        path: "scripts/external",
      }),
    );
  });

  test("reports JSON Schemas that Ajv cannot compile", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "schemas", "example.schema.json"),
      JSON.stringify({ type: "not-a-json-schema-type" }),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_SCHEMA_INVALID",
    );
  });

  test("compiles references between repository schemas regardless of file order", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "schemas", "a.schema.json"),
      JSON.stringify({ $ref: "https://example.com/z.schema.json" }),
    );
    await writeFile(
      path.join(root, "schemas", "z.schema.json"),
      JSON.stringify({
        $id: "https://example.com/z.schema.json",
        type: "string",
      }),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.result.issues).toEqual([]);
  });

  test("rejects schema symlinks that target files inside the repository", async () => {
    const root = await createFixture();
    await symlink(
      "example.schema.json",
      path.join(root, "schemas", "internal.schema.json"),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_SCHEMA_SYMLINK",
        path: "schemas/internal.schema.json",
      }),
    );
  });

  test("rejects schema symlinks that target files outside the repository", async () => {
    const root = await createFixture();
    const outsideSchema = await createOutsideFile(
      "outside.schema.json",
      JSON.stringify({ type: "object" }),
    );
    await symlink(
      outsideSchema,
      path.join(root, "schemas", "external.schema.json"),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_SCHEMA_SYMLINK",
        path: "schemas/external.schema.json",
      }),
    );
  });

  test("rejects dangling schema symlinks", async () => {
    const root = await createFixture();
    await symlink(
      "missing.schema.json",
      path.join(root, "schemas", "dangling.schema.json"),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_SCHEMA_SYMLINK",
        path: "schemas/dangling.schema.json",
      }),
    );
  });

  test("reports broken relative Markdown links", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "SKILL.md"), "[Missing](docs/missing.md)\n");

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_LINK_BROKEN",
    );
  });

  test("resolves an inline Markdown link without treating its title as path", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "SKILL.md"),
      '[Guide](docs/guide.md "Guide title")\n',
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.result.issues).toEqual([]);
  });

  test("reports broken reference-style Markdown links", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "SKILL.md"),
      "[Guide][guide]\n\n[guide]: docs/missing.md \"Guide title\"\n",
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_LINK_BROKEN",
    );
  });

  test("uses the first duplicate reference definition when it is broken", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "SKILL.md"),
      [
        "[Guide][guide]",
        "",
        "[guide]: docs/missing.md",
        "[guide]: docs/guide.md",
        "",
      ].join("\n"),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues.map(({ code }) => code)).toContain(
      "B_LINK_BROKEN",
    );
  });

  test("uses the first duplicate reference definition when it exists", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "SKILL.md"),
      [
        "[Guide][guide]",
        "",
        "[guide]: docs/guide.md",
        "[guide]: docs/missing.md",
        "",
      ].join("\n"),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.result.issues).toEqual([]);
  });

  test("ignores link-like text in fenced code", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "SKILL.md"),
      "# Skill\n\n```md\n[Missing](docs/missing.md)\n```\n",
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.result.issues).toEqual([]);
  });

  test("ignores links inside HTML comments", async () => {
    const root = await createFixture();
    await writeFile(
      path.join(root, "SKILL.md"),
      "# Skill\n\n<!-- [Missing](docs/missing.md) -->\n",
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.result.issues).toEqual([]);
  });

  test("accepts escaped and balanced parentheses in local link destinations", async () => {
    const root = await createFixture();
    await writeFile(path.join(root, "docs", "guide_(v1).md"), "# Guide\n");
    await writeFile(
      path.join(root, "SKILL.md"),
      [
        "[Balanced](docs/guide_(v1).md)",
        "[Escaped](docs/guide_\\(v1\\).md)",
        "",
      ].join("\n"),
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.result.issues).toEqual([]);
  });

  test("rejects lexical link escapes even when the host file exists", async () => {
    const root = await createFixture();
    const outsideFile = await createOutsideFile("outside.md");
    const relativeTarget = path.relative(root, outsideFile).split(path.sep).join("/");
    await writeFile(
      path.join(root, "SKILL.md"),
      `[Outside](${relativeTarget})\n`,
    );

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_LINK_OUTSIDE_ROOT",
        details: expect.objectContaining({ reason: "lexical-escape" }),
      }),
    );
  });

  test("rejects in-repository links through symlinks that resolve outside", async () => {
    const root = await createFixture();
    const outsideFile = await createOutsideFile("outside.md");
    await symlink(outsideFile, path.join(root, "docs", "external.md"));
    await writeFile(path.join(root, "SKILL.md"), "[Outside](docs/external.md)\n");

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_LINK_OUTSIDE_ROOT",
        details: expect.objectContaining({ reason: "canonical-escape" }),
      }),
    );
  });

  test("reports local links through dangling symlinks as broken", async () => {
    const root = await createFixture();
    await symlink("missing.md", path.join(root, "docs", "dangling.md"));
    await writeFile(path.join(root, "SKILL.md"), "[Missing](docs/dangling.md)\n");

    const completed = runCommand(root);

    expect(completed.status).toBe(1);
    expect(completed.result.issues).toContainEqual(
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_LINK_BROKEN",
        path: "SKILL.md",
      }),
    );
  });

  test("accepts a valid minimal repository", async () => {
    const root = await createFixture();

    const completed = runCommand(root);

    expect(completed.status).toBe(0);
    expect(completed.stderr).toBe("");
    expect(completed.result).toMatchObject({ exitCode: 0, issues: [] });
  });

  test("--help returns JSON usage and exits zero", async () => {
    const root = await createFixture();

    const completed = runCommand(root, ["--help"]);

    expect(completed.status).toBe(0);
    expect(completed.result.exitCode).toBe(0);
    expect(completed.result.data.usage).toContain("Usage:");
  });

  test("unknown arguments exit two", async () => {
    const root = await createFixture();

    const completed = runCommand(root, ["--unknown"]);

    expect(completed.status).toBe(2);
    expect(completed.result.exitCode).toBe(2);
  });

  test("runtime failures exit three and keep stdout valid JSON", async () => {
    const root = await createFixture();
    let stdout = "";

    const exitCode = await main([], {
      root,
      inspectRepository: async () => {
        throw new Error("injected failure");
      },
      writeStdout: (value) => {
        stdout += value;
      },
    });

    expect(exitCode).toBe(3);
    expect(JSON.parse(stdout)).toMatchObject({
      exitCode: 3,
      issues: [{ code: "B_RUNTIME_ERROR" }],
    });
  });

  test("dependency loading failures before inspection exit three without a stack trace", async () => {
    const root = await createFixture();
    const inspectRepository = vi.fn();
    const writeStderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let stdout = "";

    const exitCode = await main([], {
      root,
      loadDependencies: async () => {
        throw new Error("dependency unavailable");
      },
      inspectRepository,
      writeStdout: (value) => {
        stdout += value;
      },
    });

    expect(exitCode).toBe(3);
    expect(JSON.parse(stdout)).toMatchObject({
      exitCode: 3,
      issues: [{ code: "B_RUNTIME_ERROR" }],
    });
    expect(inspectRepository).not.toHaveBeenCalled();
    expect(writeStderr).not.toHaveBeenCalled();
  });
});
