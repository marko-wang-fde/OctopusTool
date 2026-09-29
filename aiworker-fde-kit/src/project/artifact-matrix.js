import { issue } from "../shared/result.js";

const FIXED_ARTIFACTS = Object.freeze([
  ".gitignore",
  "fde-project.yaml",
  "inputs/input-inventory.md",
  "discovery/facts-and-assumptions.md",
  "discovery/open-questions.md",
  "discovery/scenario-model.md",
  "design/team-design.md",
  "design/collaboration-and-dataflow.md",
  "design/platform-capability-selection.md",
  "design/data-foundation.md",
  "design/identity-and-access.md",
  "arcubase/decision.yaml",
  "assembly/assembly-plan.md",
  "assembly/operations.yaml",
  "acceptance/acceptance-plan.md",
  "acceptance/test-cases.yaml",
  "reports/validation-report.md",
  "delivery-summary.md",
]);

const BROWSER_KEYS = new Set([
  "feat.browser",
  "feat.browser_use",
  "feat.webskill",
  "feat.web_skill",
]);

function entry(path, required, reason, kind = "conditional") {
  return { path, required, reason, kind };
}

export function deriveArtifactMatrix(project) {
  const mode = project?.data_foundation?.mode;
  const capabilities = new Set(project?.capabilities ?? []);
  const stationRequired = (project?.workers ?? []).some(
    ({ station_reachable: reachable }) => reachable === true,
  );
  const taskboardRequired = capabilities.has("feat.taskboard");
  const browserRequired = [...capabilities].some((key) =>
    BROWSER_KEYS.has(key));
  const operations = project?.assembly?.operations ?? [];
  const supported = operations.some(
    ({ support, operation_kind: kind }) =>
      support === "supported" && kind === "write",
  );
  const execution = project?.assembly?.assembly_execution ?? {};
  const scriptRequired =
    supported && ["ready", "executed"].includes(execution.status);
  const evidenceRequired = supported && execution.status === "executed";
  let executionIssue = null;
  if (execution.status === "blocked") {
    executionIssue = {
      code: "B_ASSEMBLY_EXECUTION_BLOCKED",
      message: "The assembly execution path is explicitly blocked.",
    };
  } else if (
    (!supported && ["ready", "executed"].includes(execution.status)) ||
    (supported && execution.status === "not-applicable")
  ) {
    executionIssue = {
      code: "B_ASSEMBLY_EXECUTION_STATUS",
      message:
        "The assembly execution status is inconsistent with supported assembly operations.",
    };
  }

  const matrix = [
    ...FIXED_ARTIFACTS.map((path) =>
      entry(path, true, "fixed project artifact", "fixed")),
    entry(
      "arcubase/schema.yaml",
      mode === "new" || mode === "extend",
      `Arcubase mode is ${String(mode)}`,
    ),
    entry(
      "arcubase/access-matrix.md",
      mode !== "none",
      `Arcubase mode is ${String(mode)}`,
    ),
    entry(
      "design/external-station.md",
      stationRequired,
      "at least one worker is Station reachable",
    ),
    entry(
      "design/taskboard.md",
      taskboardRequired,
      "feat.taskboard is selected",
    ),
    entry(
      "design/browser-webskill.md",
      browserRequired,
      "a Browser/WebSkill capability is selected",
    ),
    entry(
      execution.script_file ?? "assembly/octopus-cli-assemble.sh",
      scriptRequired,
      `assembly execution status is ${String(execution.status)}`,
    ),
    entry(
      execution.evidence_file ?? "reports/cli-assemble-evidence.json",
      evidenceRequired,
      `assembly execution status is ${String(execution.status)}`,
    ),
  ];
  if (executionIssue) {
    matrix.push({
      path: "assembly.assembly_execution.status",
      required: false,
      reason: executionIssue.message,
      kind: "contract",
      contractIssue: executionIssue,
    });
  }
  return matrix;
}

export async function validateArtifactPresence(
  projectRoot,
  matrix,
  dependencies,
) {
  const issues = [];
  for (const artifact of matrix) {
    if (artifact.contractIssue) {
      issues.push(
        issue(
          "BLOCKER",
          artifact.contractIssue.code,
          artifact.path,
          artifact.contractIssue.message,
        ),
      );
      continue;
    }
    if (!artifact.required) continue;
    if (!(await dependencies.exists(artifact.path, projectRoot))) {
      issues.push(
        issue(
          "BLOCKER",
          "B_ARTIFACT_MISSING",
          artifact.path,
          `Required ${artifact.kind} artifact is missing.`,
          { reason: artifact.reason },
        ),
      );
    }
  }
  return issues.sort((left, right) => left.path.localeCompare(right.path));
}

export { FIXED_ARTIFACTS };
