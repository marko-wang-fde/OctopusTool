import { issue } from "../shared/result.js";

const SCHEMA_PREFIX =
  "https://schemas.syngy.ai/aiworker-fde-kit/v1/";
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;
const PAYLOAD_PATTERN =
  /^assembly\/payloads\/[a-z0-9][a-z0-9._/-]*\.json$/u;
const COMMON_KEYS = [
  "operation_id",
  "description",
  "risk",
  "depends_on",
];
const ENVELOPE_KEYS = {
  supported: new Set([
    ...COMMON_KEYS,
    "executor",
    "support",
    "operation_kind",
    "command_path",
    "payload_file",
    "payload_schema_uri",
    "output_bindings",
    "positional_bindings",
    "payload_bindings",
  ]),
  "manual-required": new Set([
    ...COMMON_KEYS,
    "executor",
    "support",
    "manual_artifacts",
    "manual_instructions",
    "verification_condition",
    "recovery_condition",
  ]),
  blocked: new Set([
    ...COMMON_KEYS,
    "executor",
    "support",
    "blocker_code",
    "blocker_reason",
    "recovery_condition",
  ]),
};

function blocker(code, issuePath, message, details = {}) {
  return issue("BLOCKER", code, issuePath, message, {
    stage: "assemble",
    ...details,
  });
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function officialSchemaUri(value) {
  if (typeof value !== "string") return null;
  if (value.startsWith(SCHEMA_PREFIX)) return value;
  if (value.startsWith("schemas/")) {
    return `${SCHEMA_PREFIX}${value.slice("schemas/".length)}`;
  }
  return null;
}

function exactEnvelope(operation) {
  const allowed = ENVELOPE_KEYS[operation?.support];
  if (!allowed) return false;
  return Object.keys(operation).every((key) => allowed.has(key));
}

function catalogMap(catalog) {
  return new Map([
    ...(catalog?.supported ?? []),
    ...(catalog?.manual_required ?? []),
  ].map((operation) => [operation.operation_id, operation]));
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function expandManualArtifacts(templates, artifactVariables) {
  if (!Array.isArray(templates)) return null;
  const expanded = [];
  for (const template of templates) {
    if (typeof template !== "string") return null;
    const variables = [
      ...template.matchAll(/<([a-z][a-z0-9-]*)>/gu),
    ].map((match) => match[1]);
    if (variables.length === 0) {
      expanded.push(template);
      continue;
    }
    if (
      variables.length !== 1 ||
      !(artifactVariables instanceof Map)
    ) return null;
    const values = artifactVariables.get(variables[0]);
    if (
      !Array.isArray(values) ||
      values.length === 0 ||
      values.some((value) =>
        typeof value !== "string" ||
        !/^[a-z0-9][a-z0-9-]*$/u.test(value))
    ) return null;
    expanded.push(...values.map((value) =>
      template.replaceAll(`<${variables[0]}>`, value)));
  }
  return expanded;
}

function exactStringArray(left, right, matcher = (a, b) => a === b) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => matcher(right[index], value))
  );
}

function validVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/u.test(value);
}

function validateExecutionState(plan, supportedWriteCount, issues) {
  const execution = plan?.assembly_execution;
  const fail = (reason) => issues.push(blocker(
    "B_ASSEMBLY_EXECUTION_STATE",
    "assembly.assembly_execution",
    reason,
  ));
  if (!execution || typeof execution !== "object" || Array.isArray(execution)) {
    fail("Assembly execution state is missing.");
    return;
  }
  const {
    status,
    script_file: scriptFile,
    evidence_file: evidenceFile,
    cli_package_version: packageVersion,
    cli_reported_version: reportedVersion,
  } = execution;
  const noVersions = packageVersion === null && reportedVersion === null;
  const pairedVersions =
    validVersion(packageVersion) && validVersion(reportedVersion);
  if (supportedWriteCount === 0) {
    if (
      status !== "not-applicable" ||
      scriptFile !== null ||
      evidenceFile !== null ||
      !noVersions
    ) {
      fail("A plan without supported writes must be exactly not-applicable with no script, evidence, or CLI versions.");
    }
    return;
  }
  if (status === "not-generated") {
    if (scriptFile !== null || evidenceFile !== null || !noVersions) {
      fail("A not-generated assembly execution must not claim a script, evidence, or CLI versions.");
    }
    return;
  }
  if (status === "ready") {
    if (
      scriptFile !== "assembly/octopus-cli-assemble.sh" ||
      evidenceFile !== null ||
      !pairedVersions
    ) {
      fail("A ready assembly execution requires the fixed script path, paired CLI versions, and no run evidence.");
    }
    return;
  }
  if (status === "executed") {
    if (
      scriptFile !== "assembly/octopus-cli-assemble.sh" ||
      evidenceFile !== "reports/cli-assemble-evidence.json" ||
      !pairedVersions
    ) {
      fail("An executed assembly requires fixed script/evidence paths and paired CLI versions.");
    }
    return;
  }
  if (status === "blocked") {
    if (
      scriptFile !== null ||
      evidenceFile !== null ||
      !(noVersions || pairedVersions)
    ) {
      fail("A blocked assembly execution must not claim a script or successful evidence.");
    }
    return;
  }
  fail("A plan with supported writes has an invalid assembly execution status.");
}

function stableTopologicalOrder(operations, issues) {
  const byId = new Map(
    operations.map((operation) => [operation.operation_id, operation]),
  );
  const indegree = new Map(operations.map((operation) => [
    operation.operation_id,
    0,
  ]));
  const downstream = new Map(
    operations.map((operation) => [operation.operation_id, []]),
  );
  for (const operation of operations) {
    for (const dependency of operation.depends_on ?? []) {
      if (!byId.has(dependency)) {
        issues.push(blocker(
          "B_ASSEMBLY_DEPENDENCY",
          `assembly.operations.${operation.operation_id}.depends_on`,
          `Assembly dependency does not exist: ${dependency}.`,
        ));
        continue;
      }
      indegree.set(
        operation.operation_id,
        indegree.get(operation.operation_id) + 1,
      );
      downstream.get(dependency).push(operation.operation_id);
    }
  }
  const ready = [...indegree]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort(compareUtf8);
  const ordered = [];
  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(byId.get(id));
    for (const child of downstream.get(id).sort(compareUtf8)) {
      indegree.set(child, indegree.get(child) - 1);
      if (indegree.get(child) === 0) {
        ready.push(child);
        ready.sort(compareUtf8);
      }
    }
  }
  if (ordered.length !== operations.length) {
    issues.push(blocker(
      "B_ASSEMBLY_CYCLE",
      "assembly.operations",
      "Assembly dependency graph contains a cycle.",
    ));
    return [];
  }
  return ordered;
}

export function validateAssemblyPlan(
  plan,
  {
    catalog,
    registry,
    payloads = new Map(),
    artifactVariables = new Map(),
  } = {},
) {
  const issues = [];
  if (
    !plan ||
    typeof plan !== "object" ||
    !Array.isArray(plan.operations)
  ) {
    return {
      issues: [blocker(
        "B_ASSEMBLY_PLAN",
        "assembly/operations.yaml",
        "Assembly plan must contain an operations array.",
      )],
      orderedOperations: [],
      supportedWrites: [],
    };
  }
  if (plan.catalog_version !== catalog?.catalog_version) {
    issues.push(blocker(
      "B_ASSEMBLY_CATALOG_VERSION",
      "assembly.catalog_version",
      "Assembly plan catalog version does not match the Kit catalog.",
    ));
  }
  const known = catalogMap(catalog);
  const seenIds = new Set();
  const payloadOwners = new Map();
  let dagSafe = true;
  for (const [index, operation] of plan.operations.entries()) {
    const issuePath = `assembly.operations[${index}]`;
    if (
      !operation ||
      typeof operation !== "object" ||
      !ID_PATTERN.test(operation.operation_id ?? "") ||
      seenIds.has(operation.operation_id)
    ) {
      dagSafe = false;
      issues.push(blocker(
        "B_ASSEMBLY_OPERATION_ID",
        issuePath,
        "Assembly operation IDs must be unique safe identifiers.",
      ));
      continue;
    }
    seenIds.add(operation.operation_id);
    if (!exactEnvelope(operation)) {
      issues.push(blocker(
        "B_ASSEMBLY_ENVELOPE",
        issuePath,
        "Assembly operation must use exactly one supported, manual-required, or blocked envelope.",
      ));
    }
    if (
      !Array.isArray(operation.depends_on) ||
      new Set(operation.depends_on).size !== operation.depends_on.length ||
      operation.depends_on.some((id) => !ID_PATTERN.test(id))
    ) {
      dagSafe = false;
      issues.push(blocker(
        "B_ASSEMBLY_DEPENDENCY",
        `${issuePath}.depends_on`,
        "Assembly dependencies must be unique safe operation IDs.",
      ));
    }
    const contract = known.get(operation.operation_id);
    if (
      operation.support !== "blocked" &&
      (!contract || contract.support !== operation.support)
    ) {
      issues.push(blocker(
        "B_ASSEMBLY_CATALOG_OPERATION",
        issuePath,
        "Assembly operation is absent from the selected catalog envelope.",
      ));
    }
    if (operation.support === "blocked") {
      issues.push(blocker(
        operation.blocker_code ?? "B_ASSEMBLY_BLOCKED",
        issuePath,
        operation.blocker_reason ?? "Assembly operation is blocked.",
        { recovery_condition: operation.recovery_condition },
      ));
    }
    if (operation.support === "manual-required" && contract) {
      const expectedArtifacts = expandManualArtifacts(
        contract.manual_artifacts,
        artifactVariables,
      );
      const manualBound =
        operation.executor === contract.executor &&
        operation.risk === contract.risk_level &&
        exactStringArray(
          operation.manual_artifacts,
          expectedArtifacts,
        ) &&
        exactStringArray(
          operation.manual_instructions,
          contract.manual_instructions,
        ) &&
        operation.recovery_condition === contract.recovery_condition &&
        operation.verification_condition ===
          contract.verification_condition;
      if (!manualBound) {
        issues.push(blocker(
          "B_ASSEMBLY_CATALOG_BINDING",
          issuePath,
          "Manual operation fields must exactly match the catalog, allowing only registered artifact-variable expansion.",
        ));
      }
    }
    if (operation.support !== "supported") continue;
    const supportedBound =
      plan.contract_version === contract?.contract_version &&
      operation.risk === contract?.risk_level &&
      operation.executor === contract?.executor &&
      sameArray(operation.command_path, contract?.command_path) &&
      officialSchemaUri(operation.payload_schema_uri) ===
        officialSchemaUri(contract?.payload_schema_uri);
    if (!supportedBound) {
      issues.push(blocker(
        "B_ASSEMBLY_CATALOG_BINDING",
        issuePath,
        "Supported operation contract version, risk, executor, command, and schema must exactly match the catalog.",
      ));
    }
    if (
      operation.executor !== "octopus-cli" ||
      operation.operation_kind !== "write" ||
      !sameArray(operation.command_path, contract?.command_path)
    ) {
      issues.push(blocker(
        "B_ASSEMBLY_COMMAND",
        issuePath,
        "Supported writes must exactly match the catalog command path.",
      ));
    }
    const expectsPayload = contract?.options?.payload === "--body-file";
    if (
      typeof operation.payload_file !== "string" ||
      !PAYLOAD_PATTERN.test(operation.payload_file) ||
      operation.payload_file.split("/").some((part) =>
        part === "." || part === "..")
    ) {
      if (expectsPayload) {
        issues.push(blocker(
          operation.payload_file == null
            ? "B_ASSEMBLY_PAYLOAD"
            : "B_ASSEMBLY_PAYLOAD_PATH",
          `${issuePath}.payload_file`,
          "Every supported write with a catalog payload option requires one contained JSON payload file.",
        ));
      } else if (operation.payload_file !== null) {
        issues.push(blocker(
          "B_ASSEMBLY_PAYLOAD",
          `${issuePath}.payload_file`,
          "Supported writes without a catalog payload option must declare payload_file: null.",
        ));
      }
    } else {
      if (!expectsPayload) {
        issues.push(blocker(
          "B_ASSEMBLY_PAYLOAD",
          `${issuePath}.payload_file`,
          "Supported writes without a catalog payload option must not declare a payload file.",
        ));
      }
      if (payloadOwners.has(operation.payload_file)) {
        issues.push(blocker(
          "B_ASSEMBLY_PAYLOAD_DUPLICATE",
          `${issuePath}.payload_file`,
          "A supported-write payload file must belong to exactly one operation.",
          { first_operation: payloadOwners.get(operation.payload_file) },
        ));
      }
      payloadOwners.set(operation.payload_file, operation.operation_id);
      if (!payloads.has(operation.payload_file)) {
        issues.push(blocker(
          "B_ASSEMBLY_PAYLOAD",
          operation.payload_file,
          "Declared assembly payload file is missing or unreadable.",
        ));
      }
    }
    const schemaUri = officialSchemaUri(operation.payload_schema_uri);
    const catalogSchema = officialSchemaUri(contract?.payload_schema_uri);
    if (!expectsPayload) {
      if (operation.payload_schema_uri !== null || contract?.payload_schema_uri !== null) {
        issues.push(blocker(
          "B_ASSEMBLY_SCHEMA_URI",
          `${issuePath}.payload_schema_uri`,
          "Supported writes without a catalog payload option must declare payload_schema_uri: null.",
        ));
      }
    } else if (
      !schemaUri ||
      schemaUri !== catalogSchema ||
      !registry?.has?.(schemaUri)
    ) {
      issues.push(blocker(
        "B_ASSEMBLY_SCHEMA_URI",
        `${issuePath}.payload_schema_uri`,
        "Payload schema URI must exactly resolve to a registered catalog schema.",
      ));
    } else if (payloads.has(operation.payload_file)) {
      const validation = registry.validate(
        schemaUri,
        payloads.get(operation.payload_file),
      );
      if (!validation.valid) {
        issues.push(blocker(
          "B_ASSEMBLY_PAYLOAD_SCHEMA",
          operation.payload_file,
          "Assembly payload does not satisfy its registered schema.",
          { errors: validation.errors },
        ));
      }
    }
  }
  const orderedOperations = dagSafe
    ? stableTopologicalOrder(plan.operations, issues)
    : [];
  const supportedWrites = orderedOperations.filter((operation) =>
    operation.support === "supported" &&
    operation.operation_kind === "write");
  validateExecutionState(plan, supportedWrites.length, issues);
  return {
    issues,
    orderedOperations,
    supportedWrites,
  };
}

export { officialSchemaUri };
