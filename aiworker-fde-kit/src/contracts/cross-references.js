import path from "node:path";

import { fromMarkdown } from "mdast-util-from-markdown";

import { canonicalBytes } from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";

function add(issues, code, issuePath, message, details = {}) {
  issues.push(issue("BLOCKER", code, issuePath, message, details));
}

function ids(values) {
  return new Set((values ?? []).map(({ id }) => id).filter(Boolean));
}

function recurse(value, visitor, location = "$") {
  visitor(value, location);
  if (Array.isArray(value)) {
    value.forEach((item, index) => recurse(item, visitor, `${location}[${index}]`));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) =>
      recurse(item, visitor, `${location}.${key}`));
  }
}

function referencedIds(payload, singular, plural) {
  const found = [];
  recurse(payload, (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    if (typeof value[singular] === "string") found.push(value[singular]);
    if (Array.isArray(value[plural])) found.push(...value[plural]);
  });
  return found;
}

const OBSOLETE_ASSEMBLY_WRAPPER_FIELDS = [
  "schema_version",
  "contract_version",
  "contract_status",
  "operation_id",
  "skill_set",
  "skill_refs",
  "worker",
  "worker_ref",
  "skill_set_refs",
];

function validateSkillLinks(project, sets, issues) {
  for (const [workerIndex, worker] of (project.workers ?? []).entries()) {
    for (const skillId of worker.skills ?? []) {
      if (!sets.skills.has(skillId)) {
        add(
          issues,
          "B_WORKER_SKILL_UNKNOWN",
          `workers[${workerIndex}].skills`,
          `Worker references unknown Skill ${skillId}.`,
        );
      }
    }
  }
  for (const [skillIndex, skill] of (project.skills ?? []).entries()) {
    for (const reference of [...(skill.reads ?? []), ...(skill.writes ?? [])]) {
      if (reference.startsWith("table.") && !sets.tables.has(reference)) {
        add(
          issues,
          "B_TABLE_UNKNOWN",
          `skills[${skillIndex}]`,
          `Skill references unknown table ${reference}.`,
        );
      }
    }
  }
}

function validateToolkits(project, toolkitKeys, issues) {
  const locations = [
    ["capabilities", project.capabilities ?? []],
    ...(project.workers ?? []).map((worker, index) => [
      `workers[${index}].toolkit_keys`,
      worker.toolkit_keys ?? [],
    ]),
    ...(project.skills ?? []).map((skill, index) => [
      `skills[${index}].toolkit_keys`,
      skill.toolkit_keys ?? [],
    ]),
  ];
  for (const [location, keys] of locations) {
    for (const key of keys) {
      if (!toolkitKeys.has(key)) {
        add(
          issues,
          "B_TOOLKIT_UNKNOWN",
          location,
          `Toolkit key is not registered: ${key}.`,
        );
      }
    }
  }
}

function validateFieldsAndPolicies(project, sets, issues) {
  const policies = [
    ...(project.data_foundation?.access_policies ?? []),
    ...(project.access_policies ?? []),
  ];
  const rolesById = new Map((project.roles ?? []).map((role) => [role.id, role]));
  for (const [index, policy] of policies.entries()) {
    if (!sets.tables.has(policy.resource?.table_id)) {
      add(
        issues,
        "B_TABLE_UNKNOWN",
        `access_policies[${index}].resource.table_id`,
        `Access policy references unknown table ${policy.resource?.table_id}.`,
      );
    }
    const fieldIds = [
      ...(policy.resource?.field_ids ?? []),
      ...(policy.filters ?? []).map(({ field_id: fieldId }) => fieldId),
    ];
    for (const fieldId of fieldIds) {
      if (!sets.fields.has(fieldId)) {
        add(
          issues,
          "B_FIELD_UNKNOWN",
          `access_policies[${index}]`,
          `Access policy references unknown field ${fieldId}.`,
        );
      }
    }
    const role = rolesById.get(policy.role_ref);
    const ordinaryRole =
      !/admin|administrator|管理员/iu.test(
        `${policy.role_ref ?? ""} ${role?.name ?? ""}`,
      );
    if (policy.scope === "all" && ordinaryRole) {
      add(
        issues,
        "B_ACCESS_SCOPE",
        `access_policies[${index}].scope`,
        "An ordinary business role must not receive unfiltered full-table access.",
      );
    }
  }

  for (const [tableIndex, table] of
    (project.data_foundation?.tables ?? []).entries()) {
    for (const [fieldIndex, field] of (table.fields ?? []).entries()) {
      if (field.link && !sets.tables.has(field.link.target_table)) {
        add(
          issues,
          "B_TABLE_UNKNOWN",
          `data_foundation.tables[${tableIndex}].fields[${fieldIndex}].link`,
          `Field links to unknown table ${field.link.target_table}.`,
        );
      }
    }
  }
}

function validateGuardsAndDrift(project, issues) {
  const skillsById = new Map((project.skills ?? []).map((skill) => [skill.id, skill]));
  for (const [index, worker] of (project.workers ?? []).entries()) {
    const ownedSkills = (worker.skills ?? []).map((id) => skillsById.get(id)).filter(Boolean);
    const writes = ownedSkills.some((skill) => (skill.writes ?? []).length > 0);
    if (writes && (worker.prompt_spec?.identity_guards ?? []).length === 0) {
      add(
        issues,
        "B_IDENTITY_GUARD",
        `workers[${index}].prompt_spec.identity_guards`,
        "A worker that performs writes requires an identity guard.",
      );
    }
    if (
      worker.station_reachable &&
      (
        !(worker.toolkit_keys ?? []).includes("feat.identity_verification") ||
        (worker.prompt_spec?.identity_guards ?? []).length === 0 ||
        (worker.prompt_spec?.boundaries ?? []).length === 0
      )
    ) {
      add(
        issues,
        "B_STATION_GUARD",
        `workers[${index}].station_reachable`,
        "A Station-reachable worker requires external identity verification and access boundaries.",
      );
    }
    for (const skill of ownedSkills) {
      const workerKeys = new Set(worker.toolkit_keys ?? []);
      if ((skill.toolkit_keys ?? []).some((key) => !workerKeys.has(key))) {
        add(
          issues,
          "B_WORKER_PAYLOAD_DRIFT",
          `workers[${index}].toolkit_keys`,
          `Worker toolkit keys drift from owned Skill ${skill.id}.`,
        );
      }
      if (skill.owner_worker !== worker.id) {
        add(
          issues,
          "B_WORKER_PAYLOAD_DRIFT",
          `skills.${skill.id}.owner_worker`,
          "Worker and Skill ownership declarations disagree.",
        );
      }
    }
  }
}

function validatePayloads(project, sets, files, issues) {
  const workers = new Map((project.workers ?? []).map((worker) => [worker.id, worker]));
  for (const [index, operation] of (project.assembly?.operations ?? []).entries()) {
    if (!operation.payload_file || !files.has(operation.payload_file)) continue;
    const payload = files.get(operation.payload_file);
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const obsoleteFields = OBSOLETE_ASSEMBLY_WRAPPER_FIELDS.filter((field) =>
        Object.hasOwn(payload, field));
      if (obsoleteFields.length > 0) {
        add(
          issues,
          "B_WORKER_PAYLOAD_DRIFT",
          operation.payload_file,
          "Assembly Payload uses obsolete FDE wrapper fields; live octopus-cli writes require API-native payloads.",
          { fields: obsoleteFields },
        );
      }
    }
    for (const fieldId of referencedIds(payload, "field_id", "field_ids")) {
      if (!sets.fields.has(fieldId)) {
        add(
          issues,
          "B_FIELD_UNKNOWN",
          operation.payload_file,
          `Payload references unknown field ${fieldId}.`,
        );
      }
    }
    const employeeIds = referencedIds(payload, "employee_id", "employee_ids");
    const skillIds = referencedIds(payload, "skill_id", "skill_ids");
    const toolkitKeys = referencedIds(payload, "toolkit_key", "toolkit_keys");
    for (const employeeId of employeeIds) {
      const worker = workers.get(employeeId);
      if (
        !worker ||
        skillIds.some((skillId) => !(worker.skills ?? []).includes(skillId)) ||
        toolkitKeys.some((key) => !(worker.toolkit_keys ?? []).includes(key))
      ) {
        add(
          issues,
          "B_WORKER_PAYLOAD_DRIFT",
          `assembly.operations[${index}].payload_file`,
          "Assembly Payload drifts from the worker, Skill, or toolkit declaration.",
        );
        break;
      }
    }
  }
}

function markdownUrls(content) {
  const urls = new Set();
  const stack = [fromMarkdown(content)];
  while (stack.length > 0) {
    const node = stack.pop();
    if (
      ["link", "image", "definition"].includes(node.type) &&
      typeof node.url === "string"
    ) {
      urls.add(node.url);
    }
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return urls;
}

function defaultSkillPath(skillId) {
  if (typeof skillId !== "string" || !skillId.startsWith("skill.")) return null;
  const slug = skillId
    .slice("skill.".length)
    .replaceAll("_", "-");
  return `skills/${slug}/SKILL.md`;
}

function unsafeAncestor(relativePath, unsafePaths) {
  return [...unsafePaths].some(
    (unsafe) =>
      relativePath === unsafe || relativePath.startsWith(`${unsafe}/`),
  );
}

function workerSkillPaths(worker) {
  const defaults = (worker.skills ?? [])
    .map(defaultSkillPath)
    .filter(Boolean);
  if (!worker.skill_package_path) return defaults;
  return [
    worker.skill_package_path,
    ...defaults.slice(defaults.length > 0 ? 1 : 0),
  ];
}

function projectSkillPath(skill, owner) {
  if (
    owner?.skill_package_path &&
    owner.skills?.[0] === skill.id
  ) {
    return owner.skill_package_path;
  }
  return defaultSkillPath(skill.id);
}

function validateProjectSkills(project, files, unsafePaths, issues) {
  const workers = new Map(
    (project.workers ?? []).map((worker) => [worker.id, worker]),
  );
  const packageOwners = new Map();
  for (const [index, skill] of (project.skills ?? []).entries()) {
    const owner = workers.get(skill.owner_worker);
    if (!owner) {
      add(
        issues,
        "B_SKILL_OWNER_UNKNOWN",
        `skills[${index}].owner_worker`,
        `Skill ${skill.id} references unknown owner ${skill.owner_worker}.`,
      );
    } else if (!(owner.skills ?? []).includes(skill.id)) {
      add(
        issues,
        "B_SKILL_OWNER_MISMATCH",
        `skills[${index}].owner_worker`,
        `Skill ${skill.id} is not listed by its declared owner ${owner.id}.`,
      );
    }
    const conflictingWorkers = (project.workers ?? [])
      .filter((worker) =>
        worker.id !== skill.owner_worker &&
        (worker.skills ?? []).includes(skill.id))
      .map(({ id }) => id);
    if (conflictingWorkers.length > 0) {
      add(
        issues,
        "B_SKILL_OWNER_CONFLICT",
        `skills[${index}].owner_worker`,
        `Skill ${skill.id} is also listed by ${conflictingWorkers.join(", ")}.`,
      );
    }

    const packagePath = projectSkillPath(skill, owner);
    if (!packagePath) continue;
    const folded = packagePath.toLocaleLowerCase("en-US");
    const prior = packageOwners.get(folded);
    if (prior) {
      add(
        issues,
        "B_SKILL_PACKAGE_DUPLICATE",
        `skills[${index}]`,
        `Skill package ${packagePath} is already assigned to ${prior}.`,
      );
    } else {
      packageOwners.set(folded, skill.id);
    }
    if (unsafeAncestor(packagePath, unsafePaths)) {
      add(
        issues,
        "B_SKILL_PACKAGE_UNSAFE",
        `skills[${index}]`,
        `Skill package is a symlink or traverses an unsafe entry: ${packagePath}.`,
      );
    } else if (!files.has(packagePath)) {
      add(
        issues,
        "B_SKILL_PACKAGE_MISSING",
        `skills[${index}]`,
        `Skill ${skill.id} has no regular package file at ${packagePath}.`,
      );
    }
  }
}

function validateDeclaredFiles(project, files, unsafePaths, issues) {
  const declarations = new Map();
  const register = (relativePath, declarationPath) => {
    if (typeof relativePath !== "string") return;
    const folded = relativePath.toLocaleLowerCase("en-US");
    const prior = declarations.get(folded);
    if (prior) {
      add(
        issues,
        "B_DECLARED_FILE_DUPLICATE",
        declarationPath,
        `Declared file ${relativePath} is reused by ${prior}.`,
      );
    } else {
      declarations.set(folded, declarationPath);
    }
    if (unsafeAncestor(relativePath, unsafePaths)) {
      add(
        issues,
        "B_DECLARED_FILE_UNSAFE",
        declarationPath,
        `Declared file ${relativePath} is a symlink or traverses a non-regular entry.`,
      );
    } else if (!files.has(relativePath)) {
      add(
        issues,
        "B_DECLARED_FILE_MISSING",
        declarationPath,
        `Declared file does not exist as one regular file: ${relativePath}.`,
      );
    }
  };

  for (const [index, operation] of
    (project.assembly?.operations ?? []).entries()) {
    if (operation.payload_file) {
      register(
        operation.payload_file,
        `assembly.operations[${index}].payload_file`,
      );
    }
  }
  for (const [index, worker] of (project.workers ?? []).entries()) {
    for (const skillPath of workerSkillPaths(worker)) {
      register(skillPath, `workers[${index}].skill_package_path`);
    }
  }

  const employeeDocuments = new Map();
  for (const [relativePath, document] of files) {
    if (!/^employees\/.+\.md$/u.test(relativePath)) continue;
    if (unsafeAncestor(relativePath, unsafePaths)) {
      add(
        issues,
        "B_DECLARED_FILE_UNSAFE",
        relativePath,
        "Employee document is a symlink or traverses a non-regular entry.",
      );
    }
    if (
      document &&
      typeof document === "object" &&
      !Array.isArray(document) &&
      typeof document.id === "string"
    ) {
      const paths = employeeDocuments.get(document.id) ?? [];
      paths.push(relativePath);
      employeeDocuments.set(document.id, paths);
    }
  }
  for (const [index, worker] of (project.workers ?? []).entries()) {
    const documents = employeeDocuments.get(worker.id) ?? [];
    if (documents.length === 0) {
      add(
        issues,
        "B_DECLARED_FILE_MISSING",
        `workers[${index}]`,
        `Worker ${worker.id} has no unique regular employee document.`,
      );
    } else if (documents.length > 1) {
      add(
        issues,
        "B_DECLARED_FILE_DUPLICATE",
        `workers[${index}]`,
        `Worker ${worker.id} has multiple employee documents: ${documents.join(", ")}.`,
      );
    }
  }
}

function validateRuntimePaths(project, files, unsafePaths, issues) {
  for (const [index, worker] of (project.workers ?? []).entries()) {
    const skillPaths = new Set(workerSkillPaths(worker));
    for (const skillPath of skillPaths) {
      if (unsafeAncestor(skillPath, unsafePaths)) {
        add(
          issues,
          "B_SKILL_RUNTIME_ESCAPE",
          skillPath,
          "Skill package path traverses an unsafe project ancestor.",
          { worker: worker.id, worker_index: index },
        );
      }
      const content = files.get(skillPath);
      if (typeof content !== "string") continue;
      const packageRoot = path.posix.dirname(skillPath);
      for (const url of markdownUrls(content)) {
        const rawLink = url.split("#", 1)[0];
        let link;
        try {
          link = decodeURIComponent(rawLink);
        } catch {
          link = rawLink;
        }
        if (!link || link.startsWith("#")) {
          continue;
        }
        const scheme = link.match(/^([a-z][a-z0-9+.-]*):/iu)?.[1]
          ?.toLowerCase();
        if (scheme && ["http", "https", "mailto"].includes(scheme)) continue;
        if (scheme) {
          add(
            issues,
            "B_SKILL_RUNTIME_ESCAPE",
            skillPath,
            `Skill runtime reference uses a non-whitelisted URI scheme: ${rawLink}.`,
            { worker: worker.id, worker_index: index },
          );
          continue;
        }
        if (
          path.posix.isAbsolute(link) ||
          path.win32.isAbsolute(link) ||
          link.includes("\\")
        ) {
          add(
            issues,
            "B_SKILL_RUNTIME_ESCAPE",
            skillPath,
            `Skill runtime reference escapes its package: ${rawLink}.`,
            { worker: worker.id, worker_index: index },
          );
          continue;
        }
        const resolved = path.posix.normalize(path.posix.join(packageRoot, link));
        if (
          resolved === ".." ||
          resolved.startsWith("../") ||
          !(
            resolved === packageRoot ||
            resolved.startsWith(`${packageRoot}/`)
          ) ||
          unsafeAncestor(resolved, unsafePaths)
        ) {
          add(
            issues,
            "B_SKILL_RUNTIME_ESCAPE",
            skillPath,
            `Skill runtime reference escapes its package or traverses an unsafe ancestor: ${rawLink}.`,
            { worker: worker.id, worker_index: index },
          );
        }
      }
    }
  }
}

function validateDocumentFields(project, files, issues) {
  const known = new Set(
    (project.data_foundation?.tables ?? []).flatMap(({ fields }) =>
      (fields ?? []).map(({ id }) => id)),
  );
  for (const [relativePath, content] of files) {
    if (!/^skills\/.+\/SKILL\.md$/u.test(relativePath)) continue;
    const text =
      typeof content === "string" ? content : JSON.stringify(content);
    const references = new Set(
      text.match(/\bfield\.[a-z0-9]+(?:_[a-z0-9]+)*\b/gu) ?? [],
    );
    for (const fieldId of references) {
      if (!known.has(fieldId)) {
        add(
          issues,
          "B_FIELD_UNKNOWN",
          relativePath,
          `Skill package references unknown field ${fieldId}.`,
        );
      }
    }
  }
}

function normalizedList(value) {
  return [...(value ?? [])].sort();
}

function validateEmployeeDocuments(project, files, issues) {
  const workers = new Map(
    (project.workers ?? []).map((worker) => [worker.id, worker]),
  );
  for (const [relativePath, document] of files) {
    if (
      !/^employees\/.+\.md$/u.test(relativePath) ||
      !document ||
      typeof document !== "object" ||
      Array.isArray(document)
    ) {
      continue;
    }
    const worker = workers.get(document.id);
    const documentSkills = document.skills ?? document.skill_refs;
    const documentToolkits =
      document.toolkit_keys ??
      document.toolkitKeys ??
      document.toolkit_refs;
    const documentPrompt = document.prompt_spec ?? document.promptSpec;
    const drift =
      !worker ||
      JSON.stringify(normalizedList(documentSkills)) !==
        JSON.stringify(normalizedList(worker.skills)) ||
      JSON.stringify(normalizedList(documentToolkits)) !==
        JSON.stringify(normalizedList(worker.toolkit_keys)) ||
      (
        documentPrompt !== undefined &&
        !canonicalBytes(documentPrompt).equals(
          canonicalBytes(worker.prompt_spec),
        )
      );
    if (drift) {
      add(
        issues,
        "B_WORKER_PAYLOAD_DRIFT",
        relativePath,
        "Employee document drifts from the worker, Skill, toolkit, or promptSpec declaration.",
      );
    }
  }
}

function acceptanceMentions(acceptanceCase, identifier) {
  if (typeof identifier !== "string" || identifier.length === 0) return false;
  const escaped = identifier
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const boundary = "[^a-z0-9._-]";
  return new RegExp(
    `(?:^|${boundary})${escaped}(?=$|${boundary})`,
    "u",
  ).test(JSON.stringify(acceptanceCase).toLowerCase());
}

function validateHumanAndAcceptance(project, issues) {
  const hasBusinessDesign =
    (project.scenarios ?? []).length > 0 ||
    (project.workers ?? []).length > 0 ||
    (project.skills ?? []).length > 0;
  if (!hasBusinessDesign) return;
  const highRisk =
    (project.skills ?? []).some(({ writes }) => (writes ?? []).length > 0) ||
    (project.assembly?.operations ?? []).some(({ risk }) =>
      ["high", "critical"].includes(risk));
  const scenarioGates = (project.scenarios ?? []).flatMap(
    ({ human_gates: gates }) => gates ?? [],
  );
  const workerGates = (project.workers ?? []).flatMap(
    ({ prompt_spec: spec }) => spec?.human_gates ?? [],
  );
  if (highRisk && scenarioGates.length === 0 && workerGates.length === 0) {
    add(
      issues,
      "B_HUMAN_GATE_MISSING",
      "scenarios",
      "High-risk or write actions require an explicit human gate.",
    );
  }
  const cases = (project.acceptance_cases ?? []).map((acceptanceCase) => ({
    category: acceptanceCase.category,
    value: acceptanceCase,
  }));
  const targets = [
    ...(project.scenarios ?? []).map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      humanGate: (scenario.human_gates ?? []).length > 0,
    })),
    ...(project.skills ?? []).map((skill) => ({
      id: skill.id,
      name: skill.name,
      humanGate: (skill.writes ?? []).length > 0,
    })),
    ...(project.assembly?.operations ?? [])
      .filter(
        ({ support, operation_kind: kind }) =>
          support === "supported" && kind === "write",
      )
      .map((operation) => ({
        id: operation.operation_id,
        name: operation.description,
        humanGate:
          operation.operation_kind === "write" ||
          ["high", "critical"].includes(operation.risk),
      })),
  ];
  const missing = [];
  for (const target of targets) {
    const identifiers = [target.id, target.name]
      .filter((value) => typeof value === "string" && value.length > 0);
    const associated = cases.filter(({ value }) =>
      identifiers.some((identifier) =>
        acceptanceMentions(value, identifier)));
    const requiredCategories = ["normal", "refusal", "permission"];
    if (target.humanGate) requiredCategories.push("human-gate");
    const missingCategories = requiredCategories.filter(
      (category) =>
        !associated.some((acceptanceCase) =>
          acceptanceCase.category === category),
    );
    if (missingCategories.length > 0) {
      missing.push({
        target: target.id,
        categories: missingCategories,
      });
    }
  }
  if (missing.length > 0) {
    add(
      issues,
      "B_ACCEPTANCE_COVERAGE",
      "acceptance_cases",
      "Acceptance cases do not associate every major scenario, Skill, and write operation with success, refusal, access, and required human-gate coverage.",
      { missing },
    );
  }
}

export function validateCrossReferences(project, options = {}) {
  const issues = [];
  const tables = project.data_foundation?.tables ?? [];
  const sets = {
    skills: ids(project.skills),
    tables: ids(tables),
    fields: new Set(
      tables.flatMap(({ fields }) => (fields ?? []).map(({ id }) => id)),
    ),
  };
  const unsafePaths = new Set(options.unsafePaths ?? []);
  validateProjectSkills(
    project,
    options.files ?? new Map(),
    unsafePaths,
    issues,
  );
  validateDeclaredFiles(
    project,
    options.files ?? new Map(),
    unsafePaths,
    issues,
  );
  validateSkillLinks(project, sets, issues);
  validateToolkits(project, options.toolkitKeys ?? new Set(), issues);
  validateFieldsAndPolicies(project, sets, issues);
  validateGuardsAndDrift(project, issues);
  validatePayloads(project, sets, options.files ?? new Map(), issues);
  validateRuntimePaths(
    project,
    options.files ?? new Map(),
    unsafePaths,
    issues,
  );
  validateDocumentFields(project, options.files ?? new Map(), issues);
  validateEmployeeDocuments(project, options.files ?? new Map(), issues);
  validateHumanAndAcceptance(project, issues);
  return commandResult(issues).issues;
}
