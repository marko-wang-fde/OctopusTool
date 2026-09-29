import { describe, expect, it } from "vitest";

import {
  createPackageManifest,
  verifyPackageManifest,
} from "../../../src/delivery/package-manifest.js";

describe("offline package manifest", () => {
  it("records every supplied file except itself in bytewise path order", () => {
    const files = new Map([
      ["中文.md", Buffer.from("z")],
      ["a/file.yaml", Buffer.from("a")],
      ["reports/package-validation.json", Buffer.from('{"status":"passed"}\n')],
      ["package-manifest.json", Buffer.from("ignored")],
    ]);
    const manifest = createPackageManifest(files, {
      packageInputHash: "a".repeat(64),
      packagedAt: "2026-07-24T01:00:00.000Z",
      projectSlug: "example-fde",
    });
    expect(manifest.self_entry).toBe("excluded");
    expect(manifest.files.map(({ path }) => path)).toEqual([
      "a/file.yaml",
      "reports/package-validation.json",
      "中文.md",
    ]);
    expect(manifest.files[0]).toMatchObject({
      classification: "structured-contract",
      mode: "0644",
      type: "file",
    });
    expect(verifyPackageManifest(manifest, files).issues).toEqual([]);
  });

  it("hashes actual ZIP bytes even for canonically equivalent project YAML", () => {
    const firstBytes = Buffer.from("project:\n  status: draft\n");
    const secondBytes = Buffer.from("project: { status: draft }\n");
    const first = createPackageManifest(new Map([
      ["fde-project.yaml", firstBytes],
      ["reports/package-validation.json", Buffer.from("{}\n")],
    ]), {
      packageInputHash: "a".repeat(64),
      packagedAt: "2026-07-24T01:00:00.000Z",
      projectSlug: "example-fde",
    });
    const second = createPackageManifest(new Map([
      ["fde-project.yaml", secondBytes],
      ["reports/package-validation.json", Buffer.from("{}\n")],
    ]), {
      packageInputHash: "a".repeat(64),
      packagedAt: "2026-07-24T01:00:00.000Z",
      projectSlug: "example-fde",
    });
    expect(first.files.find(({ path }) => path === "fde-project.yaml").sha256)
      .not.toBe(second.files.find(({ path }) =>
        path === "fde-project.yaml").sha256);
  });

  it("rejects duplicate, case-conflicting, escaping, symlink, and mismatched entries", () => {
    const files = new Map([["a.md", Buffer.from("a")]]);
    const valid = createPackageManifest(files, {
      packageInputHash: "a".repeat(64),
      packagedAt: "2026-07-24T01:00:00.000Z",
      projectSlug: "example-fde",
    });
    for (const mutate of [
      (value) => value.files.push({ ...value.files[0] }),
      (value) => value.files.push({ ...value.files[0], path: "A.md" }),
      (value) => { value.files[0].path = "../a.md"; },
      (value) => { value.files[0].type = "symlink"; },
      (value) => { value.files[0].sha256 = "b".repeat(64); },
      (value) => { delete value.packaged_at; },
      (value) => { value.packaged_at = "2026-07-24T09:00:00+08:00"; },
      (value) => { value.packaged_at = "2026-07-24T01:00:00Z"; },
      (value) => { value.unknown = true; },
      (value) => { value.files[0].unknown = true; },
    ]) {
      const manifest = structuredClone(valid);
      mutate(manifest);
      expect(verifyPackageManifest(manifest, files).issues.length).toBeGreaterThan(0);
    }
  });
});
