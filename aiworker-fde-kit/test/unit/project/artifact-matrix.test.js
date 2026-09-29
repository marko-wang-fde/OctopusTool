import { describe, expect, it } from "vitest";

import {
  deriveArtifactMatrix,
  validateArtifactPresence,
} from "../../../src/project/artifact-matrix.js";

function project(overrides = {}) {
  return {
    data_foundation: { mode: "none" },
    workers: [],
    capabilities: [],
    assembly: {
      operations: [],
      assembly_execution: { status: "not-applicable" },
    },
    ...overrides,
  };
}

describe("artifact matrix", () => {
  it("requires every fixed artifact and reports a missing fixed file as a blocker", async () => {
    const matrix = deriveArtifactMatrix(project());
    expect(matrix.filter(({ required }) => required).map(({ path }) => path))
      .toEqual(expect.arrayContaining([
        "fde-project.yaml",
        "discovery/facts-and-assumptions.md",
        "design/team-design.md",
        "arcubase/decision.yaml",
        "assembly/operations.yaml",
        "acceptance/test-cases.yaml",
      ]));

    const issues = await validateArtifactPresence("/project", matrix, {
      exists: async (relativePath) => relativePath !== "design/team-design.md",
    });
    expect(issues).toEqual([
      expect.objectContaining({
        severity: "BLOCKER",
        code: "B_ARTIFACT_MISSING",
        path: "design/team-design.md",
      }),
    ]);
  });

  it.each([
    ["none", false],
    ["new", true],
    ["existing", false],
    ["extend", true],
  ])("handles Arcubase %s conditional artifacts", (mode, schemaExpected) => {
    const required = new Map(
      deriveArtifactMatrix(project({
        data_foundation: { mode },
      })).map((entry) => [entry.path, entry.required]),
    );
    expect(required.get("arcubase/schema.yaml")).toBe(schemaExpected);
    expect(required.get("arcubase/access-matrix.md")).toBe(mode !== "none");
  });

  it("activates Station, Taskboard, and Browser/WebSkill only from manifest facts", () => {
    const required = new Map(
      deriveArtifactMatrix(project({
        workers: [{ station_reachable: true }],
        capabilities: ["feat.taskboard", "feat.browser"],
      })).map((entry) => [entry.path, entry.required]),
    );
    expect(required.get("design/external-station.md")).toBe(true);
    expect(required.get("design/taskboard.md")).toBe(true);
    expect(required.get("design/browser-webskill.md")).toBe(true);
  });

  it.each([
    ["not-applicable", [], false, false],
    [
      "not-applicable",
      [{ support: "supported", operation_kind: "read" }],
      false,
      false,
    ],
    [
      "ready",
      [{ support: "supported", operation_kind: "write" }],
      true,
      false,
    ],
    [
      "executed",
      [{ support: "supported", operation_kind: "write" }],
      true,
      true,
    ],
    [
      "blocked",
      [{ support: "supported", operation_kind: "write" }],
      false,
      false,
    ],
  ])(
    "models assembly execution status %s without inventing conditional files",
    (status, operations, scriptRequired, evidenceRequired) => {
      const matrix = deriveArtifactMatrix(project({
        assembly: {
          operations,
          assembly_execution: {
            status,
            script_file: scriptRequired
              ? "assembly/octopus-cli-assemble.sh"
              : null,
            evidence_file: evidenceRequired
              ? "reports/cli-assemble-evidence.json"
              : null,
          },
        },
      }));
      const required = new Map(matrix.map((entry) => [entry.path, entry.required]));
      expect(required.get("assembly/octopus-cli-assemble.sh")).toBe(scriptRequired);
      expect(required.get("reports/cli-assemble-evidence.json")).toBe(evidenceRequired);
      if (
        operations.every(({ operation_kind: kind }) => kind !== "write") &&
        status === "not-applicable"
      ) {
        expect(matrix.some(({ contractIssue }) => contractIssue)).toBe(false);
      }
    },
  );

  it("does not report an untriggered conditional file", async () => {
    const issues = await validateArtifactPresence(
      "/project",
      deriveArtifactMatrix(project()),
      { exists: async () => false },
    );
    expect(issues.map(({ path }) => path)).not.toContain("arcubase/schema.yaml");
    expect(issues.map(({ path }) => path)).not.toContain("design/taskboard.md");
  });

  it.each([
    [
      {
        operations: [{ support: "supported" }],
        assembly_execution: { status: "blocked", script_file: null, evidence_file: null },
      },
      "B_ASSEMBLY_EXECUTION_BLOCKED",
    ],
    [
      {
        operations: [],
        assembly_execution: {
          status: "ready",
          script_file: "assembly/octopus-cli-assemble.sh",
          evidence_file: null,
        },
      },
      "B_ASSEMBLY_EXECUTION_STATUS",
    ],
  ])("reports an assembly execution contract blocker for %j", async (assembly, code) => {
    const issues = await validateArtifactPresence(
      "/project",
      deriveArtifactMatrix(project({ assembly })),
      { exists: async () => true },
    );
    expect(issues.map((item) => item.code)).toContain(code);
  });
});
