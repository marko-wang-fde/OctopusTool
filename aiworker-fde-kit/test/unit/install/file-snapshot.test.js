import {
  chmod,
  mkdtemp,
  mkdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  compareSkillSnapshots,
  snapshotSkillTree,
} from "../../../src/install/file-snapshot.js";

let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-install-snapshot-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function write(relativePath, contents, mode = 0o644) {
  const absolutePath = path.join(temporaryRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, contents, { mode });
}

describe("Skill file snapshots", () => {
  it("tracks only canonical Skill files and excludes repository-only content", async () => {
    await write("SKILL.md", "# Skill\n");
    await write("LICENSE", "license\n");
    await write("agents/openai.yaml", "interface: {}\n");
    await write("references/fde.md", "reference\n");
    await write("catalog/tools.yaml", "tools: []\n");
    await write("schemas/project.schema.json", "{}\n");
    await write("assets/project-template/fde-project.yaml", "schema_version: 1\n");
    await write("assets/examples/lead-collector/input.md", "example\n");
    await write("scripts/install", "#!/bin/sh\n", 0o755);
    await write("src/install/example.js", "export {};\n");
    await write("package.json", "{}\n");
    await write("package-lock.json", "{}\n");
    await write("vitest.config.js", "repository test config\n");
    await write(".git/config", "private\n");
    await write("docs/internal.md", "private\n");
    await write("test/fixture.txt", "private\n");
    await write("README.md", "repository only\n");

    const snapshot = await snapshotSkillTree(temporaryRoot);

    expect(Object.keys(snapshot.files)).toEqual([
        "LICENSE",
        "SKILL.md",
        "agents/openai.yaml",
        "assets/examples/lead-collector/input.md",
        "assets/project-template/fde-project.yaml",
        "catalog/tools.yaml",
        "references/fde.md",
        "schemas/project.schema.json",
        "scripts/install",
      ]);
    expect(snapshot.source_tree_hash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("hashes regular files, symlinks, modes, targets, and bytes deterministically", async () => {
    await write("SKILL.md", "# Skill\n", 0o640);
    await mkdir(path.join(temporaryRoot, "references"), { recursive: true });
    await symlink("../SKILL.md", path.join(temporaryRoot, "references/main.md"));

    const first = await snapshotSkillTree(temporaryRoot);
    const second = await snapshotSkillTree(temporaryRoot);

    expect(first).toEqual(second);
    expect(first.files).toEqual({
      "SKILL.md": {
        mode: "0640",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
        type: "file",
        link_target: null,
      },
      "references/main.md": {
        link_target: "../SKILL.md",
        mode: expect.stringMatching(/^0[0-7]{3}$/u),
        sha256: null,
        type: "symlink",
      },
    });
    const records = Object.entries(first.files).map(([relativePath, entry]) =>
      `${relativePath}\0${entry.type}\0${entry.mode}\0` +
      `${entry.sha256 ?? ""}\0${entry.link_target ?? ""}\n`
    ).join("");
    expect(first.source_tree_hash).toBe(
      createHash("sha256").update(records, "utf8").digest("hex"),
    );
  });

  it("detects add, delete, rename, type, content, and mode changes", async () => {
    await write("SKILL.md", "one\n", 0o644);
    await write("references/delete.md", "delete\n");
    await write("references/rename.md", "rename\n");
    await write("references/type.md", "type\n");
    await write("references/mode.md", "mode\n", 0o644);
    const before = await snapshotSkillTree(temporaryRoot);

    await write("SKILL.md", "two\n", 0o644);
    await unlink(path.join(temporaryRoot, "references/delete.md"));
    await unlink(path.join(temporaryRoot, "references/rename.md"));
    await write("references/renamed.md", "rename\n");
    await unlink(path.join(temporaryRoot, "references/type.md"));
    await symlink("../SKILL.md", path.join(temporaryRoot, "references/type.md"));
    await chmod(path.join(temporaryRoot, "references/mode.md"), 0o600);
    await write("references/add.md", "add\n");
    const after = await snapshotSkillTree(temporaryRoot);

    const comparison = compareSkillSnapshots(before, after);
    expect(comparison.equal).toBe(false);
    expect(comparison.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "added", path: "references/add.md" }),
      expect.objectContaining({ kind: "deleted", path: "references/delete.md" }),
      expect.objectContaining({
        from: "references/rename.md",
        kind: "renamed",
        path: "references/renamed.md",
      }),
      expect.objectContaining({ kind: "type", path: "references/type.md" }),
      expect.objectContaining({ kind: "mode", path: "references/mode.md" }),
      expect.objectContaining({ kind: "content", path: "SKILL.md" }),
    ]));
  });

  it("does not trust a caller-supplied tree hash over file entries", async () => {
    await write("SKILL.md", "one\n");
    const before = await snapshotSkillTree(temporaryRoot);
    await write("SKILL.md", "two\n");
    const after = await snapshotSkillTree(temporaryRoot);
    const forged = {
      ...after,
      source_tree_hash: before.source_tree_hash,
    };

    expect(compareSkillSnapshots(before, forged).equal).toBe(false);
  });

});
