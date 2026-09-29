import { describe, expect, it } from "vitest";

import {
  authoritativePatterns,
  deriveProjectStatus,
  deriveStageStates,
  parseStageCatalog,
} from "../../../src/project/stage-state.js";
import { stringify } from "yaml";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const catalog = {
  schema_version: 1,
  stages: [
    {
      id: "initialize",
      depends_on: [],
      required_inputs: [],
      required_outputs: ["inputs/input-inventory.md"],
      approval_field: "stage_status.initialize.approved_at",
    },
    {
      id: "discover",
      depends_on: ["initialize"],
      required_inputs: ["inputs/input-inventory.md"],
      required_outputs: ["discovery/scenario-model.md"],
      approval_field: "stage_status.discover.approved_at",
    },
    {
      id: "team-design",
      depends_on: ["discover"],
      required_inputs: ["discovery/scenario-model.md"],
      required_outputs: ["design/team-design.md"],
      approval_field: "stage_status.team-design.approved_at",
    },
    {
      id: "foundation-design",
      depends_on: ["team-design"],
      required_inputs: ["design/team-design.md"],
      required_outputs: ["arcubase/decision.yaml"],
      approval_field: null,
    },
    {
      id: "author",
      depends_on: ["foundation-design"],
      required_inputs: ["arcubase/decision.yaml"],
      required_outputs: ["skills/**/SKILL.md"],
      approval_field: null,
    },
    {
      id: "assemble",
      depends_on: ["author"],
      required_inputs: ["skills/**/SKILL.md"],
      required_outputs: ["assembly/operations.yaml"],
      approval_field: null,
    },
    {
      id: "validate",
      depends_on: ["assemble"],
      required_inputs: ["assembly/operations.yaml"],
      required_outputs: ["reports/package-validation.json"],
      approval_field: null,
    },
  ],
};

function completeRecord(dependsOn = [], approved = null) {
  return {
    status: "complete",
    depends_on: dependsOn,
    baseline_revision: 1,
    input_hashes: {},
    output_hashes: {},
    approved_at: approved,
  };
}

function manifest() {
  return {
    project: { delivery_approved_at: null },
    assembly: {
      operations: [],
      assembly_execution: { status: "not-applicable" },
    },
    stage_status: {
      initialize: completeRecord([], "2026-07-24T00:00:00.000Z"),
      discover: completeRecord(["initialize"], "2026-07-24T00:00:00.000Z"),
      "team-design": completeRecord(["discover"], "2026-07-24T00:00:00.000Z"),
      "foundation-design": completeRecord(["team-design"]),
      author: completeRecord(["foundation-design"]),
      assemble: completeRecord(["author"]),
      validate: completeRecord(["assemble"]),
    },
  };
}

describe("stage state", () => {
  it("prioritizes changed authoritative hashes over work markers", () => {
    const value = manifest();
    value.stage_status.discover.output_hashes = {
      "discovery/scenario-model.md": HASH_A,
    };
    const states = deriveStageStates(value, catalog, {
      hashes: { "discovery/scenario-model.md": HASH_B },
      present: new Set(["discovery/scenario-model.md"]),
      validStages: new Set(catalog.stages.map(({ id }) => id)),
      workingStages: new Set(["discover"]),
    });
    expect(states.discover).toBe("needs-review");
    expect(states["team-design"]).toBe("stale");
  });

  it("treats a newly added authoritative wildcard output as a baseline change", () => {
    const value = manifest();
    value.stage_status.author.input_hashes = {
      "arcubase/decision.yaml": HASH_A,
    };
    value.stage_status.author.output_hashes = {
      "employees/original.md": HASH_A,
      "skills/original/SKILL.md": HASH_A,
    };
    const present = new Set([
      "arcubase/decision.yaml",
      "employees/original.md",
      "employees/new.md",
      "skills/original/SKILL.md",
    ]);
    const states = deriveStageStates(value, catalog, {
      hashes: Object.fromEntries([...present].map((file) => [file, HASH_A])),
      present,
      validStages: new Set(catalog.stages.map(({ id }) => id)),
      workingStages: new Set(),
    });
    expect(states.author).toBe("needs-review");
    expect(states.assemble).toBe("stale");
  });

  it("uses dependency, working, and completeness priority in that order", () => {
    const value = manifest();
    value.stage_status.initialize.status = "not-started";
    const states = deriveStageStates(value, catalog, {
      hashes: {},
      present: new Set([
        "inputs/input-inventory.md",
        "discovery/scenario-model.md",
      ]),
      validStages: new Set(
        catalog.stages.map(({ id }) => id).filter((id) => id !== "initialize"),
      ),
      workingStages: new Set(["discover"]),
    });
    expect(states.discover).toBe("stale");

    const working = deriveStageStates(value, catalog, {
      hashes: {},
      present: new Set([
        "inputs/input-inventory.md",
        "discovery/scenario-model.md",
      ]),
      validStages: new Set(catalog.stages.map(({ id }) => id)),
      workingStages: new Set(["discover"]),
    });
    expect(working.discover).toBe("in-progress");
  });

  it("requires artifacts, validation and existing approvals before complete", () => {
    const value = manifest();
    const states = deriveStageStates(value, catalog, {
      hashes: {},
      present: new Set([
        "inputs/input-inventory.md",
        "discovery/scenario-model.md",
        "design/team-design.md",
        "design/collaboration-and-dataflow.md",
        "design/platform-capability-selection.md",
        "design/data-foundation.md",
        "design/identity-and-access.md",
        "arcubase/decision.yaml",
        "employees/collector.md",
        "skills/collect/SKILL.md",
        "assembly/assembly-plan.md",
        "assembly/operations.yaml",
        "acceptance/acceptance-plan.md",
        "acceptance/test-cases.yaml",
      ]),
      validStages: new Set(catalog.stages.map(({ id }) => id)),
      workingStages: new Set(),
    });
    expect(states.initialize).toBe("complete");
    expect(states.validate).toBe("not-started");
  });

  it("resolves conditional authoritative paths only from the validated catalog", () => {
    const conditional = structuredClone(catalog);
    conditional.stages[3].required_outputs.push(
      { path: "arcubase/schema.yaml", condition: "arcubase-required" },
      {
        path: "arcubase/access-matrix.md",
        condition: "arcubase-access-required",
      },
    );
    const none = manifest();
    none.data_foundation = { mode: "none" };
    const created = manifest();
    created.data_foundation = { mode: "new" };
    expect(
      authoritativePatterns(
        conditional,
        "foundation-design",
        none,
      ).outputs,
    ).not.toContain("arcubase/schema.yaml");
    expect(
      authoritativePatterns(
        conditional,
        "foundation-design",
        created,
      ).outputs,
    ).toContain("arcubase/schema.yaml");
    const existing = manifest();
    existing.data_foundation = { mode: "existing" };
    expect(
      authoritativePatterns(
        conditional,
        "foundation-design",
        existing,
      ).outputs,
    ).toContain("arcubase/access-matrix.md");
  });

  it("does not require assembly execution artifacts for supported read-only operations", () => {
    const conditional = structuredClone(catalog);
    conditional.stages[5].required_outputs.push(
      {
        path: "assembly/octopus-cli-assemble.sh",
        condition: "assembly-script-required",
      },
      {
        path: "reports/cli-assemble-evidence.json",
        condition: "assembly-evidence-required",
      },
    );
    const value = manifest();
    value.assembly.operations = [{
      support: "supported",
      operation_kind: "read",
    }];
    value.assembly.assembly_execution.status = "ready";
    const outputs = authoritativePatterns(
      conditional,
      "assemble",
      value,
    ).outputs;
    expect(outputs).not.toContain("assembly/octopus-cli-assemble.sh");
    expect(outputs).not.toContain("reports/cli-assemble-evidence.json");
  });

  it("rejects a structurally valid official catalog with a narrowed hash set", () => {
    const narrowed = structuredClone(catalog);
    narrowed.stages[1].required_outputs.pop();
    expect(() => parseStageCatalog(stringify(narrowed))).toThrow(
      /authoritative artifact set/u,
    );
  });

  it.each([
    [
      { initialize: "complete", discover: "complete", "team-design": "stale" },
      [],
      "draft",
    ],
    [
      {
        initialize: "complete",
        discover: "complete",
        "team-design": "complete",
        "foundation-design": "stale",
      },
      [],
      "reviewable",
    ],
  ])("derives only supported project states", (states, blockers, expected) => {
    expect(deriveProjectStatus(manifest(), states, blockers)).toBe(expected);
  });

  it("distinguishes delivery ready from CLI assembled", () => {
    const states = Object.fromEntries(
      catalog.stages.map(({ id }) => [id, "complete"]),
    );
    const value = manifest();
    expect(deriveProjectStatus(value, states, [])).toBe("delivery-ready");
    value.assembly.operations = [{
      support: "supported",
      operation_kind: "write",
    }];
    value.assembly.assembly_execution.status = "executed";
    expect(deriveProjectStatus(value, states, [])).toBe(
      "cli-assembled",
    );
  });
});
