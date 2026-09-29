import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  capturePathState,
  deleteClaimedIfUnchanged,
} from "../../../src/install/path-state.js";

let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-path-state-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

describe("owned path cleanup", () => {
  it("offers a deterministic boundary after ownership verification", async () => {
    const claimed = path.join(temporaryRoot, "claimed");
    await mkdir(claimed);
    await writeFile(path.join(claimed, "owned.txt"), "owned\n");
    const expected = await capturePathState(claimed);
    const afterInventoryVerified = vi.fn();

    expect(await deleteClaimedIfUnchanged(claimed, expected, {
      hooks: { afterInventoryVerified },
    })).toBe(true);

    expect(afterInventoryVerified).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: "a replacement directory",
      mutate: async (claimed) => {
        const child = path.join(claimed, "owned");
        await rename(child, path.join(temporaryRoot, "displaced-directory"));
        await mkdir(child);
        await writeFile(path.join(child, "foreign.txt"), "FOREIGN-SENTINEL\n");
      },
    },
    {
      name: "a same-content replacement file with a different inode",
      mutate: async (claimed) => {
        const child = path.join(claimed, "owned", "marker.txt");
        await rename(child, path.join(temporaryRoot, "displaced-file"));
        await writeFile(child, "FOREIGN-SENTINEL\n");
      },
    },
    {
      name: "an unknown entry",
      mutate: async (claimed) => {
        await writeFile(
          path.join(claimed, "unknown-foreign.txt"),
          "FOREIGN-SENTINEL\n",
        );
      },
    },
  ])(
    "stops and reports the claimed recovery path when $name appears after verification",
    async ({ mutate }) => {
      const claimed = path.join(temporaryRoot, "claimed");
      await mkdir(path.join(claimed, "owned"), { recursive: true });
      await writeFile(
        path.join(claimed, "owned", "marker.txt"),
        "FOREIGN-SENTINEL\n",
      );
      const expected = await capturePathState(claimed);

      await expect(deleteClaimedIfUnchanged(claimed, expected, {
        hooks: {
          afterInventoryVerified: async ({ claimedPath }) => {
            await mutate(claimedPath);
          },
        },
      })).rejects.toMatchObject({
        code: "E_OWNED_CLEANUP_DRIFT",
        recoveryPaths: [claimed],
      });

      expect(await treeContainsSentinel(claimed)).toBe(true);
    },
  );

  it("rechecks a claimed single file after its final content verification", async () => {
    const claimed = path.join(temporaryRoot, "claimed-file");
    await writeFile(claimed, "FOREIGN-SENTINEL\n");
    const expected = await capturePathState(claimed);

    await expect(deleteClaimedIfUnchanged(claimed, expected, {
      hooks: {
        afterEntryVerified: async ({ relativePath }) => {
          if (relativePath !== ".") return;
          await rename(claimed, path.join(temporaryRoot, "displaced-root-file"));
          await writeFile(claimed, "FOREIGN-SENTINEL\n");
        },
      },
    })).rejects.toMatchObject({
      code: "E_OWNED_CLEANUP_DRIFT",
      recoveryPaths: [claimed],
    });

    expect(await readFile(claimed, "utf8")).toBe("FOREIGN-SENTINEL\n");
  });
});

async function treeContainsSentinel(root) {
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    const metadata = await lstat(current);
    if (metadata.isDirectory()) {
      for (const child of await readdir(current)) {
        pending.push(path.join(current, child));
      }
    } else if (
      metadata.isFile() &&
      (await readFile(current, "utf8")).includes("FOREIGN-SENTINEL")
    ) {
      return true;
    }
  }
  return false;
}
