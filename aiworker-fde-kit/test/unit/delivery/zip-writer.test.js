import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  readAndVerifyZip,
  writeDeterministicZip,
} from "../../../src/delivery/zip-writer.js";

let root;
afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("deterministic ZIP writer", () => {
  it("writes sorted file-only entries with fixed metadata and stable bytes", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "fde-zip-"));
    const files = new Map([
      ["z.md", Buffer.from("z\n")],
      ["assembly/octopus-cli-assemble.sh", Buffer.from("#!/bin/sh\n")],
      ["a.json", Buffer.from("{}\n")],
    ]);
    const first = path.join(root, "first.zip");
    const second = path.join(root, "second.zip");
    const date = new Date("1980-01-01T00:00:00.000Z");
    await writeDeterministicZip(first, files, { mtime: date });
    await writeDeterministicZip(second, files, { mtime: date });

    expect(await readFile(second)).toEqual(await readFile(first));
    const verified = await readAndVerifyZip(first, files);
    expect(verified.issues).toEqual([]);
    expect(verified.entries.map(({ path: entryPath }) => entryPath)).toEqual([
      "a.json",
      "assembly/octopus-cli-assemble.sh",
      "z.md",
    ]);
    expect(verified.entries.map(({ mode }) => mode)).toEqual([
      "0644",
      "0755",
      "0644",
    ]);
    expect(verified.entries.every(({ mtime }) =>
      mtime === "1980-01-01T00:00:00.000Z")).toBe(true);
  });

  it("rejects host-platform metadata drift on reread", async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "fde-zip-"));
    const target = path.join(root, "drift.zip");
    const files = new Map([["a.txt", Buffer.from("a\n")]]);
    await writeDeterministicZip(target, files);
    const bytes = await readFile(target);
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(central).toBeGreaterThanOrEqual(0);
    bytes[central + 5] = 0;
    await writeFile(target, bytes);
    expect((await readAndVerifyZip(target, files)).issues)
      .toContainEqual(expect.objectContaining({ code: "B_ZIP_STRUCTURE" }));
  });
});
