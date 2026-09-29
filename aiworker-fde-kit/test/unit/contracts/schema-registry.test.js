import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, test } from "vitest";

import {
  SCHEMA_IDS,
  createOfficialSchemaRegistry,
  loadSchemas,
  validateSchema,
} from "../../../src/contracts/schema-registry.js";
import * as schemaRegistryModule from "../../../src/contracts/schema-registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMA_ROOT = path.join(ROOT, "schemas");
const SHA256 = "a".repeat(64);

function stage(status, dependsOn) {
  return {
    status,
    depends_on: dependsOn,
    baseline_revision: 0,
    input_hashes: {},
    output_hashes: {},
    approved_at: null,
  };
}

function validAssembly() {
  return {
    schema_version: 1,
    contract_version: "1.0.0",
    catalog_version: "1.0.0",
    payload_root: "assembly/payloads",
    operations: [],
    assembly_execution: {
      status: "not-generated",
      script_file: null,
      evidence_file: null,
      cli_package_version: null,
      cli_reported_version: null,
    },
  };
}

function validProject() {
  return {
    schema_version: 1,
    project: {
      name: "待初始化",
      slug: "pending-fde-project",
      customer_name: "待初始化",
      primary_scenario: "待初始化",
      entry_mode: "new",
      status: "draft",
      delivery_approved_at: null,
    },
    sources: [],
    requirements: {
      facts: [],
      assumptions: [],
      open_questions: [],
    },
    scenarios: [],
    roles: [],
    business_objects: [],
    workers: [],
    skills: [],
    capabilities: [],
    data_foundation: {
      schema_version: 1,
      mode: "none",
      app: null,
      tables: [],
      access_policies: [],
    },
    access_policies: [],
    assembly: validAssembly(),
    acceptance_cases: [],
    stage_status: {
      initialize: stage("not-started", []),
      discover: stage("not-started", ["initialize"]),
      "team-design": stage("not-started", ["discover"]),
      "foundation-design": stage("not-started", ["team-design"]),
      author: stage("not-started", ["foundation-design"]),
      assemble: stage("not-started", ["author"]),
      validate: stage("not-started", ["assemble"]),
    },
  };
}

function validWorker() {
  return {
    id: "worker.lead_collector",
    name: "线索收集专员",
    responsibility: "收集并确认线索",
    audience: "内部销售",
    skills: ["skill.collect_sales_leads"],
    toolkit_keys: ["feat.arcubase_user"],
    station_reachable: false,
    prompt_spec: {
      role: "内部线索收集专员",
      objective: "准确收集已确认的信息",
      boundaries: ["不得越权查询"],
      identity_guards: ["使用当前发言者身份"],
      human_gates: ["写入前取得明确确认"],
    },
    quick_starts: ["登记一条新线索"],
  };
}

function validArcubase() {
  return {
    schema_version: 1,
    mode: "new",
    app: {
      id: "app.lead_collection",
      name: "线索收集",
      ownership: "customer",
      isolation_boundary: "dedicated",
    },
    tables: [
      {
        id: "table.sales_leads",
        key: "sales_leads",
        name: "销售线索",
        fields: [
          {
            id: "field.company_name",
            key: "company_name",
            name: "公司名称",
            type: "text",
            required: true,
            select_options: [],
            link: null,
            states: [],
            derived: null,
          },
          {
            id: "field.source",
            key: "source",
            name: "来源",
            type: "select",
            required: true,
            select_options: [{ key: "1", name: "转介绍" }],
            link: null,
            states: [],
            derived: null,
          },
        ],
      },
    ],
    access_policies: [
      {
        id: "policy.sales-own",
        role_ref: "role.sales",
        resource: {
          table_id: "table.sales_leads",
          field_ids: [],
        },
        actions: ["read", "create"],
        scope: "own",
        filters: [],
      },
    ],
  };
}

function supportedWrite() {
  return {
    operation_id: "skill-set.create",
    description: "Create a validated skill set.",
    risk: "high",
    depends_on: [],
    executor: "octopus-cli",
    support: "supported",
    operation_kind: "write",
    command_path: ["configure", "skill", "set", "add"],
    payload_file: "assembly/payloads/skill-set-create.json",
    payload_schema_uri: SCHEMA_IDS.skillSetCreatePayload,
  };
}

function manualOperation() {
  return {
    operation_id: "skill-package.upload",
    description: "Upload the approved package through the administrator route.",
    risk: "high",
    depends_on: [],
    executor: "admin-manual",
    support: "manual-required",
    manual_artifacts: ["skills/approved-skill/"],
    manual_instructions: ["Use the administrator-approved upload interface."],
    verification_condition: "The approved package digest is visible.",
    recovery_condition: "An authorized administrator completes the route.",
  };
}

function blockedOperation() {
  return {
    operation_id: "required-capability.unavailable",
    description: "Record a capability blocker.",
    risk: "critical",
    depends_on: [],
    executor: "unavailable",
    support: "blocked",
    blocker_code: "B_CAPABILITY_UNAVAILABLE",
    blocker_reason: "No tested public or administrator route exists.",
    recovery_condition: "A tested route becomes available.",
  };
}

let schemas;
let registry;

async function withSchemaCopy(action) {
  const temporaryRoot = await mkdtemp(
    path.join(tmpdir(), "aiworker-schema-registry-"),
  );
  const schemaRoot = path.join(temporaryRoot, "schemas");
  await cp(SCHEMA_ROOT, schemaRoot, { recursive: true });
  try {
    return await action(schemaRoot);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function updateSchemaFile(schemaRoot, relativePath, update) {
  const schemaPath = path.join(schemaRoot, relativePath);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  update(schema);
  await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

beforeAll(async () => {
  schemas = await loadSchemas(SCHEMA_ROOT);
  registry = await createOfficialSchemaRegistry();
});

describe("schema registry", () => {
  test("loads all ten unique Draft 2020-12 public schemas", () => {
    expect(schemas).toHaveLength(10);
    expect(new Set(schemas.map(({ schema }) => schema.$id)).size).toBe(10);
    for (const { schema } of schemas) {
      expect(schema).toMatchObject({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: expect.any(String),
        type: "object",
      });
      expect(schema.$id).toMatch(
        /^https:\/\/schemas\.syngy\.ai\/aiworker-fde-kit\/v1\//u,
      );
    }
  });

  test("refuses to brand a caller-controlled schema root as official", async () => {
    await withSchemaCopy(async (schemaRoot) => {
      await updateSchemaFile(schemaRoot, "worker.schema.json", (schema) => {
        schema.required = [];
        schema.properties = {};
        schema.additionalProperties = true;
      });
      await expect(
        createOfficialSchemaRegistry(schemaRoot),
      ).rejects.toMatchObject({ code: "E_SCHEMA_ROOT_OVERRIDE" });

      expect(
        validateSchema(registry, SCHEMA_IDS.worker, {}).valid,
      ).toBe(false);
    });
  });

  test("rejects a missing official schema file", async () => {
    await withSchemaCopy(async (schemaRoot) => {
      await unlink(path.join(schemaRoot, "worker.schema.json"));
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_OFFICIAL_SET",
      });
    });
  });

  test("rejects an extra official schema file", async () => {
    await withSchemaCopy(async (schemaRoot) => {
      await writeFile(
        path.join(schemaRoot, "extra.schema.json"),
        JSON.stringify({
          $schema: "https://json-schema.org/draft/2020-12/schema",
          $id: "https://schemas.syngy.ai/aiworker-fde-kit/v1/extra.schema.json",
          title: "Extra",
          type: "object",
        }),
        "utf8",
      );
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_OFFICIAL_SET",
      });
    });
  });

  test.each([
    ["relative", "project.schema.json"],
    ["wrong namespace", "https://example.com/project.schema.json"],
  ])("rejects a %s official schema ID", async (_label, schemaId) => {
    await withSchemaCopy(async (schemaRoot) => {
      await updateSchemaFile(
        schemaRoot,
        "project.schema.json",
        (schema) => {
          schema.$id = schemaId;
        },
      );
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_OFFICIAL_ID",
      });
    });
  });

  test("rejects duplicate IDs while loading the official registry", async () => {
    await withSchemaCopy(async (schemaRoot) => {
      await updateSchemaFile(
        schemaRoot,
        "project.schema.json",
        (schema) => {
          schema.$id = SCHEMA_IDS.worker;
        },
      );
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_DUPLICATE_ID",
      });
    });
  });

  test("keeps schema-entry loading private and rejects official schema symlinks", async () => {
    expect(schemaRegistryModule).not.toHaveProperty("loadSchemaEntries");

    await withSchemaCopy(async (schemaRoot) => {
      const workerPath = path.join(schemaRoot, "worker.schema.json");
      await unlink(workerPath);
      await symlink("project.schema.json", workerPath);
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_PATH",
      });
    });

    await withSchemaCopy(async (schemaRoot) => {
      const workerPath = path.join(schemaRoot, "worker.schema.json");
      const outsidePath = path.join(path.dirname(schemaRoot), "outside.schema.json");
      await writeFile(outsidePath, "{}", "utf8");
      await unlink(workerPath);
      await symlink(outsidePath, workerPath);
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_PATH",
      });
    });

    await withSchemaCopy(async (schemaRoot) => {
      const workerPath = path.join(schemaRoot, "worker.schema.json");
      await unlink(workerPath);
      await symlink("missing.schema.json", workerPath);
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_PATH",
      });
    });

    await withSchemaCopy(async (schemaRoot) => {
      const payloadDirectory = path.join(schemaRoot, "payloads");
      await rm(payloadDirectory, { recursive: true });
      await symlink(".", payloadDirectory);
      await expect(loadSchemas(schemaRoot)).rejects.toMatchObject({
        code: "E_SCHEMA_PATH",
      });
    });
  });

  test("exposes an immutable opaque registry that preserves official validation", () => {
    expect(schemaRegistryModule).not.toHaveProperty("compileSchemas");
    expect(Object.keys(registry).sort()).toEqual(["has", "ids", "validate"]);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.ids)).toBe(true);
    expect(Object.isFrozen(registry.has)).toBe(true);
    expect(Object.isFrozen(registry.validate)).toBe(true);
    expect(registry).not.toHaveProperty("ajv");
    expect(registry).not.toHaveProperty("validators");
    expect(registry.has(SCHEMA_IDS.worker)).toBe(true);

    const invalidWorker = { ...validWorker(), unexpected: true };
    const expectStrictValidation = () => {
      expect(registry.validate(SCHEMA_IDS.worker, invalidWorker).valid).toBe(
        false,
      );
      expect(
        validateSchema(registry, SCHEMA_IDS.worker, invalidWorker).valid,
      ).toBe(false);
    };
    expectStrictValidation();

    for (const mutate of [
      () => registry.ids.push("https://example.com/replacement"),
      () => {
        registry.ids[0] = "https://example.com/replacement";
      },
      () => {
        registry.ids = [];
      },
      () => {
        registry.has.extra = true;
      },
      () => {
        registry.has = () => false;
      },
      () => {
        registry.validate.extra = true;
      },
      () => {
        registry.validate = () => ({ valid: true, errors: [] });
      },
      () => {
        registry.extra = true;
      },
      () => Object.defineProperty(registry, "validate", { value: () => true }),
    ]) {
      expect(mutate).toThrow();
      expectStrictValidation();
    }

    expect(Reflect.deleteProperty(registry, "ids")).toBe(false);
    expect(Reflect.deleteProperty(registry, "has")).toBe(false);
    expect(Reflect.deleteProperty(registry, "validate")).toBe(false);
    expectStrictValidation();

    expect(() =>
      validateSchema(
        { validate: () => ({ valid: true, errors: [] }) },
        SCHEMA_IDS.worker,
        invalidWorker,
      ),
    ).toThrowError(expect.objectContaining({ code: "E_SCHEMA_REGISTRY" }));
  });

  test("returns stable validation errors without mutating input", () => {
    const invalid = validProject();
    invalid.project.slug = "Not ASCII";
    const snapshot = structuredClone(invalid);

    const first = validateSchema(registry, SCHEMA_IDS.project, invalid);
    const second = validateSchema(registry, SCHEMA_IDS.project, invalid);

    expect(first.valid).toBe(false);
    expect(first.errors).toEqual(second.errors);
    expect(invalid).toEqual(snapshot);
  });
});

describe("core schemas", () => {
  test("accepts the strict project envelope and exact seven stage dependencies", () => {
    expect(validateSchema(registry, SCHEMA_IDS.project, validProject())).toEqual({
      valid: true,
      errors: [],
    });

    const wrongDependency = validProject();
    wrongDependency.stage_status.author.depends_on = ["discover"];
    expect(
      validateSchema(registry, SCHEMA_IDS.project, wrongDependency).valid,
    ).toBe(false);

    const extraStage = validProject();
    extraStage.stage_status.publish = stage("not-started", ["validate"]);
    expect(validateSchema(registry, SCHEMA_IDS.project, extraStage).valid).toBe(
      false,
    );
  });

  test("enforces relative hash paths and lowercase SHA-256 values", () => {
    const valid = validProject();
    valid.stage_status.initialize.input_hashes["inputs/input-inventory.md"] =
      SHA256;
    expect(validateSchema(registry, SCHEMA_IDS.project, valid).valid).toBe(true);

    const escaped = validProject();
    escaped.stage_status.initialize.input_hashes["../secret"] = SHA256;
    expect(validateSchema(registry, SCHEMA_IDS.project, escaped).valid).toBe(
      false,
    );

    const uppercase = validProject();
    uppercase.stage_status.initialize.output_hashes["fde-project.yaml"] =
      SHA256.toUpperCase();
    expect(validateSchema(registry, SCHEMA_IDS.project, uppercase).valid).toBe(
      false,
    );
  });

  test("keeps data_foundation.tables as the only top-level table source", () => {
    const duplicateSource = { ...validProject(), tables: [] };
    expect(
      validateSchema(registry, SCHEMA_IDS.project, duplicateSource).valid,
    ).toBe(false);

    const invalidNone = validProject();
    invalidNone.data_foundation.tables = validArcubase().tables;
    expect(
      validateSchema(registry, SCHEMA_IDS.project, invalidNone).valid,
    ).toBe(false);

    const noneWithRootPolicy = validProject();
    noneWithRootPolicy.access_policies = validArcubase().access_policies;
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.project,
        noneWithRootPolicy,
      ).valid,
    ).toBe(false);
  });

  test("enforces disjoint copied-file, reference-file, and non-file source envelopes", () => {
    const copied = validProject();
    copied.sources = [
      {
        id: "source.requirements",
        title: "需求资料",
        kind: "file",
        portable: true,
        status: "copied",
        source_mode: "copy",
        original_path: "/provided/requirements.txt",
        copy_path: "inputs/source-files/requirements.txt",
        media_type: "text/plain",
        read_status: "pending",
        sha256: SHA256,
        copied_at: "2026-07-24T00:00:00Z",
      },
    ];
    expect(validateSchema(registry, SCHEMA_IDS.project, copied).valid).toBe(true);

    const readableCopy = structuredClone(copied);
    readableCopy.sources[0].status = "readable";
    expect(
      validateSchema(registry, SCHEMA_IDS.project, readableCopy).valid,
    ).toBe(true);

    const referenced = structuredClone(copied);
    referenced.sources[0] = {
      ...referenced.sources[0],
      portable: false,
      status: "reference-only",
      source_mode: "reference",
    };
    delete referenced.sources[0].copy_path;
    delete referenced.sources[0].copied_at;
    expect(
      validateSchema(registry, SCHEMA_IDS.project, referenced).valid,
    ).toBe(true);

    referenced.sources[0].original_path = "relative/requirements.txt";
    expect(
      validateSchema(registry, SCHEMA_IDS.project, referenced).valid,
    ).toBe(false);

    referenced.sources[0].original_path = "/provided/requirements\u0000.txt";
    expect(
      validateSchema(registry, SCHEMA_IDS.project, referenced).valid,
    ).toBe(false);

    const incomplete = validProject();
    incomplete.sources = [
      {
        id: "source.requirements",
        title: "需求资料",
        kind: "file",
        portable: false,
        status: "reference-only",
      },
    ];
    expect(
      validateSchema(registry, SCHEMA_IDS.project, incomplete).valid,
    ).toBe(false);

    const interview = validProject();
    interview.sources = [
      {
        id: "source.discovery_interview",
        title: "需求访谈",
        kind: "interview",
        portable: true,
        status: "recorded",
        evidence_text: "客户确认线索登记需要人工复核。",
        recorded_at: "2026-07-24T00:00:00Z",
      },
    ];
    expect(validateSchema(registry, SCHEMA_IDS.project, interview).valid).toBe(
      true,
    );

    const nonPortableInterview = structuredClone(interview);
    nonPortableInterview.sources[0].portable = false;
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.project,
        nonPortableInterview,
      ).valid,
    ).toBe(false);

    const unspecifiedPortability = structuredClone(interview);
    delete unspecifiedPortability.sources[0].portable;
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.project,
        unspecifiedPortability,
      ).valid,
    ).toBe(false);

    const copiedAsReference = structuredClone(copied);
    copiedAsReference.sources[0].status = "reference-only";
    expect(
      validateSchema(registry, SCHEMA_IDS.project, copiedAsReference).valid,
    ).toBe(false);

    const referenceWithCopyMetadata = structuredClone(referenced);
    referenceWithCopyMetadata.sources[0].copy_path =
      "inputs/source-files/requirements.txt";
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.project,
        referenceWithCopyMetadata,
      ).valid,
    ).toBe(false);

    const copiedWithLegacyPath = structuredClone(copied);
    copiedWithLegacyPath.sources[0].path = "inputs/legacy.txt";
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.project,
        copiedWithLegacyPath,
      ).valid,
    ).toBe(false);

    const interviewWithFileMetadata = structuredClone(interview);
    interviewWithFileMetadata.sources[0].sha256 = SHA256;
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.project,
        interviewWithFileMetadata,
      ).valid,
    ).toBe(false);

    const missingEvidence = structuredClone(interview);
    delete missingEvidence.sources[0].evidence_text;
    expect(
      validateSchema(registry, SCHEMA_IDS.project, missingEvidence).valid,
    ).toBe(false);
  });

  test("validates strict worker definitions and toolkit keys", () => {
    expect(validateSchema(registry, SCHEMA_IDS.worker, validWorker()).valid).toBe(
      true,
    );

    const invalid = { ...validWorker(), toolkit_keys: ["arcubase_user"] };
    expect(validateSchema(registry, SCHEMA_IDS.worker, invalid).valid).toBe(
      false,
    );

    const escaped = {
      ...validWorker(),
      skill_package_path: "../outside/SKILL.md",
    };
    expect(validateSchema(registry, SCHEMA_IDS.worker, escaped).valid).toBe(
      false,
    );
  });

  test("enforces Arcubase none/new mode conditions and select options", () => {
    const none = validProject().data_foundation;
    expect(validateSchema(registry, SCHEMA_IDS.arcubase, none).valid).toBe(true);
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, validArcubase()).valid,
    ).toBe(true);

    const missingApp = validArcubase();
    missingApp.app = null;
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, missingApp).valid,
    ).toBe(false);

    const emptySelect = validArcubase();
    emptySelect.tables[0].fields[1].select_options = [];
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, emptySelect).valid,
    ).toBe(false);

    const irrelevantValues = {
      select_options: [{ key: "unexpected", name: "不适用" }],
      link: {
        target_table: "table.sales_leads",
        cardinality: "many-to-one",
      },
      states: [{ key: "unexpected", name: "不适用", terminal: false }],
      derived: {
        owner_worker: "worker.lead_collector",
        rule: "不适用于普通文本字段",
      },
    };
    for (const [property, value] of Object.entries(irrelevantValues)) {
      const irrelevantMetadata = validArcubase();
      irrelevantMetadata.tables[0].fields[0][property] = value;
      expect(
        validateSchema(
          registry,
          SCHEMA_IDS.arcubase,
          irrelevantMetadata,
        ).valid,
        property,
      ).toBe(false);
    }

    const formula = validArcubase();
    formula.tables[0].fields[0].type = "formula";
    formula.tables[0].fields[0].derived = {
      owner_worker: "worker.lead_collector",
      rule: "由员工根据已确认输入计算",
    };
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, formula).valid,
    ).toBe(true);

    const noneWithPolicy = validProject().data_foundation;
    noneWithPolicy.access_policies = validArcubase().access_policies;
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, noneWithPolicy).valid,
    ).toBe(false);

    const missingResource = validArcubase();
    delete missingResource.access_policies[0].resource;
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, missingResource).valid,
    ).toBe(false);

    const tableWideResource = validArcubase();
    delete tableWideResource.access_policies[0].resource.field_ids;
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, tableWideResource).valid,
    ).toBe(true);

    const filteredWithoutFilters = validArcubase();
    filteredWithoutFilters.access_policies[0].scope = "filtered";
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.arcubase,
        filteredWithoutFilters,
      ).valid,
    ).toBe(false);

    const validFiltered = validArcubase();
    validFiltered.access_policies[0].scope = "filtered";
    validFiltered.access_policies[0].filters = [
      {
        field_id: "field.company_name",
        operator: "equals",
        value_source: {
          literal: "待核验值",
        },
      },
    ];
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, validFiltered).valid,
    ).toBe(true);

    const unsafeLiteral = structuredClone(validFiltered);
    unsafeLiteral.access_policies[0].filters[0].value_source = {
      literal: {
        nested: "objects are not safe filter literals",
      },
    };
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, unsafeLiteral).valid,
    ).toBe(false);

    const ownWithFilters = structuredClone(validFiltered);
    ownWithFilters.access_policies[0].scope = "own";
    expect(
      validateSchema(registry, SCHEMA_IDS.arcubase, ownWithFilters).valid,
    ).toBe(false);
  });
});

describe("assembly schemas", () => {
  test.each([
    ["supported", supportedWrite()],
    ["manual-required", manualOperation()],
    ["blocked", blockedOperation()],
  ])("accepts the mutually exclusive %s envelope", (_label, operation) => {
    expect(
      validateSchema(registry, SCHEMA_IDS.assemblyOperation, operation),
    ).toEqual({ valid: true, errors: [] });
  });

  test("requires a payload pair for writes and explicit nulls for reads", () => {
    const writeWithoutPayload = supportedWrite();
    delete writeWithoutPayload.payload_file;
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.assemblyOperation,
        writeWithoutPayload,
      ).valid,
    ).toBe(false);

    const writeOutsidePayloadRoot = supportedWrite();
    writeOutsidePayloadRoot.payload_file = "reports/not-a-payload.json";
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.assemblyOperation,
        writeOutsidePayloadRoot,
      ).valid,
    ).toBe(false);

    const escapingPayload = supportedWrite();
    escapingPayload.payload_file =
      "assembly/payloads/a/../../../../secrets.json";
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.assemblyOperation,
        escapingPayload,
      ).valid,
    ).toBe(false);

    const read = {
      ...supportedWrite(),
      operation_id: "worker.list",
      operation_kind: "read",
      command_path: ["worker", "list"],
      payload_file: null,
      payload_schema_uri: null,
    };
    expect(
      validateSchema(registry, SCHEMA_IDS.assemblyOperation, read).valid,
    ).toBe(true);

    read.payload_file = "assembly/payloads/not-allowed.json";
    expect(
      validateSchema(registry, SCHEMA_IDS.assemblyOperation, read).valid,
    ).toBe(false);
  });

  test("accepts the catalog-relative payload schema URI form", () => {
    const operation = supportedWrite();
    operation.payload_schema_uri =
      "schemas/payloads/skill-set-create.schema.json";
    expect(
      validateSchema(registry, SCHEMA_IDS.assemblyOperation, operation).valid,
    ).toBe(true);
  });

  test("prevents fields from overlapping between operation envelopes", () => {
    expect(
      validateSchema(registry, SCHEMA_IDS.assemblyOperation, {
        ...manualOperation(),
        command_path: ["skill", "upload"],
      }).valid,
    ).toBe(false);
    expect(
      validateSchema(registry, SCHEMA_IDS.assemblyOperation, {
        ...blockedOperation(),
        manual_artifacts: ["manual.md"],
      }).valid,
    ).toBe(false);
  });

  test("validates the whole ordered assembly plan", () => {
    const assembly = validAssembly();
    assembly.operations = [
      supportedWrite(),
      manualOperation(),
      blockedOperation(),
    ];
    expect(
      validateSchema(registry, SCHEMA_IDS.assembly, assembly).valid,
    ).toBe(true);
  });

  test("couples assembly execution status to generated artifacts and evidence", () => {
    const invalidExecuted = validAssembly();
    invalidExecuted.assembly_execution.status = "executed";
    expect(
      validateSchema(registry, SCHEMA_IDS.assembly, invalidExecuted).valid,
    ).toBe(false);

    const invalidNotApplicable = validAssembly();
    invalidNotApplicable.assembly_execution.status = "not-applicable";
    invalidNotApplicable.assembly_execution.script_file =
      "assembly/octopus-cli-assemble.sh";
    expect(
      validateSchema(
        registry,
        SCHEMA_IDS.assembly,
        invalidNotApplicable,
      ).valid,
    ).toBe(false);

    const executed = validAssembly();
    executed.assembly_execution = {
      status: "executed",
      script_file: "assembly/octopus-cli-assemble.sh",
      evidence_file: "reports/cli-assemble-evidence.json",
      cli_package_version: "0.1.1",
      cli_reported_version: "0.1.0",
    };
    expect(validateSchema(registry, SCHEMA_IDS.assembly, executed).valid).toBe(
      true,
    );
  });
});

describe("provisional public payload contracts", () => {
  test.each([
    [
      SCHEMA_IDS.skillUploadPayload,
      {
        slug: "collect-sales-leads",
        content: "---\nname: collect-sales-leads\n---\n\n# Collect Sales Leads\n",
      },
    ],
    [
      SCHEMA_IDS.employeeSkillsetsSetPayload,
      {
        skillsets: [{ id: "ss_collect_sales_leads" }],
      },
    ],
    [
      SCHEMA_IDS.skillSetCreatePayload,
      {
        name: "线索收集技能集",
        description: "收集、补齐、确认并登记客户线索。",
      },
    ],
    [
      SCHEMA_IDS.teamPrivateDigiworkerCreatePayload,
      {
        name: "小采 · 线索收集专员",
        bio: "收集、补齐、确认并登记客户线索。",
        promptSpec: {
          type: "static",
          text: "你是内部客户线索收集专员。你在身份与权限边界内可靠地登记和查询销售线索。",
        },
        quickStartPrompts: ["登记一条客户线索"],
        homeMode: "user",
        llmModelId: "lm_default",
        thinkingConfig: { type: "enabled", effort: "low" },
        toolkitKeys: ["feat.arcubase_user"],
        teamSkillIds: ["tskill_collect_sales_leads"],
      },
    ],
    [
      SCHEMA_IDS.employeeHireCreatePayload,
      {
        digiWorkerId: "dgw_existing_worker",
      },
    ],
  ])("validates %s and rejects credentials", (schemaId, payload) => {
    expect(validateSchema(registry, schemaId, payload).valid).toBe(true);
    expect(
      validateSchema(registry, schemaId, {
        ...payload,
        credentials: { token: "secret" },
      }).valid,
    ).toBe(false);
  });

  test("rejects non-API-native team private digiworker promptSpec and thinking fields", () => {
    const invalid = {
      name: "小采 · 线索收集专员",
      promptSpec: {
        role: "内部客户线索收集专员",
        objective: "在身份与权限边界内可靠地登记和查询销售线索。",
      },
      thinkingConfig: { type: "enabled", reasoningEffort: "low" },
    };
    const valid = {
      name: "小采 · 线索收集专员",
      promptSpec: {
        type: "static",
        text: "你是内部客户线索收集专员。",
      },
      thinkingConfig: { type: "enabled", effort: "low" },
    };

    expect(
      validateSchema(registry, SCHEMA_IDS.teamPrivateDigiworkerCreatePayload, invalid)
        .valid,
    ).toBe(false);
    expect(
      validateSchema(registry, SCHEMA_IDS.teamPrivateDigiworkerCreatePayload, valid)
        .valid,
    ).toBe(true);
  });

  test.each([
    [
      SCHEMA_IDS.skillUploadPayload,
      {
        schema_version: 1,
        operation_id: "skill.upload",
        skill: {
          slug: "collect-sales-leads",
          path: "skills/collect-sales-leads/SKILL.md",
        },
      },
    ],
    [
      SCHEMA_IDS.employeeSkillsetsSetPayload,
      {
        schema_version: 1,
        operation_id: "employee.skillsets.set",
        skill_set_refs: ["skillset.lead_collection"],
      },
    ],
    [
      SCHEMA_IDS.skillSetCreatePayload,
      {
        schema_version: 1,
        contract_version: "1.0.0",
        contract_status: "provisional-tested",
        operation_id: "skill-set.create",
        skill_set: {
          id: "skillset.lead_collection",
          name: "线索收集技能集",
          skill_refs: ["skill.collect_sales_leads"],
        },
      },
    ],
    [
      SCHEMA_IDS.teamPrivateDigiworkerCreatePayload,
      {
        schema_version: 1,
        contract_version: "1.0.0",
        contract_status: "provisional-tested",
        operation_id: "team-private-digiworker.create",
        worker: validWorker(),
      },
    ],
    [
      SCHEMA_IDS.employeeHireCreatePayload,
      {
        schema_version: 1,
        contract_version: "1.0.0",
        contract_status: "provisional-tested",
        operation_id: "employee-hire.create",
        worker_ref: "worker.lead_collector",
        skill_set_refs: ["skillset.lead_collection"],
      },
    ],
  ])("rejects obsolete wrapped FDE payload for %s", (schemaId, payload) => {
    expect(validateSchema(registry, schemaId, payload).valid).toBe(false);
  });
});
