import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { selectDeliveryFiles } from "../../../src/delivery/file-selection.js";

let root;

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("delivery file selection", () => {
  it("excludes private inputs, generated evidence, credentials, old archives, and raw stderr", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "fde-selection-"));
    const files = {
      "fde-project.yaml": "schema_version: 1\n",
      "design/team-design.md": "ok\n",
      "acceptance/test-cases.yaml": "schema_version: 1\n",
      "inputs/source-files/raw.txt": "PRIVATE-SOURCE-MARKER\n",
      "cache/octopus-cli/state.json": "{}\n",
      "design/.cache/tool-state.json": "{}\n",
      "design/backup/old.md": "private\n",
      "backups/old.yaml": "private\n",
      "design/backups/old.md": "private\n",
      "tmp/work.txt": "private\n",
      "design/temp/work.txt": "private\n",
      "generated/evidence.json": "{}\n",
      "design/generated/evidence.json": "{}\n",
      "credentials.json": "{}\n",
      "reports/profile.json": "{}\n",
      "reports/session.json": "{}\n",
      "reports/token.json": "{}\n",
      "reports/cookie.json": "{}\n",
      ".env": "SECRET=x\n",
      ".tmp-work/secret": "x\n",
      "reports/.validation-report.backup/old.json": "{}\n",
      "reports/diagnostics.raw.json": "{}\n",
      "reports/octopus.raw-stderr.log": "x\n",
      "assembly/operations.yaml.bak": "private\n",
      "design/team-design.md.backup": "private\n",
      "employees/worker.md~": "private\n",
      "reports/result.tmp": "private\n",
      "skills/example/SKILL.md.swp": "private\n",
      "old-delivery.zip": "x\n",
    };
    for (const [relativePath, contents] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(root, relativePath)), {
        recursive: true,
      });
      await writeFile(path.join(root, relativePath), contents);
    }

    const selected = await selectDeliveryFiles(root);

    expect([...selected.files.keys()]).toEqual([
      "acceptance/test-cases.yaml",
      "design/team-design.md",
      "fde-project.yaml",
    ]);
    expect(selected.excluded.map(({ path: file }) => file)).toEqual(
      expect.arrayContaining([
        ".env",
        ".tmp-work/secret",
        "assembly/operations.yaml.bak",
        "backups/old.yaml",
        "cache/octopus-cli/state.json",
        "design/.cache/tool-state.json",
        "design/backup/old.md",
        "design/backups/old.md",
        "design/generated/evidence.json",
        "design/team-design.md.backup",
        "design/temp/work.txt",
        "credentials.json",
        "employees/worker.md~",
        "generated/evidence.json",
        "old-delivery.zip",
        "reports/cookie.json",
        "reports/diagnostics.raw.json",
        "reports/profile.json",
        "reports/result.tmp",
        "reports/session.json",
        "reports/token.json",
        "reports/.validation-report.backup/old.json",
        "reports/octopus.raw-stderr.log",
        "skills/example/SKILL.md.swp",
        "tmp/work.txt",
        "inputs/source-files/raw.txt",
      ]),
    );
  });

  it("includes sources only with the explicit option and rejects symlinks", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "fde-selection-"));
    await mkdir(path.join(root, "inputs/source-files"), { recursive: true });
    await writeFile(
      path.join(root, "inputs/source-files/brief.txt"),
      "PRIVATE-SOURCE-MARKER\n",
    );
    expect([
      ...(await selectDeliveryFiles(root, { includeSources: true })).files
        .keys(),
    ]).toEqual(["inputs/source-files/brief.txt"]);

    await symlink(
      "brief.txt",
      path.join(root, "inputs/source-files/link.txt"),
    );
    await expect(selectDeliveryFiles(root, { includeSources: true }))
      .rejects.toMatchObject({ code: "E_DELIVERY_SYMLINK" });
  });
});
