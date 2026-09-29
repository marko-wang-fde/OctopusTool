import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  removeIfOwned,
} from "../../../src/project/validation-report.js";

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { force: true, recursive: true })));
});

describe("validation transaction cleanup", () => {
  it("quarantines and reports a path replaced at the cleanup boundary", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fde-report-cleanup-"));
    roots.push(root);
    const target = path.join(root, "transaction.tmp");
    const foreign = Buffer.from("concurrent replacement\n", "utf8");
    await writeFile(target, "owned transaction file\n");
    const identity = await lstat(target);
    let injected = false;

    let caught;
    try {
      await removeIfOwned({
        lstat,
        mkdir,
        rename: async (source, destination) => {
          if (source === target && !injected) {
            injected = true;
            await writeFile(target, foreign);
          }
          return rename(source, destination);
        },
        rmdir,
        unlink,
      }, target, identity, undefined, Buffer.from(
        "owned transaction file\n",
        "utf8",
      ));
    } catch (error) {
      caught = error;
    }

    expect(injected).toBe(true);
    expect(caught).toBeInstanceOf(Error);
    expect(caught.recoveryPaths).toHaveLength(1);
    await expect(readFile(caught.recoveryPaths[0])).resolves.toEqual(foreign);
  });
});
