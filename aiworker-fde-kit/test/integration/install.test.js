import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { main } from "../../src/commands/install.js";

let temporaryRoot;
let home;
let xdg;
let source;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-install-command-"));
  home = path.join(temporaryRoot, "home");
  xdg = path.join(temporaryRoot, "xdg");
  source = path.join(temporaryRoot, "source");
  await mkdir(path.join(source, "agents"), { recursive: true });
  await writeFile(path.join(source, "SKILL.md"), "# Skill\n");
  await writeFile(path.join(source, "agents/openai.yaml"), "interface: {}\n");
  await mkdir(path.join(source, "docs"), { recursive: true });
  await writeFile(path.join(source, "docs/private.md"), "excluded\n");
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function invoke(args, options = {}) {
  const chunks = [];
  const exitCode = await main(args, {
    env: { HOME: home, XDG_CONFIG_HOME: xdg },
    inspectRuntimeBundle: async () => ({ issues: [], valid: true }),
    sourceRoot: source,
    writeStdout: (chunk) => chunks.push(chunk),
    ...options,
  });
  expect(chunks).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

function codexTarget() {
  return path.join(home, ".agents/skills/design-aiworker-solutions");
}

function claudeTarget() {
  return path.join(home, ".claude/skills/design-aiworker-solutions");
}

function manifestPath(target = "codex") {
  return path.join(
    xdg,
    `aiworker-fde-kit/installations/${target}.json`,
  );
}

async function capture(pathValue) {
  try {
    const stat = await lstat(pathValue);
    return {
      bytes: stat.isFile() ? await readFile(pathValue) : null,
      link: stat.isSymbolicLink() ? await readlink(pathValue) : null,
      mode: stat.mode & 0o777,
      type: stat.isFile() ? "file" : stat.isSymbolicLink() ? "symlink" : "dir",
    };
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

describe("install command", () => {
  it("supports exact help and argument exit boundaries without writes", async () => {
    const help = await invoke(["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.result.data.usage).toBe(
      "Usage: install --target codex|claude-code|both [--mode symlink|copy] [--update | --replace]",
    );
    expect(await readdir(temporaryRoot)).toEqual(["source"]);

    for (const args of [
      [],
      ["--target"],
      ["--target", "other"],
      ["--target", "codex", "--mode", "other"],
      ["--target", "codex", "--update", "--replace"],
      ["--target", "codex", "--unknown"],
      ["--help", "--target", "codex"],
    ]) {
      expect((await invoke(args)).exitCode, args.join(" ")).toBe(2);
    }
    expect(await capture(codexTarget())).toBeNull();
    expect(await capture(manifestPath())).toBeNull();
  });

  it("uses HOME/.config when XDG_CONFIG_HOME is empty", async () => {
    const response = await invoke(["--target", "codex"], {
      env: { HOME: home, XDG_CONFIG_HOME: "" },
    });
    expect(response.exitCode).toBe(0);
    expect(await capture(path.join(
      home,
      ".config/aiworker-fde-kit/installations/codex.json",
    ))).not.toBeNull();
  });

  it.each(["file", "symlink"])(
    "never overwrites a concurrent %s at an expected-absent target",
    async (kind) => {
      const response = await invoke(["--target", "codex"], {
        transactionHooks: {
          beforeTargetPublish: async ({ targetPaths }) => {
            await mkdir(path.dirname(targetPaths.codex), { recursive: true });
            if (kind === "file") {
              await writeFile(targetPaths.codex, "foreign\n");
            } else {
              await symlink(source, targetPaths.codex);
            }
          },
        },
      });
      expect(response.exitCode).toBe(3);
      const current = await capture(codexTarget());
      expect(current.type).toBe(kind);
      if (kind === "file") expect(current.bytes.toString()).toBe("foreign\n");
      expect(await capture(manifestPath())).toBeNull();
    },
  );

  it("never overwrites a concurrent manifest publish or restore target", async () => {
    const publish = await invoke(["--target", "codex"], {
      transactionHooks: {
        beforeManifestPublish: async ({ manifestPaths }) => {
          await writeFile(manifestPaths.codex, "foreign manifest\n");
        },
      },
    });
    expect(publish.exitCode).toBe(3);
    expect(await readFile(manifestPath(), "utf8")).toBe("foreign manifest\n");
    expect(await capture(codexTarget())).toBeNull();

    await rm(manifestPath());
    await mkdir(codexTarget(), { recursive: true });
    await writeFile(path.join(codexTarget(), "old"), "old\n");
    const restore = await invoke([
      "--target", "codex", "--mode", "copy", "--replace",
    ], {
      transactionHooks: {
        discoveryCheck: () => {
          throw new Error("rollback");
        },
        beforeRestore: async ({ livePath }) => {
          if (livePath === codexTarget()) {
            await symlink(source, livePath);
          }
        },
      },
    });
    expect(restore.exitCode).toBe(3);
    expect((await capture(codexTarget())).type).toBe("symlink");
    expect(restore.result.data.recovery_paths).toEqual(
      expect.arrayContaining([expect.stringMatching(/target-old/u)]),
    );
  });

  it("registers a published target before post-publish capture can fail", async () => {
    const response = await invoke(["--target", "codex", "--mode", "copy"], {
      transactionHooks: {
        afterTargetPublish: () => {
          throw new Error("capture injection");
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await capture(codexTarget())).toBeNull();
    expect(await capture(manifestPath())).toBeNull();
  });

  it("quarantines and reports a file added to a published target", async () => {
    const response = await invoke(["--target", "codex", "--mode", "copy"], {
      transactionHooks: {
        afterTargetPublish: async ({ targetPath }) => {
          await writeFile(path.join(targetPath, "foreign"), "added\n");
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await capture(codexTarget())).toBeNull();
    const recoveryPath = response.result.data.recovery_paths.find((candidate) =>
      path.dirname(candidate) === path.dirname(codexTarget())
    );
    expect(recoveryPath).toBeDefined();
    expect(await readFile(path.join(recoveryPath, "foreign"), "utf8"))
      .toBe("added\n");
  });

  it("quarantines and reports an in-place edit in a published target", async () => {
    const response = await invoke(["--target", "codex", "--mode", "copy"], {
      transactionHooks: {
        afterTargetPublish: async ({ targetPath }) => {
          await writeFile(path.join(targetPath, "SKILL.md"), "# edited\n");
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await capture(codexTarget())).toBeNull();
    const recoveryPath = response.result.data.recovery_paths.find((candidate) =>
      path.dirname(candidate) === path.dirname(codexTarget())
    );
    expect(recoveryPath).toBeDefined();
    expect(await readFile(path.join(recoveryPath, "SKILL.md"), "utf8"))
      .toBe("# edited\n");
  });

  it("quarantines and reports an in-place edit to a published manifest", async () => {
    const response = await invoke(["--target", "codex"], {
      transactionHooks: {
        afterManifestPublish: async ({ manifestPath: publishedManifest }) => {
          await writeFile(publishedManifest, "foreign manifest\n");
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await capture(codexTarget())).toBeNull();
    expect(await capture(manifestPath())).toBeNull();
    const recoveryPath = response.result.data.recovery_paths.find((candidate) =>
      path.dirname(candidate) === path.dirname(manifestPath())
    );
    expect(recoveryPath).toBeDefined();
    expect(await readFile(recoveryPath, "utf8")).toBe("foreign manifest\n");
  });

  it("rejects source/target/manifest ancestry overlap without writes", async () => {
    const sourceInsideTarget = path.join(
      home,
      ".agents/skills/design-aiworker-solutions/repository",
    );
    await mkdir(sourceInsideTarget, { recursive: true });
    await writeFile(path.join(sourceInsideTarget, "SKILL.md"), "# source\n");
    const before = await readFile(path.join(sourceInsideTarget, "SKILL.md"));
    const targetAncestor = await invoke([
      "--target", "codex", "--replace",
    ], { sourceRoot: sourceInsideTarget });
    expect(targetAncestor.exitCode).toBe(1);
    expect(targetAncestor.result.issues.map(({ code }) => code))
      .toContain("B_INSTALL_PATH_OVERLAP");
    expect(await readFile(path.join(sourceInsideTarget, "SKILL.md")))
      .toEqual(before);

    const sourceAncestor = await invoke(["--target", "claude-code"], {
      env: { HOME: source, XDG_CONFIG_HOME: xdg },
    });
    expect(sourceAncestor.exitCode).toBe(1);
    expect(sourceAncestor.result.issues.map(({ code }) => code))
      .toContain("B_INSTALL_PATH_OVERLAP");

    const manifestOverlap = await invoke(["--target", "codex"], {
      env: { HOME: home, XDG_CONFIG_HOME: codexTarget() },
    });
    expect(manifestOverlap.exitCode).toBe(1);
    expect(manifestOverlap.result.issues.map(({ code }) => code))
      .toContain("B_INSTALL_PATH_OVERLAP");
  });

  it("installs symlinks by default for codex, claude-code, and both idempotently", async () => {
    const codex = await invoke(["--target", "codex"]);
    expect(codex.exitCode).toBe(0);
    expect(await readlink(codexTarget())).toBe(
      await import("node:fs/promises").then(({ realpath }) => realpath(source)),
    );
    expect((await invoke(["--target", "codex"])).result.data.action)
      .toBe("noop");

    expect((await invoke(["--target", "both"])).exitCode).toBe(0);
    expect(await readlink(claudeTarget())).toBe(
      await import("node:fs/promises").then(({ realpath }) => realpath(source)),
    );
    expect((await invoke(["--target", "claude-code"])).result.data.action)
      .toBe("noop");

    await rm(codexTarget());
    await rm(claudeTarget());
    await rm(manifestPath("codex"));
    await rm(manifestPath("claude-code"));
    const both = await invoke(["--target", "both"]);
    expect(both.exitCode).toBe(0);
    const { realpath } = await import("node:fs/promises");
    expect(await readlink(codexTarget())).toBe(await realpath(source));
    expect(await readlink(claudeTarget())).toBe(await realpath(source));
  });

  it("copies only canonical Skill files and updates an unmodified install", async () => {
    expect((await invoke(["--target", "codex", "--mode", "copy"])).exitCode)
      .toBe(0);
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# Skill\n");
    expect(await capture(path.join(codexTarget(), "docs/private.md"))).toBeNull();
    expect(await capture(path.join(codexTarget(), "package.json"))).toBeNull();
    expect(await capture(path.join(codexTarget(), "src"))).toBeNull();

    await writeFile(path.join(source, "SKILL.md"), "# Skill v2\n");
    expect((await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ])).exitCode).toBe(0);
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# Skill v2\n");
  });

  it("does not overwrite user changes without replace", async () => {
    await invoke(["--target", "codex", "--mode", "copy"]);
    await writeFile(path.join(codexTarget(), "SKILL.md"), "# user edit\n");
    expect((await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ])).exitCode).toBe(1);
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# user edit\n");

    expect((await invoke([
      "--target", "codex", "--mode", "copy", "--replace",
    ])).exitCode).toBe(0);
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# Skill\n");
  });

  it("rejects a manifest whose embedded snapshot hash was tampered", async () => {
    await invoke(["--target", "codex", "--mode", "copy"]);
    const manifest = JSON.parse(await readFile(manifestPath(), "utf8"));
    manifest.source_tree_hash = "0".repeat(64);
    await writeFile(manifestPath(), `${JSON.stringify(manifest)}\n`);

    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ]);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues[0].code).toBe("B_INSTALL_MANIFEST_INVALID");
  });

  it("writes two exact manifests and warns when Git metadata is unavailable", async () => {
    const response = await invoke(["--target", "both"], {
      clock: () => new Date("2026-07-25T01:02:03.000Z"),
    });
    expect(response.exitCode).toBe(0);
    expect(response.result.issues.map(({ code }) => code))
      .toContain("W_INSTALL_GIT_UNAVAILABLE");
    const { realpath } = await import("node:fs/promises");
    for (const target of ["codex", "claude-code"]) {
      const manifest = JSON.parse(
        await readFile(manifestPath(target), "utf8"),
      );
      expect(Object.keys(manifest)).toEqual([
        "schema_version",
        "target",
        "mode",
        "target_path",
        "source_path",
        "source_commit",
        "source_dirty",
        "source_tree_hash",
        "installed_at",
        "files",
      ]);
      expect(manifest).toMatchObject({
        schema_version: 1,
        target,
        mode: "symlink",
        target_path: target === "codex" ? codexTarget() : claudeTarget(),
        source_path: await realpath(source),
        source_commit: null,
        source_dirty: true,
        source_tree_hash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        installed_at: "2026-07-25T01:02:03.000Z",
        files: expect.objectContaining({
          "SKILL.md": expect.objectContaining({
            mode: expect.stringMatching(/^0[0-7]{3}$/u),
            type: "file",
          }),
        }),
      });
    }
  });

  it("records dirty Git state and warns without blocking", async () => {
    const sha = "a".repeat(40);
    const response = await invoke(["--target", "codex"], {
      runGit: async (args) => args.includes("rev-parse")
        ? { stdout: `${sha}\n` }
        : { stdout: " M SKILL.md\n" },
    });
    expect(response.exitCode).toBe(0);
    expect(response.result.issues.map(({ code }) => code))
      .toContain("W_INSTALL_SOURCE_DIRTY");
    expect(JSON.parse(await readFile(manifestPath(), "utf8")))
      .toMatchObject({ source_commit: sha, source_dirty: true });
  });

  it("warns on a non-descendant copy update without blocking", async () => {
    const firstSha = "a".repeat(40);
    const secondSha = "b".repeat(40);
    await invoke(["--target", "codex", "--mode", "copy"], {
      sourceMetadata: {
        source_commit: firstSha,
        source_dirty: false,
        issues: [],
        runGit: async () => ({ stdout: "" }),
      },
    });
    await writeFile(path.join(source, "SKILL.md"), "# v2\n");
    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ], {
      sourceMetadata: {
        source_commit: secondSha,
        source_dirty: false,
        issues: [],
        runGit: async () => {
          throw new Error("not ancestor");
        },
      },
    });
    expect(response.exitCode).toBe(0);
    expect(response.result.issues.map(({ code }) => code))
      .toContain("W_INSTALL_NON_DESCENDANT");
  });

  it("keeps a same-source symlink idempotent after source changes", async () => {
    await invoke(["--target", "codex"]);
    const targetBefore = await lstat(codexTarget());
    await writeFile(path.join(source, "SKILL.md"), "# live change\n");

    const check = await invoke(["--target", "codex"]);
    const update = await invoke(["--target", "codex", "--update"]);
    expect(check.exitCode).toBe(0);
    expect(update.exitCode).toBe(0);
    expect(check.result.data.action).toBe("noop");
    expect(update.result.data.action).toBe("noop");
    expect(update.result.issues.map(({ code }) => code))
      .toContain("W_INSTALL_SYMLINK_SOURCE_CHANGED");
    expect((await lstat(codexTarget())).ino).toBe(targetBefore.ino);
  });

  it("uses target-specific discovery requirements", async () => {
    await rm(path.join(source, "agents"), { recursive: true });
    const codex = await invoke(["--target", "codex"]);
    expect(codex.exitCode).toBe(3);
    expect(await capture(codexTarget())).toBeNull();
    expect(await capture(manifestPath("codex"))).toBeNull();

    const claude = await invoke(["--target", "claude-code"]);
    expect(claude.exitCode).toBe(0);
    expect(await readlink(claudeTarget())).toBe(
      await import("node:fs/promises").then(({ realpath }) => realpath(source)),
    );
  });

  it("returns business conflicts as 1 and filesystem/runtime failures as 3", async () => {
    await mkdir(codexTarget(), { recursive: true });
    await writeFile(path.join(codexTarget(), "foreign"), "foreign\n");
    const conflict = await invoke(["--target", "codex"]);
    expect(conflict.exitCode).toBe(1);
    expect(await readFile(path.join(codexTarget(), "foreign"), "utf8"))
      .toBe("foreign\n");

    const runtime = await invoke(["--target", "claude-code"], {
      transactionHooks: {
        prepare: () => {
          throw Object.assign(new Error("injected"), { code: "EACCES" });
        },
      },
    });
    expect(runtime.exitCode).toBe(3);
  });

  it.each(["prepare", "targetCommit", "manifestCommit", "discoveryCheck"])(
    "rolls back exact bytes and modes when %s fails",
    async (failurePoint) => {
      await mkdir(codexTarget(), { recursive: true });
      const oldSkill = path.join(codexTarget(), "SKILL.md");
      await writeFile(oldSkill, "# foreign\n");
      await chmod(oldSkill, 0o600);
      await mkdir(path.dirname(manifestPath()), { recursive: true });
      await writeFile(manifestPath(), "old-manifest\n");
      await chmod(manifestPath(), 0o640);
      const targetBefore = await capture(oldSkill);
      const manifestBefore = await capture(manifestPath());

      const response = await invoke([
        "--target", "both", "--mode", "copy", "--replace",
      ], {
        transactionHooks: {
          [failurePoint]: () => {
            throw new Error(`injected ${failurePoint}`);
          },
        },
      });

      expect(response.exitCode).toBe(3);
      expect(await capture(oldSkill)).toEqual(targetBefore);
      expect(await capture(manifestPath())).toEqual(manifestBefore);
      expect(await capture(manifestPath("claude-code"))).toBeNull();
      expect(await capture(claudeTarget())).toBeNull();
    },
  );

  it("cleans a partially prepared copy when the source changes", async () => {
    const response = await invoke([
      "--target", "codex", "--mode", "copy",
    ], {
      transactionHooks: {
        prepare: async () => {
          await rm(path.join(source, "SKILL.md"));
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await capture(codexTarget())).toBeNull();
    expect(await capture(manifestPath())).toBeNull();
    const skillsParent = path.dirname(codexTarget());
    expect((await readdir(skillsParent)).filter((name) =>
      name.startsWith(".aiworker-install-"))).toEqual([]);
  });

  it("preserves a copy edited after preflight instead of overwriting it", async () => {
    await invoke(["--target", "codex", "--mode", "copy"]);
    const manifestBefore = await capture(manifestPath());
    await writeFile(path.join(source, "SKILL.md"), "# Skill v2\n");
    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ], {
      transactionHooks: {
        prepare: async () => {
          await writeFile(
            path.join(codexTarget(), "SKILL.md"),
            "# concurrent user edit\n",
          );
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# concurrent user edit\n");
    expect(await capture(manifestPath())).toEqual(manifestBefore);
  });

  it("preserves a manifest edited in place after target commit", async () => {
    await invoke(["--target", "codex", "--mode", "copy"]);
    await writeFile(path.join(source, "SKILL.md"), "# Skill v2\n");
    const before = await readFile(manifestPath());
    const foreign = Buffer.from(before);
    foreign[0] = "[".charCodeAt(0);
    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ], {
      transactionHooks: {
        targetCommit: async () => {
          await writeFile(manifestPath(), foreign);
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(await readFile(manifestPath())).toEqual(foreign);
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# Skill\n");
  });

  it("never removes a foreign replacement created during rollback", async () => {
    await mkdir(codexTarget(), { recursive: true });
    await writeFile(path.join(codexTarget(), "old"), "old\n");
    let injectedPath;
    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--replace",
    ], {
      transactionHooks: {
        discoveryCheck: async ({ targetPaths }) => {
          injectedPath = targetPaths.codex;
          await rm(injectedPath, { recursive: true });
          await mkdir(injectedPath);
          await writeFile(path.join(injectedPath, "foreign"), "concurrent\n");
          throw new Error("concurrent replacement");
        },
      },
    });
    expect(response.exitCode).toBe(3);
    expect(response.result.data.recovery_paths).toEqual(
      expect.arrayContaining([expect.stringMatching(/quarantine/u)]),
    );
    const preserved = [];
    for (const candidate of [
      injectedPath,
      ...response.result.data.recovery_paths,
    ]) {
      try {
        preserved.push(await readFile(
          path.join(candidate, "foreign"),
          "utf8",
        ));
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      }
    }
    expect(preserved).toContain("concurrent\n");
  });

  it("replaces a directory manifest and preserves foreign backup drift", async () => {
    await mkdir(codexTarget(), { recursive: true });
    await writeFile(path.join(codexTarget(), "old"), "old\n");
    await mkdir(manifestPath(), { recursive: true });
    await writeFile(path.join(manifestPath(), "foreign"), "manifest dir\n");
    let retained;
    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--replace",
    ], {
      transactionHooks: {
        cleanup: async ({ quarantinePaths }) => {
          retained = quarantinePaths.find((item) =>
            item.kind === "target").path;
          await writeFile(path.join(retained, "foreign-added"), "keep\n");
        },
      },
    });
    expect(response.exitCode).toBe(0);
    expect(response.result.issues.map(({ code }) => code))
      .toContain("W_INSTALL_CLEANUP_DEFERRED");
    expect(await readFile(path.join(retained, "foreign-added"), "utf8"))
      .toBe("keep\n");
    expect(JSON.parse(await readFile(manifestPath(), "utf8")).target)
      .toBe("codex");
  });

  it("commits installation but reports an old target changed during cleanup", async () => {
    await invoke(["--target", "codex", "--mode", "copy"]);
    await writeFile(path.join(source, "SKILL.md"), "# Skill v2\n");
    let injected = false;

    const response = await invoke([
      "--target", "codex", "--mode", "copy", "--update",
    ], {
      transactionHooks: {
        afterInstallCleanupInventoryVerified: async ({ claimedPath }) => {
          if (injected || !claimedPath.includes("-target-old")) return;
          injected = true;
          await writeFile(
            path.join(claimedPath, "FOREIGN-SENTINEL.txt"),
            "FOREIGN-SENTINEL\n",
          );
        },
      },
    });

    expect(response.exitCode).toBe(0);
    expect(response.result.issues).toContainEqual(expect.objectContaining({
      severity: "WARNING",
      code: "W_INSTALL_CLEANUP_DEFERRED",
    }));
    const recoveryPath = response.result.data.recovery_paths.find((candidate) =>
      candidate.includes("-target-old"));
    expect(await readFile(
      path.join(recoveryPath, "FOREIGN-SENTINEL.txt"),
      "utf8",
    )).toBe("FOREIGN-SENTINEL\n");
    expect(await readFile(path.join(codexTarget(), "SKILL.md"), "utf8"))
      .toBe("# Skill v2\n");
  });
});
