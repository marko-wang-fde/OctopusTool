import path from "node:path";

import { stringify } from "yaml";

import { parseSafeYaml } from "../contracts/safe-data.js";
import { canonicalBytes, sha256Bytes } from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";

export const STAGE_IDS = Object.freeze([
  "initialize",
  "discover",
  "team-design",
  "foundation-design",
  "author",
  "assemble",
  "validate",
]);

const EXPECTED_DEPENDENCIES = Object.freeze({
  initialize: [],
  discover: ["initialize"],
  "team-design": ["discover"],
  "foundation-design": ["team-design"],
  author: ["foundation-design"],
  assemble: ["author"],
  validate: ["assemble"],
});

const EXPECTED_APPROVAL_FIELDS = Object.freeze({
  initialize: "stage_status.initialize.approved_at",
  discover: "stage_status.discover.approved_at",
  "team-design": "stage_status.team-design.approved_at",
  "foundation-design": null,
  author: null,
  assemble: null,
  validate: null,
});
const ARTIFACT_CONDITIONS = new Set([
  "arcubase-required",
  "arcubase-access-required",
  "station-required",
  "taskboard-required",
  "browser-webskill-required",
  "assembly-script-required",
  "assembly-evidence-required",
]);
const OFFICIAL_CATALOG_SHA256 =
  "ca18c85655291f599d4699b6862cf5e9475a9b000c7d03df075656cfe801c620";

function isSafePattern(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value) ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part === "." || part === "..")
  ) {
    return false;
  }
  return value.split("/").every((part) =>
    part === "**" ||
    part === "*" ||
    (part !== "" &&
      !part.includes("**") &&
      /^[A-Za-z0-9._*-]+$/u.test(part)));
}

function artifactPath(entry) {
  return typeof entry === "string" ? entry : entry?.path;
}

function validArtifactEntry(entry) {
  if (typeof entry === "string") return isSafePattern(entry);
  return (
    entry &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    JSON.stringify(Object.keys(entry).sort()) ===
      JSON.stringify(["condition", "path"]) &&
    isSafePattern(entry.path) &&
    ARTIFACT_CONDITIONS.has(entry.condition)
  );
}

function uniqueArtifacts(entries) {
  const paths = entries.map(artifactPath);
  return new Set(paths).size === paths.length;
}

export function validateStageCatalog(value) {
  if (
    value?.schema_version !== 1 ||
    !Array.isArray(value.stages) ||
    value.stages.length !== STAGE_IDS.length
  ) {
    throw new Error("Stage catalog must contain the seven version 1 stages.");
  }
  for (const [index, stage] of value.stages.entries()) {
    const id = STAGE_IDS[index];
    if (
      stage?.id !== id ||
      JSON.stringify(stage.depends_on) !==
        JSON.stringify(EXPECTED_DEPENDENCIES[id]) ||
      stage.approval_field !== EXPECTED_APPROVAL_FIELDS[id] ||
      !Array.isArray(stage.required_inputs) ||
      !Array.isArray(stage.required_outputs) ||
      !uniqueArtifacts(stage.required_inputs) ||
      !uniqueArtifacts(stage.required_outputs) ||
      [...stage.required_inputs, ...stage.required_outputs].some(
        (item) => !validArtifactEntry(item),
      )
    ) {
      throw new Error(`Stage catalog entry is invalid: ${id}.`);
    }
    const keys = Object.keys(stage).sort();
    if (
      JSON.stringify(keys) !==
      JSON.stringify([
        "approval_field",
        "depends_on",
        "id",
        "required_inputs",
        "required_outputs",
      ])
    ) {
      throw new Error(`Stage catalog entry has unknown fields: ${id}.`);
    }
  }
  return value;
}

export function parseStageCatalog(text, sourceName = "stage-artifacts.yaml") {
  const catalog = validateStageCatalog(parseSafeYaml(text, sourceName));
  if (sha256Bytes(canonicalBytes(catalog)) !== OFFICIAL_CATALOG_SHA256) {
    throw new Error(
      "Official stage catalog authoritative artifact set was narrowed or changed without a contract update.",
    );
  }
  return catalog;
}

export function matchesAuthoritativePattern(pattern, relativePath) {
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    if (pattern.slice(index, index + 3) === "**/") {
      expression += "(?:[^/]+/)*";
      index += 2;
    } else if (pattern.slice(index, index + 2) === "**") {
      expression += ".*";
      index += 1;
    } else if (pattern[index] === "*") {
      expression += "[^/]*";
    } else {
      expression += pattern[index].replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    }
  }
  return new RegExp(`^${expression}$`, "u").test(relativePath);
}

function hasArtifact(pattern, present) {
  if (!pattern.includes("*")) return present.has(pattern);
  return [...present].some((file) =>
    matchesAuthoritativePattern(pattern, file));
}

function baselineChanged(record, hashes, authoritativePaths) {
  const recorded = {
    ...(record?.input_hashes ?? {}),
    ...(record?.output_hashes ?? {}),
  };
  const hasBaseline = Object.keys(recorded).length > 0;
  if (!hasBaseline) return false;
  const expected = new Set([
    ...authoritativePaths.inputs,
    ...authoritativePaths.outputs,
  ]);
  if (
    [...expected].some((file) => !Object.hasOwn(recorded, file)) ||
    Object.keys(recorded).some((file) => !expected.has(file))
  ) {
    return true;
  }
  for (const [file, oldHash] of Object.entries(recorded)) {
    if (hashes[file] !== oldHash) return true;
  }
  return false;
}

function approvalExists(manifest, stage) {
  return (
    stage.approval_field === null ||
    manifest?.stage_status?.[stage.id]?.approved_at != null
  );
}

function conditionApplies(condition, manifest) {
  const capabilities = new Set(manifest?.capabilities ?? []);
  const supported = (manifest?.assembly?.operations ?? []).some(
    ({ support, operation_kind: kind }) =>
      support === "supported" && kind === "write",
  );
  switch (condition) {
    case "arcubase-required":
      return ["new", "extend"].includes(manifest?.data_foundation?.mode);
    case "arcubase-access-required":
      return manifest?.data_foundation?.mode !== "none";
    case "station-required":
      return (manifest?.workers ?? []).some(
        ({ station_reachable: reachable }) => reachable === true,
      );
    case "taskboard-required":
      return capabilities.has("feat.taskboard");
    case "browser-webskill-required":
      return [...capabilities].some((key) =>
        ["feat.browser", "feat.browser_use", "feat.webskill", "feat.web_skill"]
          .includes(key));
    case "assembly-script-required":
      return (
        supported &&
        ["ready", "executed"].includes(
          manifest?.assembly?.assembly_execution?.status,
        )
      );
    case "assembly-evidence-required":
      return (
        supported &&
        manifest?.assembly?.assembly_execution?.status === "executed"
      );
    default:
      return false;
  }
}

function activeArtifacts(entries, manifest) {
  return entries
    .filter((entry) =>
      typeof entry === "string" ||
      conditionApplies(entry.condition, manifest))
    .map(artifactPath);
}

export function authoritativePatterns(catalog, stageId, manifest) {
  const validated = validateStageCatalog(catalog);
  const stage = validated.stages.find(({ id }) => id === stageId);
  if (!stage) throw new Error(`Unknown stage: ${stageId}.`);
  return {
    inputs: activeArtifacts(stage.required_inputs, manifest),
    outputs: activeArtifacts(stage.required_outputs, manifest),
  };
}

export function resolveAuthoritativePaths(
  catalog,
  stageId,
  present,
  manifest,
) {
  const patterns = authoritativePatterns(catalog, stageId, manifest);
  const resolve = (items) => items.flatMap((pattern) =>
    pattern.includes("*")
      ? [...present]
          .filter((file) => matchesAuthoritativePattern(pattern, file))
          .sort()
      : [pattern]);
  return {
    inputs: [...new Set(resolve(patterns.inputs))],
    outputs: [...new Set(resolve(patterns.outputs))],
  };
}

export function deriveStageStates(manifest, catalog, context) {
  const validated = validateStageCatalog(catalog);
  const states = {};
  let upstreamChanged = false;
  for (const stage of validated.stages) {
    const record = manifest?.stage_status?.[stage.id] ?? {};
    if (upstreamChanged) {
      states[stage.id] = "stale";
      continue;
    }
    const paths = resolveAuthoritativePaths(
      validated,
      stage.id,
      context.present ?? new Set(),
      manifest,
    );
    const changed = baselineChanged(record, context.hashes ?? {}, paths);
    if (changed) {
      states[stage.id] = "needs-review";
      upstreamChanged = true;
      continue;
    }
    if (stage.depends_on.some((dependency) => states[dependency] !== "complete")) {
      states[stage.id] = "stale";
      continue;
    }
    if (context.workingStages?.has(stage.id)) {
      states[stage.id] = "in-progress";
      continue;
    }
    const patterns = authoritativePatterns(validated, stage.id, manifest);
    const allArtifacts = [
      ...patterns.inputs,
      ...patterns.outputs,
    ].every((pattern) => hasArtifact(pattern, context.present ?? new Set()));
    const stageValid = context.validStages?.has(stage.id) === true;
    if (allArtifacts && stageValid && approvalExists(manifest, stage)) {
      states[stage.id] = "complete";
    } else {
      states[stage.id] = "not-started";
    }
  }
  return states;
}

export function deriveProjectStatus(manifest, states, blockers) {
  const firstThree = STAGE_IDS.slice(0, 3);
  if (
    firstThree.some((stage) => states[stage] !== "complete") ||
    blockers.some(({ details }) => firstThree.includes(details?.stage))
  ) {
    return "draft";
  }
  if (
    STAGE_IDS.some((stage) => states[stage] !== "complete") ||
    blockers.length > 0
  ) {
    return "reviewable";
  }
  const supported = (manifest?.assembly?.operations ?? []).some(
    ({ support, operation_kind: kind }) =>
      support === "supported" && kind === "write",
  );
  if (
    supported &&
    manifest?.assembly?.assembly_execution?.status === "executed"
  ) {
    return "cli-assembled";
  }
  return "delivery-ready";
}

function resultWithExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function sameHashes(left, right) {
  const leftEntries = Object.entries(left ?? {}).sort();
  const rightEntries = Object.entries(right ?? {}).sort();
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function missingPatterns(patterns, present) {
  return patterns.filter((pattern) =>
    pattern.includes("*")
      ? ![...present].some((file) =>
          matchesAuthoritativePattern(pattern, file))
      : !present.has(pattern));
}

function issueStage(issueValue) {
  if (issueValue.details?.stage) return issueValue.details.stage;
  const value = issueValue.path;
  if (/^(?:inputs|sources|requirements|scenarios|discovery)/u.test(value)) {
    return "discover";
  }
  if (
    /^(?:roles|business_objects|design\/team|design\/collaboration)/u
      .test(value)
  ) {
    return "team-design";
  }
  if (
    /^(?:capabilities|data_foundation|access_policies|arcubase|design\/platform|design\/data|design\/identity)/u
      .test(value)
  ) {
    return "foundation-design";
  }
  if (/^(?:workers|skills|employees)/u.test(value)) return "author";
  if (/^(?:assembly|acceptance)/u.test(value)) return "assemble";
  if (/^(?:reports|package-manifest)/u.test(value)) return "validate";
  return "initialize";
}

export function prepareStageAcceptance(validation, stageId) {
  const context = validation.context;
  if (!context?.manifest) {
    return {
      result: resultWithExit(1, validation.issues, {
        failed_stage: stageId,
        recovery: "Repair fde-project.yaml and rerun validation.",
      }),
    };
  }
  const stageIndex = STAGE_IDS.indexOf(stageId);
  const statusDriftIssues = validation.issues.filter(
    (item) =>
      item.severity === "BLOCKER" &&
      item.code === "B_PROJECT_STATUS_DRIFT",
  );
  const relevantIssues = validation.issues.filter(
    (item) =>
      item.severity === "BLOCKER" &&
      item.code !== "B_PROJECT_STATUS_DRIFT" &&
      STAGE_IDS.indexOf(issueStage(item)) <= stageIndex,
  );
  const stage = context.stageCatalog.stages[stageIndex];
  const record = context.manifest.stage_status[stageId];
  const stagePatterns = authoritativePatterns(
    context.stageCatalog,
    stageId,
    context.manifest,
  );
  const missing = missingPatterns(
    [...stagePatterns.inputs, ...stagePatterns.outputs],
    context.present,
  );
  const issues = [...relevantIssues];
  for (const pattern of missing) {
    issues.push(
      issue(
        "BLOCKER",
        "B_STAGE_ARTIFACT_MISSING",
        pattern,
        `Stage ${stageId} is missing an authoritative artifact.`,
        { stage: stageId },
      ),
    );
  }
  if (stage.approval_field !== null && record.approved_at === null) {
    issues.push(
      issue(
        "BLOCKER",
        "B_STAGE_APPROVAL_MISSING",
        stage.approval_field,
        `Stage ${stageId} requires an existing human approval.`,
        { stage: stageId },
      ),
    );
  }
  for (const dependency of stage.depends_on) {
    if (
      context.manifest.stage_status[dependency].status !== "complete" ||
      validation.data?.stage_states?.[dependency] !== "complete"
    ) {
      issues.push(
        issue(
          "BLOCKER",
          "B_STAGE_DEPENDENCY",
          `stage_status.${stageId}.depends_on`,
          `Dependency ${dependency} is not complete.`,
          { stage: stageId, dependency },
        ),
      );
    }
  }
  if (stageId === "validate") {
    for (const evidence of ["reports/package-validation.json"]) {
      if (!context.present.has(evidence)) {
        issues.push(
          issue(
            "BLOCKER",
            "B_PACKAGE_VALIDATION_MISSING",
            evidence,
            "Validate cannot complete before package validation evidence exists.",
            { stage: stageId },
          ),
        );
      }
    }
  }
  if (issues.length > 0) issues.push(...statusDriftIssues);
  if (issues.length > 0) {
    return {
      result: resultWithExit(1, issues, {
        failed_stage: stageId,
        recovery:
          "Resolve the reported stage artifacts, validation findings, dependencies, and approval; then rerun the same command.",
      }),
    };
  }

  const paths = resolveAuthoritativePaths(
    context.stageCatalog,
    stageId,
    context.present,
    context.manifest,
  );
  const inputHashes = Object.fromEntries(
    paths.inputs.map((file) => [file, context.hashes[file]]),
  );
  const outputHashes = Object.fromEntries(
    paths.outputs.map((file) => [file, context.hashes[file]]),
  );
  const unchanged =
    record.status === "complete" &&
    sameHashes(record.input_hashes, inputHashes) &&
    sameHashes(record.output_hashes, outputHashes);
  const statusNeedsRepair = statusDriftIssues.length > 0;
  if (unchanged && !statusNeedsRepair) {
    return {
      result: resultWithExit(0, [], {
        accepted_stage: stageId,
        changed: false,
        baseline_revision: record.baseline_revision,
      }),
      manifestBytes: null,
      validationSnapshot: context.validationSnapshot,
    };
  }

  const updated = structuredClone(context.manifest);
  const updatedRecord = updated.stage_status[stageId];
  if (unchanged) {
    updated.project.status = validation.data.project_status;
  } else {
    updatedRecord.input_hashes = inputHashes;
    updatedRecord.output_hashes = outputHashes;
    updatedRecord.baseline_revision += 1;
    updatedRecord.status = "complete";
    for (const downstream of STAGE_IDS.slice(stageIndex + 1)) {
      updated.stage_status[downstream].status = "stale";
    }
    const statuses = Object.fromEntries(
      STAGE_IDS.map((id) => [id, updated.stage_status[id].status]),
    );
    updated.project.status = deriveProjectStatus(updated, statuses, []);
  }
  return {
    result: resultWithExit(0, [], {
      accepted_stage: stageId,
      changed: true,
      baseline_revision: updatedRecord.baseline_revision,
    }),
    manifestBytes: Buffer.from(
      stringify(updated, { lineWidth: 0 }),
      "utf8",
    ),
    validationSnapshot: context.validationSnapshot,
  };
}
