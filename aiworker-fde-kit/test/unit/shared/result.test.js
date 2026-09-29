import { describe, expect, test } from "vitest";

import { commandResult, issue } from "../../../src/shared/result.js";

describe("commandResult", () => {
  test("sorts issues deterministically and fails on blockers", () => {
    const result = commandResult([
      issue("WARNING", "W_Z", "z/file", "warning"),
      issue("BLOCKER", "B_A", "a/file", "blocker"),
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.issues.map(({ code }) => code)).toEqual(["B_A", "W_Z"]);
  });
});
