import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateAssemblyPlan,
} from "../../../src/assembly/assembly-validator.js";

const CATALOG = {
  catalog_version: "1.0.0",
  supported: [{
    operation_id: "skill-set.create",
    executor: "octopus-cli",
    support: "supported",
    command_path: ["configure", "skill", "set", "add"],
    positional_args: [],
    options: {
      payload: "--body-file",
      output: "--json",
    },
    option_shape: {
      payload: { arity: "value", required: true, allowed_forms: ["separate"] },
      output: { arity: "boolean", required: true, allowed_forms: ["standalone"] },
    },
    payload_schema_uri: "schemas/payloads/skill-set-create.schema.json",
    risk_level: "high",
    contract_version: "1.0.0",
  }],
  manual_required: [{
    operation_id: "skill-package.upload",
    executor: "admin-manual",
    support: "manual-required",
    risk_level: "high",
    manual_artifacts: ["skills/<skill-slug>/"],
    manual_instructions: ["Upload through the approved administrator UI."],
    verification_condition: "Recorded package digest matches.",
    recovery_condition: "Retry through an authorized administrator.",
  }],
};

const SUPPORTED = {
  operation_id: "skill-set.create",
  description: "Create approved skill set.",
  risk: "high",
  depends_on: [],
  executor: "octopus-cli",
  support: "supported",
  operation_kind: "write",
  command_path: ["configure", "skill", "set", "add"],
  payload_file: "assembly/payloads/skill-set-create.json",
  payload_schema_uri:
    "https://schemas.syngy.ai/aiworker-fde-kit/v1/payloads/skill-set-create.schema.json",
};

const MANUAL = {
  operation_id: "skill-package.upload",
  description: "Upload package.",
  risk: "high",
  depends_on: ["skill-set.create"],
  executor: "admin-manual",
  support: "manual-required",
  manual_artifacts: ["skills/lead-collector/"],
  manual_instructions: ["Upload through the approved administrator UI."],
  verification_condition: "Recorded package digest matches.",
  recovery_condition: "Retry through an authorized administrator.",
};

function plan(operations = [SUPPORTED, MANUAL]) {
  return {
    schema_version: 1,
    contract_version: "1.0.0",
    catalog_version: "1.0.0",
    payload_root: "assembly/payloads",
    operations,
    assembly_execution: {
      status: "not-generated",
      script_file: null,
      evidence_file: null,
      cli_package_version: null,
      cli_reported_version: null,
    },
  };
}

const registry = {
  has: (uri) => uri.endsWith("/payloads/skill-set-create.schema.json"),
  validate: (_uri, payload) => ({
    valid: payload.operation_id === "skill-set.create",
    errors: [],
  }),
};

describe("validateAssemblyPlan", () => {
  it("treats readable non-object operation entries as schema blockers", () => {
    expect(() => validateAssemblyPlan(plan([null]), {
      catalog: CATALOG,
      registry,
    })).not.toThrow();
    const result = validateAssemblyPlan(plan([null]), {
      catalog: CATALOG,
      registry,
    });
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_OPERATION_ID",
    }));
    expect(result.supportedWrites).toEqual([]);
  });

  it("returns supported writes in stable dependency order", () => {
    const second = {
      ...SUPPORTED,
      operation_id: "skill-set.second",
      depends_on: ["skill-set.create"],
      payload_file: "assembly/payloads/second.json",
    };
    const result = validateAssemblyPlan(plan([second, MANUAL, SUPPORTED]), {
      catalog: {
        ...CATALOG,
        supported: [
          ...CATALOG.supported,
          {
            ...CATALOG.supported[0],
            operation_id: "skill-set.second",
          },
        ],
      },
      registry,
      payloads: new Map([
        [SUPPORTED.payload_file, { operation_id: "skill-set.create" }],
        [second.payload_file, { operation_id: "skill-set.create" }],
      ]),
      artifactVariables: new Map([["skill-slug", ["lead-collector"]]]),
    });

    expect(result.issues).toEqual([]);
    expect(result.orderedOperations.map(({ operation_id: id }) => id)).toEqual([
      "skill-set.create",
      "skill-package.upload",
      "skill-set.second",
    ]);
    expect(result.supportedWrites.map(({ operation_id: id }) => id)).toEqual([
      "skill-set.create",
      "skill-set.second",
    ]);
  });

  it.each([
    [
      "mixed envelopes",
      { ...SUPPORTED, manual_instructions: ["not allowed"] },
      "B_ASSEMBLY_ENVELOPE",
    ],
    [
      "missing payload",
      { ...SUPPORTED, payload_file: null },
      "B_ASSEMBLY_PAYLOAD",
    ],
    [
      "unregistered schema",
      { ...SUPPORTED, payload_schema_uri: "schemas/payloads/unknown.schema.json" },
      "B_ASSEMBLY_SCHEMA_URI",
    ],
    [
      "unknown dependency",
      { ...SUPPORTED, depends_on: ["missing.operation"] },
      "B_ASSEMBLY_DEPENDENCY",
    ],
    [
      "manual command",
      { ...MANUAL, command_path: ["configure", "skill", "set", "add"] },
      "B_ASSEMBLY_ENVELOPE",
    ],
  ])("rejects %s", (_label, operation, code) => {
    const result = validateAssemblyPlan(plan([operation]), {
      catalog: CATALOG,
      registry,
      payloads: new Map([
        [SUPPORTED.payload_file, { operation_id: "skill-set.create" }],
      ]),
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ code }));
  });

  it("rejects a dependency cycle", () => {
    const first = { ...SUPPORTED, depends_on: ["skill-set.second"] };
    const second = {
      ...SUPPORTED,
      operation_id: "skill-set.second",
      depends_on: ["skill-set.create"],
      payload_file: "assembly/payloads/second.json",
    };
    const result = validateAssemblyPlan(plan([first, second]), {
      catalog: {
        ...CATALOG,
        supported: [
          ...CATALOG.supported,
          {
            ...CATALOG.supported[0],
            operation_id: "skill-set.second",
          },
        ],
      },
      registry,
      payloads: new Map([
        [first.payload_file, { operation_id: "skill-set.create" }],
        [second.payload_file, { operation_id: "skill-set.create" }],
      ]),
    });

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_CYCLE",
    }));
  });

  it("accepts a command-free blocked envelope for an unavailable capability", () => {
    const blocked = {
      operation_id: "arcubase.unsupported",
      description: "No tested route exists.",
      risk: "critical",
      depends_on: [],
      executor: "unavailable",
      support: "blocked",
      blocker_code: "B_ASSEMBLY_ROUTE_UNAVAILABLE",
      blocker_reason: "Neither a tested CLI nor manual route exists.",
      recovery_condition: "Add and review a versioned operation contract.",
    };
    const result = validateAssemblyPlan(plan([blocked]), {
      catalog: CATALOG,
      registry,
    });

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_ROUTE_UNAVAILABLE",
    }));
    expect(result.supportedWrites).toEqual([]);
  });

  it.each([
    ["risk", { ...SUPPORTED, risk: "low" }],
    [
      "contract version",
      SUPPORTED,
      { contract_version: "2.0.0" },
    ],
    [
      "manual recovery",
      { ...MANUAL, recovery_condition: "Invented recovery." },
    ],
    [
      "manual artifact expansion",
      { ...MANUAL, manual_artifacts: ["skills/../../secret/"] },
    ],
    [
      "unapproved manual artifact expansion",
      { ...MANUAL, manual_artifacts: ["skills/does-not-exist/"] },
    ],
  ])("binds %s exactly to the versioned catalog", (_label, changed, planPatch = {}) => {
    const result = validateAssemblyPlan(
      { ...plan([changed]), ...planPatch },
      {
        catalog: CATALOG,
        registry,
        payloads: new Map([
          [SUPPORTED.payload_file, { operation_id: "skill-set.create" }],
        ]),
        artifactVariables: new Map([["skill-slug", ["lead-collector"]]]),
      },
    );

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_CATALOG_BINDING",
    }));
  });

  it.each([
    [
      "zero supported writes marked ready",
      plan([]),
      "B_ASSEMBLY_EXECUTION_STATE",
      { status: "ready", script_file: "assembly/octopus-cli-assemble.sh" },
    ],
    [
      "ready write missing script",
      plan([SUPPORTED]),
      "B_ASSEMBLY_EXECUTION_STATE",
      { status: "ready", script_file: null },
    ],
    [
      "executed write missing evidence",
      plan([SUPPORTED]),
      "B_ASSEMBLY_EXECUTION_STATE",
      {
        status: "executed",
        script_file: "assembly/octopus-cli-assemble.sh",
        evidence_file: null,
        cli_package_version: "0.1.1",
        cli_reported_version: "0.1.0",
      },
    ],
    [
      "non-fixed script path",
      plan([SUPPORTED]),
      "B_ASSEMBLY_EXECUTION_STATE",
      { status: "ready", script_file: "assembly/other.sh" },
    ],
  ])("rejects %s", (_label, value, code, executionPatch) => {
    value.assembly_execution = {
      ...value.assembly_execution,
      ...executionPatch,
    };
    const result = validateAssemblyPlan(value, {
      catalog: CATALOG,
      registry,
      payloads: new Map([
        [SUPPORTED.payload_file, { operation_id: "skill-set.create" }],
      ]),
    });

    expect(result.issues).toContainEqual(expect.objectContaining({ code }));
  });

  it("rejects unsafe payload paths and duplicate payload ownership", () => {
    const escape = {
      ...SUPPORTED,
      operation_id: "skill-set.escape",
      payload_file: path.posix.join("assembly/payloads", "../../secret.json"),
    };
    const duplicate = {
      ...SUPPORTED,
      operation_id: "skill-set.second",
    };
    const result = validateAssemblyPlan(plan([escape, SUPPORTED, duplicate]), {
      catalog: {
        ...CATALOG,
        supported: [
          ...CATALOG.supported,
          {
            ...CATALOG.supported[0],
            operation_id: "skill-set.escape",
          },
          {
            ...CATALOG.supported[0],
            operation_id: "skill-set.second",
          },
        ],
      },
      registry,
      payloads: new Map([
        [SUPPORTED.payload_file, { operation_id: "skill-set.create" }],
      ]),
    });

    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_PAYLOAD_PATH",
    }));
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: "B_ASSEMBLY_PAYLOAD_DUPLICATE",
    }));
  });
});
