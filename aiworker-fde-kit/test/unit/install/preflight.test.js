import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { snapshotSkillTree } from "../../../src/install/file-snapshot.js";
import { preflightInstall } from "../../../src/install/preflight.js";

let temporaryRoot;
let sourceRoot;
let target;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-preflight-"));
  sourceRoot = path.join(temporaryRoot, "source");
  target = path.join(temporaryRoot, "target");
  await mkdir(sourceRoot);
  await writeFile(path.join(sourceRoot, "SKILL.md"), "# Skill\n");
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function sourceSnapshot() {
  return snapshotSkillTree(sourceRoot);
}

async function record(mode = "copy", overrides = {}) {
  const snapshot = await sourceSnapshot();
  return {
    schema_version: 1,
    target: "codex",
    mode,
    target_path: target,
    source_path: await realpath(sourceRoot),
    source_commit: null,
    source_dirty: true,
    source_tree_hash: snapshot.source_tree_hash,
    installed_at: "2026-07-25T00:00:00.000Z",
    files: snapshot.files,
    ...overrides,
  };
}

async function check(options = {}) {
  const sourcePath = await realpath(sourceRoot);
  return preflightInstall({
    mode: "copy",
    replace: false,
    sourcePath,
    sourceSnapshot: await sourceSnapshot(),
    targetSpecs: [{
      id: "codex",
      path: target,
      manifest: null,
      manifestPath: path.join(temporaryRoot, "codex.json"),
    }],
    update: false,
    ...options,
  });
}

describe("install preflight", () => {
  it("covers all five target/manifest states without writing", async () => {
    expect((await check()).action).toBe("install");

    await mkdir(target);
    await writeFile(path.join(target, "foreign.txt"), "foreign\n");
    expect((await check()).issues[0].code).toBe("B_INSTALL_FOREIGN_TARGET");

    await rm(target, { recursive: true });
    expect((await check({
      targetSpecs: [{
        id: "codex",
        path: target,
        manifest: await record(),
        manifestPath: path.join(temporaryRoot, "codex.json"),
      }],
    })).issues[0].code).toBe("B_INSTALL_ORPHAN_MANIFEST");

    await mkdir(target);
    await writeFile(path.join(target, "SKILL.md"), "# Skill\n");
    const current = await record();
    expect((await check({
      targetSpecs: [{
        id: "codex",
        path: target,
        manifest: current,
        manifestPath: path.join(temporaryRoot, "codex.json"),
      }],
    })).action).toBe("noop");

    await writeFile(path.join(target, "SKILL.md"), "# user edit\n");
    expect((await check({
      targetSpecs: [{
        id: "codex",
        path: target,
        manifest: current,
        manifestPath: path.join(temporaryRoot, "codex.json"),
      }],
    })).issues[0].code).toBe("B_INSTALL_USER_MODIFIED");
  });

  it("requires update for a changed copy source and protects user changes", async () => {
    await mkdir(target);
    await writeFile(path.join(target, "SKILL.md"), "# Skill\n");
    const manifest = await record();
    const targetSpecs = [{
      id: "codex",
      path: target,
      manifest,
      manifestPath: path.join(temporaryRoot, "codex.json"),
    }];
    await writeFile(path.join(sourceRoot, "SKILL.md"), "# Skill v2\n");
    const sourceSnapshot = await snapshotSkillTree(sourceRoot);

    expect((await check({ sourceSnapshot, targetSpecs })).issues[0].code)
      .toBe("B_INSTALL_UPDATE_REQUIRED");
    expect((await check({ sourceSnapshot, targetSpecs, update: true })).action)
      .toBe("update");

    await writeFile(path.join(target, "SKILL.md"), "# user edit\n");
    expect((await check({
      sourceSnapshot,
      targetSpecs,
      update: true,
    })).issues[0].code).toBe("B_INSTALL_USER_MODIFIED");
  });

  it("keeps same-source symlinks idempotent despite source hash drift", async () => {
    await symlink(sourceRoot, target);
    const manifest = await record("symlink");
    await writeFile(path.join(sourceRoot, "SKILL.md"), "# changed\n");
    const result = await check({
      mode: "symlink",
      sourceSnapshot: await sourceSnapshot(),
      targetSpecs: [{
        id: "codex",
        path: target,
        manifest,
        manifestPath: path.join(temporaryRoot, "codex.json"),
      }],
      update: true,
    });
    expect(result.action).toBe("noop");
    expect(result.issues.map(({ code }) => code))
      .toContain("W_INSTALL_SYMLINK_SOURCE_CHANGED");
  });

  it("rejects broken links, other sources, and source path changes", async () => {
    const manifest = await record("symlink");
    const targetSpecs = [{
      id: "codex",
      path: target,
      manifest,
      manifestPath: path.join(temporaryRoot, "codex.json"),
    }];
    await symlink(path.join(temporaryRoot, "missing"), target);
    expect((await check({
      mode: "symlink",
      targetSpecs,
    })).issues[0].code).toBe("B_INSTALL_BROKEN_SYMLINK");

    await unlink(target);
    const other = path.join(temporaryRoot, "other");
    await mkdir(other);
    await symlink(other, target);
    expect((await check({
      mode: "symlink",
      targetSpecs,
    })).issues[0].code).toBe("B_INSTALL_OTHER_SOURCE");

    await unlink(target);
    await symlink(sourceRoot, target);
    targetSpecs[0].manifest = {
      ...manifest,
      source_path: path.join(temporaryRoot, "old-source"),
    };
    expect((await check({
      mode: "symlink",
      targetSpecs,
      update: true,
    })).issues[0].code).toBe("B_INSTALL_SOURCE_CHANGED");
  });

  it("allows replace and blocks both if either target conflicts", async () => {
    await mkdir(target);
    await writeFile(path.join(target, "foreign.txt"), "foreign\n");
    expect((await check({ replace: true })).action).toBe("replace");

    const claude = path.join(temporaryRoot, "claude");
    await mkdir(claude);
    await writeFile(path.join(claude, "foreign"), "foreign\n");
    const result = await check({
      targetSpecs: [
        {
          id: "codex",
          path: path.join(temporaryRoot, "missing"),
          manifest: null,
          manifestPath: path.join(temporaryRoot, "codex.json"),
        },
        {
          id: "claude-code",
          path: claude,
          manifest: null,
          manifestPath: path.join(temporaryRoot, "claude-code.json"),
        },
      ],
    });
    expect(result.action).toBe("blocked");
    expect(result.plans).toEqual([]);
    expect(result.issues.map(({ code }) => code))
      .toContain("B_INSTALL_FOREIGN_TARGET");
  });
});
