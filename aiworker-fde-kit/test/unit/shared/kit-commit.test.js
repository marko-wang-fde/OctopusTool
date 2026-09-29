import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  resolveAuthoritativeKitCommit,
} from "../../../src/shared/kit-commit.js";

const execFileAsync = promisify(execFile);
let temporaryRoot;

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-kit-commit-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

async function git(...args) {
  return execFileAsync("git", ["-C", temporaryRoot, ...args]);
}

async function createCheckout() {
  await git("init", "--quiet");
  await git("config", "user.name", "FDE Test");
  await git(
    "config",
    "user.email",
    ["fde-test", "@", "example.invalid"].join(""),
  );
  await writeFile(path.join(temporaryRoot, "SKILL.md"), "# Skill\n");
  await mkdir(path.join(temporaryRoot, "scripts"));
  await writeFile(
    path.join(temporaryRoot, "scripts/validate-project"),
    "#!/bin/sh\n",
  );
  await git("add", "SKILL.md", "scripts/validate-project");
  await git("commit", "--quiet", "-m", "fixture");
  return (await git("rev-parse", "HEAD")).stdout.trim();
}

function resolveCheckout() {
  return resolveAuthoritativeKitCommit({
    kitRoot: temporaryRoot,
    env: {
      HOME: path.join(temporaryRoot, "unrelated-home"),
      XDG_CONFIG_HOME: path.join(temporaryRoot, "unrelated-xdg"),
    },
  });
}

describe("authoritative Kit commit", () => {
  it("uses HEAD for a clean real checkout", async () => {
    const head = await createCheckout();

    await expect(resolveCheckout()).resolves.toBe(head);
  });

  it.each(["worktree", "index"])(
    "rejects a real checkout whose canonical Skill paths are dirty in the %s",
    async (kind) => {
      await createCheckout();
      await writeFile(path.join(temporaryRoot, "SKILL.md"), "# changed\n");
      if (kind === "index") await git("add", "SKILL.md");

      await expect(resolveCheckout()).resolves.toBeNull();
    },
  );
});
