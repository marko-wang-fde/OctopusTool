import { describe, expect, it } from "vitest";

import { validateCrossReferences } from "../../../src/contracts/cross-references.js";

function validProject() {
  return {
    roles: [{ id: "role.sales", name: "Sales" }],
    scenarios: [{
      id: "scenario.collect",
      human_gates: ["Confirm outbound communication"],
    }],
    workers: [{
      id: "worker.collector",
      name: "Collector",
      skills: ["skill.collect"],
      toolkit_keys: ["feat.taskboard"],
      station_reachable: false,
      skill_package_path: "skills/collect/SKILL.md",
      prompt_spec: {
        identity_guards: ["Resolve current speaker"],
        human_gates: ["Confirm outbound communication"],
      },
    }],
    skills: [{
      id: "skill.collect",
      owner_worker: "worker.collector",
      reads: ["table.leads"],
      writes: ["table.leads"],
      toolkit_keys: ["feat.taskboard"],
    }],
    capabilities: ["feat.taskboard"],
    data_foundation: {
      mode: "new",
      tables: [{
        id: "table.leads",
        fields: [{ id: "field.owner", type: "user", link: null }],
      }],
      access_policies: [{
        id: "policy.sales",
        role_ref: "role.sales",
        resource: {
          table_id: "table.leads",
          field_ids: ["field.owner"],
        },
        actions: ["read", "create"],
        scope: "own",
        filters: [],
      }],
    },
    access_policies: [],
    assembly: { operations: [] },
    acceptance_cases: [
      { id: "acceptance.normal", category: "normal", steps: ["collect"] },
      { id: "acceptance.refusal", category: "refusal", steps: ["refuse"] },
      { id: "acceptance.permission", category: "permission", steps: ["deny"] },
      { id: "acceptance.human", category: "human-gate", steps: ["confirm"] },
    ],
  };
}

function codes(value, files = new Map(), extra = {}) {
  return validateCrossReferences(value, {
    toolkitKeys: new Set(["feat.taskboard"]),
    files,
    ...extra,
  }).map(({ code }) => code);
}

describe("cross-reference validation", () => {
  it.each([
    ["unknown worker skill", (p) => p.workers[0].skills.push("skill.missing"), "B_WORKER_SKILL_UNKNOWN"],
    ["unknown table", (p) => p.skills[0].writes.push("table.missing"), "B_TABLE_UNKNOWN"],
    ["unknown field", (p) => p.data_foundation.access_policies[0].resource.field_ids.push("field.missing"), "B_FIELD_UNKNOWN"],
    ["unknown toolkit", (p) => p.workers[0].toolkit_keys.push("feat.missing"), "B_TOOLKIT_UNKNOWN"],
    ["overbroad sales access", (p) => { p.data_foundation.access_policies[0].scope = "all"; }, "B_ACCESS_SCOPE"],
    ["write without identity guard", (p) => { p.workers[0].prompt_spec.identity_guards = []; }, "B_IDENTITY_GUARD"],
    ["station without external guard", (p) => { p.workers[0].station_reachable = true; }, "B_STATION_GUARD"],
    ["worker/skill toolkit drift", (p) => { p.workers[0].toolkit_keys = []; }, "B_WORKER_PAYLOAD_DRIFT"],
    ["high risk without human gate", (p) => { p.scenarios[0].human_gates = []; p.workers[0].prompt_spec.human_gates = []; }, "B_HUMAN_GATE_MISSING"],
    ["missing acceptance coverage", (p) => { p.acceptance_cases = p.acceptance_cases.slice(0, 1); }, "B_ACCEPTANCE_COVERAGE"],
  ])("reports %s with a stable code", (_name, mutate, expected) => {
    const value = validProject();
    mutate(value);
    expect(codes(value)).toContain(expected);
  });

  it("detects payload employee drift and unknown payload fields", () => {
    const value = validProject();
    value.assembly.operations = [{
      payload_file: "assembly/payloads/worker.json",
    }];
    const files = new Map([[
      "assembly/payloads/worker.json",
      {
        employee_id: "worker.other",
        skill_ids: ["skill.collect"],
        toolkit_keys: ["feat.taskboard"],
        field_ids: ["field.missing"],
      },
    ]]);
    const found = codes(value, files);
    expect(found).toContain("B_WORKER_PAYLOAD_DRIFT");
    expect(found).toContain("B_FIELD_UNKNOWN");
  });

  it("reports every missing declared payload, Skill, and employee file", () => {
    const value = validProject();
    value.assembly.operations = [{
      payload_file: "assembly/payloads/missing.json",
    }];
    const found = codes(value);
    expect(found.filter((code) =>
      code === "B_DECLARED_FILE_MISSING").length).toBeGreaterThanOrEqual(3);
  });

  it("reports duplicate declared payload and employee identities", () => {
    const value = validProject();
    value.assembly.operations = [
      { payload_file: "assembly/payloads/shared.json" },
      { payload_file: "assembly/payloads/shared.json" },
    ];
    const employee = {
      id: "worker.collector",
      skills: ["skill.collect"],
      toolkit_keys: ["feat.taskboard"],
      prompt_spec: value.workers[0].prompt_spec,
    };
    const files = new Map([
      ["assembly/payloads/shared.json", {}],
      ["skills/collect/SKILL.md", "# Skill\n"],
      ["employees/collector.md", employee],
      ["employees/collector-copy.md", employee],
    ]);
    expect(codes(value, files)).toContain("B_DECLARED_FILE_DUPLICATE");
  });

  it("reports a declared Skill path that is a symlink or non-regular entry", () => {
    const value = validProject();
    const files = new Map([
      ["skills/collect/SKILL.md", "# Skill\n"],
      ["employees/collector.md", {
        id: "worker.collector",
        skills: ["skill.collect"],
        toolkit_keys: ["feat.taskboard"],
        prompt_spec: value.workers[0].prompt_spec,
      }],
    ]);
    expect(codes(value, files, {
      unsafePaths: new Set(["skills/collect/SKILL.md"]),
    })).toContain("B_DECLARED_FILE_UNSAFE");
  });

  it("reports a project Skill whose declared owner does not exist", () => {
    const value = validProject();
    value.skills[0].owner_worker = "worker.missing";
    expect(codes(value)).toContain("B_SKILL_OWNER_UNKNOWN");
  });

  it("reports an owner that does not list its project Skill", () => {
    const value = validProject();
    value.workers[0].skills = [];
    expect(codes(value)).toContain("B_SKILL_OWNER_MISMATCH");
  });

  it("reports a project Skill listed by a worker other than its owner", () => {
    const value = validProject();
    value.workers.push({
      ...structuredClone(value.workers[0]),
      id: "worker.other",
      skills: ["skill.collect"],
      skill_package_path: "skills/other/SKILL.md",
    });
    expect(codes(value)).toContain("B_SKILL_OWNER_CONFLICT");
  });

  it("reports a missing package for every authoritative project Skill", () => {
    const value = validProject();
    value.workers[0].skills.push("skill.follow_up");
    value.skills.push({
      id: "skill.follow_up",
      owner_worker: "worker.collector",
      reads: [],
      writes: [],
      toolkit_keys: ["feat.taskboard"],
    });
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Primary Skill\n",
    ]]);
    expect(codes(value, files)).toContain("B_SKILL_PACKAGE_MISSING");
  });

  it("reports project Skills resolving to the same package path", () => {
    const value = validProject();
    value.workers[0].skills.push("skill.follow_up");
    value.workers[0].skill_package_path =
      "skills/follow-up/SKILL.md";
    value.skills.push({
      id: "skill.follow_up",
      owner_worker: "worker.collector",
      reads: [],
      writes: [],
      toolkit_keys: ["feat.taskboard"],
    });
    expect(codes(value)).toContain("B_SKILL_PACKAGE_DUPLICATE");
  });

  it("reports an unsafe package for an authoritative project Skill", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n",
    ]]);
    expect(codes(value, files, {
      unsafePaths: new Set(["skills/collect/SKILL.md"]),
    })).toContain("B_SKILL_PACKAGE_UNSAFE");
  });

  it.each([
    [
      "embedded worker wrapper",
      "assembly/payloads/worker.json",
      {
        operation_id: "team-private-digiworker.create",
        worker: {
          id: "worker.collector",
          skills: ["skill.collect"],
          toolkit_keys: ["feat.taskboard"],
          prompt_spec: {
            identity_guards: ["Resolve current speaker"],
            human_gates: ["Confirm outbound communication"],
          },
        },
      },
    ],
    [
      "employee hire wrapper",
      "assembly/payloads/hire.json",
      {
        operation_id: "employee-hire.create",
        worker_ref: "worker.collector",
        skill_set_refs: ["skillset.collect"],
      },
    ],
    [
      "skill set wrapper",
      "assembly/payloads/skill-set.json",
      {
        operation_id: "skill-set.create",
        skill_set: {
          id: "skillset.collect",
          skill_refs: ["skill.collect"],
        },
      },
    ],
  ])("rejects obsolete assembly payload %s", (_name, payloadPath, payload) => {
    const value = validProject();
    value.assembly.operations = [{ payload_file: payloadPath }];
    expect(codes(value, new Map([[payloadPath, payload]]))).toContain(
      "B_WORKER_PAYLOAD_DRIFT",
    );
  });

  it("detects worker drift in a structured employee document", () => {
    const value = validProject();
    const files = new Map([[
      "employees/collector.md",
      {
        id: "worker.collector",
        skills: ["skill.other"],
        toolkit_keys: ["feat.taskboard"],
        prompt_spec: value.workers[0].prompt_spec,
      },
    ]]);
    expect(codes(value, files)).toContain("B_WORKER_PAYLOAD_DRIFT");
  });

  it("detects camelCase promptSpec drift in an employee document", () => {
    const value = validProject();
    const files = new Map([[
      "employees/collector.md",
      {
        id: "worker.collector",
        skills: ["skill.collect"],
        toolkitKeys: ["feat.taskboard"],
        promptSpec: {
          ...value.workers[0].prompt_spec,
          objective: "drifted objective",
        },
      },
    ]]);
    expect(codes(value, files)).toContain("B_WORKER_PAYLOAD_DRIFT");
  });

  it("rejects skill runtime references escaping the package directory", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\nRead [customer design](../../design/team-design.md) at runtime.",
    ]]);
    expect(codes(value, files)).toContain("B_SKILL_RUNTIME_ESCAPE");
  });

  it("detects unknown field references in a Skill package document", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\nWrite `field.not_registered`.",
    ]]);
    expect(codes(value, files)).toContain("B_FIELD_UNKNOWN");
  });

  it("rejects encoded and root-absolute Skill runtime escapes", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\n[encoded](%2e%2e/%2e%2e/design.md)\n[root](/etc/passwd)",
    ]]);
    expect(codes(value, files).filter((code) =>
      code === "B_SKILL_RUNTIME_ESCAPE")).toHaveLength(2);
  });

  it("rejects an escaping Markdown reference definition", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\nRead [design][runtime].\n\n[runtime]: ../../design/team.md",
    ]]);
    expect(codes(value, files)).toContain("B_SKILL_RUNTIME_ESCAPE");
  });

  it("resolves the default Skill package path when worker path is omitted", () => {
    const value = validProject();
    delete value.workers[0].skill_package_path;
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\n[escape](../../design/team-design.md)",
    ]]);
    expect(codes(value, files)).toContain("B_SKILL_RUNTIME_ESCAPE");
  });

  it("scans every declared Skill when an explicit package path exists", () => {
    const value = validProject();
    value.workers[0].skills.push("skill.follow_up");
    value.skills.push({
      id: "skill.follow_up",
      owner_worker: "worker.collector",
      reads: ["table.leads"],
      writes: [],
      toolkit_keys: ["feat.taskboard"],
    });
    const files = new Map([
      [
        "skills/collect/SKILL.md",
        "# Primary Skill\n\n[external](https://example.com/reference)",
      ],
      [
        "skills/follow-up/SKILL.md",
        "# Second Skill\n\n[escape](../../design/team-design.md)",
      ],
    ]);
    expect(codes(value, files)).toContain("B_SKILL_RUNTIME_ESCAPE");
  });

  it("rejects local filesystem URI schemes in Skill runtime links", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\n[local secret](file:///etc/passwd)",
    ]]);
    expect(codes(value, files)).toContain("B_SKILL_RUNTIME_ESCAPE");
  });

  it("reports a runtime link whose ancestor is a project symlink", () => {
    const value = validProject();
    const files = new Map([[
      "skills/collect/SKILL.md",
      "# Skill\n\n[ref](references/runtime.md)",
    ]]);
    expect(codes(value, files, {
      unsafePaths: new Set(["skills/collect/references"]),
    })).toContain("B_SKILL_RUNTIME_ESCAPE");
  });

  it("does not accept unrelated category placeholders as business coverage", () => {
    const value = validProject();
    expect(codes(value)).toContain("B_ACCEPTANCE_COVERAGE");
  });

  it("does not accept a longer unrelated identifier as a target link", () => {
    const value = validProject();
    value.acceptance_cases = [
      ["normal", "success"],
      ["refusal", "refusal"],
      ["permission", "access"],
      ["human-gate", "human"],
    ].map(([category, suffix]) => ({
      id: `acceptance.${suffix}`,
      title: `scenario.collect skill.collect_extra ${suffix}`,
      category,
      preconditions: [],
      steps: ["exercise linked target"],
      expected_results: ["observable result"],
    }));
    expect(codes(value)).toContain("B_ACCEPTANCE_COVERAGE");
  });

  it("requires coverage for each supported write operation", () => {
    const value = validProject();
    value.assembly.operations = [{
      operation_id: "worker.deploy",
      description: "Deploy worker",
      support: "supported",
      operation_kind: "write",
    }];
    value.acceptance_cases = [
      ["normal", "success"],
      ["refusal", "refusal"],
      ["permission", "access"],
      ["human-gate", "human"],
    ].map(([category, suffix]) => ({
      id: `acceptance.${suffix}`,
      title: `scenario.collect skill.collect ${suffix}`,
      category,
      preconditions: [],
      steps: ["exercise linked target"],
      expected_results: ["observable result"],
    }));
    expect(codes(value)).toContain("B_ACCEPTANCE_COVERAGE");
  });

  it("accepts cases explicitly associated with each business target", () => {
    const value = validProject();
    value.assembly.operations = [{
      operation_id: "worker.deploy",
      description: "Deploy worker",
      support: "supported",
      operation_kind: "write",
    }];
    value.acceptance_cases = [
      ["normal", "success"],
      ["refusal", "refusal"],
      ["permission", "access"],
      ["human-gate", "human"],
    ].map(([category, suffix]) => ({
      id: `acceptance.${suffix}`,
      title: `scenario.collect skill.collect worker.deploy ${suffix}`,
      category,
      preconditions: [],
      steps: ["exercise linked target"],
      expected_results: ["observable result"],
    }));
    expect(codes(value).filter((code) =>
      code === "B_ACCEPTANCE_COVERAGE")).toEqual([]);
  });

  it("aggregates issues instead of stopping at the first", () => {
    const value = validProject();
    value.workers[0].skills.push("skill.missing");
    value.workers[0].toolkit_keys.push("feat.missing");
    expect(codes(value)).toEqual(expect.arrayContaining([
      "B_WORKER_SKILL_UNKNOWN",
      "B_TOOLKIT_UNKNOWN",
    ]));
  });
});
