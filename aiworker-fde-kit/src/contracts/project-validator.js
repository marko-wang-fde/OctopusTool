import {
  access,
  lstat,
  open,
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCHEMA_IDS,
  createOfficialSchemaRegistry,
  validateSchema,
} from "./schema-registry.js";
import { parseSafeJson, parseSafeYaml } from "./safe-data.js";
import { validateCrossReferences } from "./cross-references.js";
import {
  deriveArtifactMatrix,
  validateArtifactPresence,
} from "../project/artifact-matrix.js";
import {
  authoritativePatterns,
  deriveProjectStatus,
  deriveStageStates,
  matchesAuthoritativePattern,
  parseStageCatalog,
  resolveAuthoritativePaths,
} from "../project/stage-state.js";
import {
  readContainedRegularFileSnapshotNoFollow,
} from "../project/project-runtime.js";
import {
  canonicalBytes,
  normalizeMarkdown,
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import { isPassingPackageReport } from "../delivery/package-report.js";
import {
  deliveryExclusionReason,
} from "../delivery/file-selection.js";
import {
  isValidPackageManifest,
} from "../delivery/package-manifest.js";
import {
  validateAssemblyPlan,
} from "../assembly/assembly-validator.js";
import {
  renderDryrunScript,
} from "../assembly/dryrun-renderer.js";
import {
  inspectRenderedDryrunScript,
} from "../assembly/shell-safety.js";
import {
  loadOperationCatalog,
} from "../assembly/operation-catalog.js";
import {
  computeArtifactSetHashFromFiles,
  expectedDryrunOperations,
  validateDryrunEvidence,
} from "../assembly/dryrun-runner.js";
import { commandResult, issue } from "../shared/result.js";
import {
  resolveAuthoritativeKitCommit,
} from "../shared/kit-commit.js";

const KIT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const STAGE_CATALOG_PATH = path.join(KIT_ROOT, "catalog/stage-artifacts.yaml");
const TOOLKIT_CATALOG_PATH = path.join(KIT_ROOT, "catalog/toolkit-keys.yaml");
const ASSEMBLY_CATALOG_PATH = path.join(
  KIT_ROOT,
  "catalog/assembly-operations.yaml",
);
const ASSEMBLY_ARTIFACT_PATTERNS = [
  "fde-project.yaml",
  "discovery/**",
  "design/**",
  "employees/**",
  "skills/**",
  "arcubase/**",
  "assembly/operations.yaml",
  "assembly/payloads/**",
  "assembly/octopus-cli-assemble.sh",
  "acceptance/**",
  "delivery-summary.md",
];

let registryPromise;

function blocker(code, issuePath, message, details = {}) {
  return issue("BLOCKER", code, issuePath, message, details);
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}

async function assertReadableProject(projectRoot, fs) {
  const metadata = await fs.lstat(projectRoot);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error("Project path must be a non-symbolic-link directory.");
  }
  await fs.access(projectRoot);
}

async function walkProject(projectRoot, fs) {
  const files = new Map();
  const snapshots = new Map();
  const issues = [];
  const stack = [""];
  while (stack.length > 0) {
    const relativeDirectory = stack.pop();
    const absoluteDirectory = relativeDirectory
      ? path.join(projectRoot, ...relativeDirectory.split("/"))
      : projectRoot;
    const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(absoluteDirectory, entry.name);
      const metadata = await fs.lstat(absolutePath);
      if (metadata.isSymbolicLink()) {
        issues.push(
          blocker(
            "B_DIRECTORY_UNSAFE",
            relativePath,
            "Project artifacts must not be symbolic links.",
          ),
        );
      } else if (metadata.isDirectory()) {
        stack.push(relativePath);
      } else if (metadata.isFile()) {
        const snapshot = await readContainedRegularFileSnapshotNoFollow(
          fs,
          projectRoot,
          relativePath,
        );
        files.set(relativePath, snapshot.bytes);
        snapshots.set(relativePath, snapshot);
      } else {
        issues.push(
          blocker(
            "B_DIRECTORY_UNSAFE",
            relativePath,
            "Project artifacts must be regular files or directories.",
          ),
        );
      }
    }
  }
  return { files, issues, snapshots };
}

function schemaIssue(schemaId, issuePath, validation) {
  return blocker(
    "B_PROJECT_SCHEMA",
    issuePath,
    `Artifact does not satisfy ${schemaId}.`,
    { errors: validation.errors },
  );
}

function stageForIssue(issueValue) {
  const location = issueValue.path;
  if (/^(?:sources|requirements|scenarios|discovery|inputs)/u.test(location)) {
    return "discover";
  }
  if (/^(?:roles|business_objects|design\/team|design\/collaboration)/u.test(location)) {
    return "team-design";
  }
  if (
    /^(?:capabilities|data_foundation|access_policies|arcubase|design\/platform|design\/data|design\/identity)/u
      .test(location)
  ) {
    return "foundation-design";
  }
  if (/^(?:workers|skills|employees)/u.test(location)) return "author";
  if (/^(?:assembly|acceptance)/u.test(location)) return "assemble";
  if (/^(?:reports|package-manifest)/u.test(location)) return "validate";
  return null;
}

function validStageSet(issues, catalog, manifestInvalid) {
  const invalid = new Set();
  if (manifestInvalid) return new Set();
  for (const issueValue of issues) {
    if (issueValue.severity !== "BLOCKER") continue;
    const stage = issueValue.details?.stage ?? stageForIssue(issueValue);
    if (stage) invalid.add(stage);
  }
  return new Set(
    catalog.stages
      .map(({ id }) => id)
      .filter((stage) => !invalid.has(stage)),
  );
}

function safeParseArtifact(relativePath, bytes, issues) {
  try {
    if (relativePath.endsWith(".json")) {
      return parseSafeJson(bytes.toString("utf8"), relativePath);
    }
    if (relativePath.endsWith(".yaml") || relativePath.endsWith(".yml")) {
      return parseSafeYaml(bytes.toString("utf8"), relativePath);
    }
  } catch (error) {
    issues.push(
      blocker(
        "B_PROJECT_PARSE",
        relativePath,
        "A project data artifact could not be parsed safely.",
        { error: errorText(error) },
      ),
    );
  }
  return bytes.toString("utf8");
}

function parseEmployeeDocument(relativePath, bytes, issues) {
  const text = bytes.toString("utf8");
  if (!text.startsWith("---\n")) return text;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    issues.push(
      blocker(
        "B_PROJECT_PARSE",
        relativePath,
        "Employee document frontmatter is not terminated.",
      ),
    );
    return text;
  }
  try {
    return parseSafeYaml(text.slice(4, end), relativePath);
  } catch (error) {
    issues.push(
      blocker(
        "B_PROJECT_PARSE",
        relativePath,
        "Employee document frontmatter could not be parsed safely.",
        { error: errorText(error) },
      ),
    );
    return text;
  }
}

function semanticallyEqual(left, right) {
  return canonicalBytes(left).equals(canonicalBytes(right));
}

function validateExternalDocuments(manifest, files, registry, issues) {
  const documents = new Map();
  for (const [relativePath, bytes] of files) {
    if (
      relativePath === "arcubase/decision.yaml" ||
      relativePath === "arcubase/schema.yaml" ||
      relativePath === "assembly/operations.yaml" ||
      relativePath === "acceptance/test-cases.yaml" ||
      relativePath.startsWith("assembly/payloads/") ||
      /(^|\/)SKILL\.md$/u.test(relativePath) ||
      /^employees\/.+\.md$/u.test(relativePath)
    ) {
      documents.set(
        relativePath,
        /^employees\/.+\.md$/u.test(relativePath)
          ? parseEmployeeDocument(relativePath, bytes, issues)
          : safeParseArtifact(relativePath, bytes, issues),
      );
    }
  }
  for (const [relativePath, schemaId] of [
    ["arcubase/decision.yaml", SCHEMA_IDS.arcubase],
    ["arcubase/schema.yaml", SCHEMA_IDS.arcubase],
    ["assembly/operations.yaml", SCHEMA_IDS.assembly],
    [
      "acceptance/test-cases.yaml",
      `${SCHEMA_IDS.project}#/$defs/acceptanceCaseDocument`,
    ],
  ]) {
    const document = documents.get(relativePath);
    if (document && typeof document === "object") {
      const validation = validateSchema(registry, schemaId, document);
      if (!validation.valid) {
        issues.push(schemaIssue(schemaId, relativePath, validation));
      }
    }
  }
  const externalArcubase = documents.get("arcubase/decision.yaml");
  if (
    externalArcubase &&
    typeof externalArcubase === "object" &&
    !semanticallyEqual(externalArcubase, manifest.data_foundation)
  ) {
    issues.push(
      blocker(
        "B_ARTIFACT_DRIFT",
        "arcubase/decision.yaml",
        "Arcubase document drifts from fde-project.yaml.",
        { stage: "foundation-design" },
      ),
    );
  }
  const externalArcubaseSchema = documents.get("arcubase/schema.yaml");
  if (
    ["new", "extend"].includes(manifest.data_foundation?.mode) &&
    externalArcubaseSchema &&
    typeof externalArcubaseSchema === "object" &&
    !semanticallyEqual(externalArcubaseSchema, manifest.data_foundation)
  ) {
    issues.push(
      blocker(
        "B_ARTIFACT_DRIFT",
        "arcubase/schema.yaml",
        "Arcubase schema artifact drifts from the manifest data foundation.",
        { stage: "foundation-design" },
      ),
    );
  }
  const externalAssembly = documents.get("assembly/operations.yaml");
  if (
    externalAssembly &&
    typeof externalAssembly === "object" &&
    !semanticallyEqual(externalAssembly, manifest.assembly)
  ) {
    issues.push(
      blocker(
        "B_ARTIFACT_DRIFT",
        "assembly/operations.yaml",
        "Assembly document drifts from fde-project.yaml.",
        { stage: "assemble" },
      ),
    );
  }
  const externalAcceptance = documents.get("acceptance/test-cases.yaml");
  if (
    externalAcceptance &&
    typeof externalAcceptance === "object" &&
    Array.isArray(externalAcceptance.cases) &&
    !semanticallyEqual(externalAcceptance.cases, manifest.acceptance_cases)
  ) {
    issues.push(
      blocker(
        "B_ARTIFACT_DRIFT",
        "acceptance/test-cases.yaml",
        "Acceptance cases drift from fde-project.yaml.",
        { stage: "assemble" },
      ),
    );
  }
  return documents;
}

function validHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

const DELIVERY_EXACT_PATHS = new Set([
  "fde-project.yaml",
  "assembly/operations.yaml",
  "assembly/octopus-cli-assemble.sh",
  "delivery-summary.md",
]);
const DELIVERY_PREFIXES = [
  "discovery/",
  "design/",
  "employees/",
  "skills/",
  "arcubase/",
  "assembly/payloads/",
  "acceptance/",
];
const PACKAGE_INPUT_EXACT_PATHS = new Set([
  ...DELIVERY_EXACT_PATHS,
  "assembly/assembly-plan.md",
  "inputs/input-inventory.md",
  "reports/package-scan-policy.yaml",
]);
const PACKAGE_INPUT_PREFIXES = [
  ...DELIVERY_PREFIXES,
  "inputs/source-files/",
];

function validPackagePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !path.posix.isAbsolute(value) &&
    !path.win32.isAbsolute(value) &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !value.split("/").some((part) => part === "." || part === "..")
  );
}

function isDeliveryPath(relativePath) {
  return (
    DELIVERY_EXACT_PATHS.has(relativePath) ||
    DELIVERY_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  );
}

function isPackageInputPath(relativePath) {
  return (
    PACKAGE_INPUT_EXACT_PATHS.has(relativePath) ||
    PACKAGE_INPUT_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
  );
}

function packageMode(relativePath) {
  return relativePath === "assembly/octopus-cli-assemble.sh"
    ? "0755"
    : "0644";
}

function canonicalPackageFile(relativePath, bytes) {
  if (relativePath === "fde-project.yaml") {
    const value = structuredClone(
      parseSafeYaml(bytes.toString("utf8"), relativePath),
    );
    if (value?.project) delete value.project.status;
    if (value?.stage_status) delete value.stage_status.validate;
    return canonicalBytes(value);
  }
  if (relativePath === "assembly/operations.yaml") {
    const value = structuredClone(
      parseSafeYaml(bytes.toString("utf8"), relativePath),
    );
    return canonicalBytes(value);
  }
  if (relativePath.endsWith(".yaml") || relativePath.endsWith(".yml")) {
    return canonicalBytes(
      parseSafeYaml(bytes.toString("utf8"), relativePath),
    );
  }
  if (relativePath.endsWith(".json")) {
    return canonicalBytes(
      parseSafeJson(bytes.toString("utf8"), relativePath),
    );
  }
  if (relativePath.endsWith(".md")) {
    return Buffer.from(normalizeMarkdown(bytes.toString("utf8")), "utf8");
  }
  return bytes;
}

export function authoritativeStageHash(relativePath, bytes) {
  return relativePath === "assembly/operations.yaml"
    ? sha256Bytes(canonicalPackageFile(relativePath, bytes))
    : sha256Bytes(bytes);
}

function authoritativeDelivery(
  manifest,
  files,
  stageCatalog,
  issues,
  includeSources = false,
  expandedSelection = false,
) {
  let paths;
  let inputPaths;
  try {
    const present = new Set(files.keys());
    const catalogPaths = stageCatalog.stages.flatMap(({ id }) => {
      const resolved = resolveAuthoritativePaths(
        stageCatalog,
        id,
        present,
        manifest,
      );
      return [...resolved.inputs, ...resolved.outputs];
    });
    const matrixPaths = deriveArtifactMatrix(manifest)
      .filter(({ required, contractIssue }) => required && !contractIssue)
      .map(({ path: relativePath }) => relativePath);
    const contractPaths = new Set(
      [...catalogPaths, ...matrixPaths].filter(isDeliveryPath),
    );
    const missing = [...contractPaths].filter(
      (relativePath) => !files.has(relativePath),
    );
    if (missing.length > 0) {
      packageEvidenceIssue(
        issues,
        "package-manifest.json",
        "The authoritative artifact contracts require delivery files that are missing from disk.",
        { missing_files: sortRelativePaths(missing) },
      );
      return null;
    }
    inputPaths = sortRelativePaths(
      [
        ...new Set([
          ...contractPaths,
          ...[...files.keys()].filter((relativePath) =>
            isDeliveryPath(relativePath)),
          ...[...files.keys()].filter((relativePath) =>
            includeSources &&
            relativePath.startsWith("inputs/source-files/") &&
            deliveryExclusionReason(relativePath, true) === null),
        ]),
      ],
    );
    paths = expandedSelection
      ? sortRelativePaths([...files.keys()].filter((relativePath) =>
        relativePath !== ".gitignore" &&
        relativePath !== "package-manifest.json" &&
        relativePath !== "reports/validation-report.json" &&
        relativePath !== "reports/validation-report.md" &&
        (
          !relativePath.startsWith("inputs/source-files/") ||
          includeSources
        )))
      : inputPaths;
  } catch (error) {
    packageEvidenceIssue(
      issues,
      "package-manifest.json",
      "The authoritative delivery set contains an unsafe or duplicate path.",
      { error: errorText(error) },
    );
    return null;
  }
  const expected = new Map();
  const inputRecords = [];
  try {
    for (const relativePath of paths) {
      const bytes = files.get(relativePath);
      expected.set(relativePath, {
        type: "file",
        mode: packageMode(relativePath),
        sha256: sha256Bytes(bytes),
      });
      const canonicalHash = sha256Bytes(
        canonicalPackageFile(relativePath, bytes),
      );
      if (inputPaths.includes(relativePath)) {
        inputRecords.push(
          Buffer.from(`${relativePath}\0${canonicalHash}\n`, "utf8"),
        );
      }
    }
  } catch (error) {
    packageEvidenceIssue(
      issues,
      "package-manifest.json",
      "The authoritative delivery set could not be canonicalized.",
      { error: errorText(error) },
    );
    return null;
  }
  return {
    expected,
    packageInputHash: sha256Bytes(Buffer.concat(inputRecords)),
  };
}

function scanPolicyHash(files, issues) {
  const policyPath = "reports/package-scan-policy.yaml";
  const bytes = files.get(policyPath);
  if (!bytes) {
    packageEvidenceIssue(
      issues,
      policyPath,
      "Package evidence cannot be verified without its actual scan policy inputs.",
    );
    return null;
  }
  try {
    const policy = parseSafeYaml(bytes.toString("utf8"), policyPath);
    const policyKeys = policy && typeof policy === "object"
      ? Object.keys(policy).sort()
      : [];
    const exceptions = policy?.exceptions;
    const seen = new Set();
    const policyValid =
      JSON.stringify(policyKeys) ===
        JSON.stringify(["exceptions", "schema_version"]) &&
      policy.schema_version === 1 &&
      Array.isArray(exceptions) &&
      exceptions.every((exception) => {
        if (
          !exception ||
          typeof exception !== "object" ||
          Array.isArray(exception) ||
          JSON.stringify(Object.keys(exception).sort()) !==
            JSON.stringify(["category", "path", "reason"]) ||
          !validPackagePath(exception.path) ||
          !isDeliveryPath(exception.path) ||
          typeof exception.category !== "string" ||
          exception.category.length === 0 ||
          typeof exception.reason !== "string" ||
          exception.reason.length === 0
        ) {
          return false;
        }
        const key = `${exception.path}\0${exception.category}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (!policyValid) {
      packageEvidenceIssue(
        issues,
        policyPath,
        "Package scan policy must use exact file/category/reason exceptions; broad or unknown policy fields are not authoritative.",
      );
      return null;
    }
    return sha256Bytes(
      canonicalBytes(policy),
    );
  } catch (error) {
    packageEvidenceIssue(
      issues,
      policyPath,
      "Package scan policy inputs are not safe, valid YAML.",
      { error: errorText(error) },
    );
    return null;
  }
}

function packageEvidenceIssue(issues, issuePath, message, details = {}) {
  issues.push(
    blocker(
      "B_PACKAGE_EVIDENCE_INVALID",
      issuePath,
      message,
      { stage: "validate", ...details },
    ),
  );
}

function parsePackageJson(relativePath, files, issues) {
  const bytes = files.get(relativePath);
  if (!bytes) return null;
  try {
    return parseSafeJson(bytes.toString("utf8"), relativePath);
  } catch (error) {
    packageEvidenceIssue(
      issues,
      relativePath,
      "Package evidence is not safe, valid JSON.",
      { error: errorText(error) },
    );
    return null;
  }
}

async function validatePackageEvidence(
  manifest,
  files,
  fs,
  stageCatalog,
  issues,
  authority,
) {
  const reportPath = "reports/package-validation.json";
  const packageManifestPath = "package-manifest.json";
  const hasReport = files.has(reportPath);
  const hasManifest = files.has(packageManifestPath);
  if (!hasReport && !hasManifest) return;
  if (!hasReport) {
    packageEvidenceIssue(
      issues,
      reportPath,
      "A package manifest cannot be verified without its validation report.",
    );
    return;
  }
  const report = parsePackageJson(reportPath, files, issues);
  const packageManifest = hasManifest
    ? parsePackageJson(packageManifestPath, files, issues)
    : null;
  if (!report || (hasManifest && !packageManifest)) return;
  const sourceModes = packageManifest
    ? [packageManifest.sources_included === true]
    : [false, true];
  const candidateIssueSets = sourceModes.map(() => []);
  const deliveryCandidates = sourceModes.map((includeSources, index) =>
    authoritativeDelivery(
      manifest,
      files,
      stageCatalog,
      packageManifest ? issues : candidateIssueSets[index],
      includeSources,
      packageManifest?.selection_version === 1,
    ));
  const delivery = packageManifest
    ? deliveryCandidates[0]
    : deliveryCandidates.find((candidate) =>
      candidate?.packageInputHash === report.package_input_hash);
  if (!packageManifest && deliveryCandidates.every((candidate) => !candidate)) {
    const seenCandidateIssues = new Set();
    for (const candidateIssue of candidateIssueSets.flat()) {
      const key = JSON.stringify(candidateIssue);
      if (seenCandidateIssues.has(key)) continue;
      seenCandidateIssues.add(key);
      issues.push(candidateIssue);
    }
  }
  const actualScanPolicyHash = scanPolicyHash(files, issues);
  let actualKitCommit;
  try {
    actualKitCommit = await resolveAuthoritativeKitCommit({
      kitRoot: authority.kitRoot,
      env: authority.env,
      fs,
    });
  } catch (error) {
    packageEvidenceIssue(
      issues,
      reportPath,
      "The Kit commit authority could not be read.",
      { error: errorText(error) },
    );
  }
  if (!actualKitCommit) {
    packageEvidenceIssue(
      issues,
      reportPath,
      "Package evidence cannot be verified without an authoritative Kit commit.",
    );
  }

  const reportShape =
    isPassingPackageReport(report);
  const manifestShape =
    !packageManifest || isValidPackageManifest(packageManifest);
  if (!reportShape || !manifestShape) {
    packageEvidenceIssue(
      issues,
      !reportShape ? reportPath : packageManifestPath,
      "Package evidence has an invalid structure or a non-passing result.",
    );
    return;
  }
  if (
    report.project_slug !== manifest.project.slug ||
    report.package_input_hash !== delivery?.packageInputHash ||
    report.scan_policy_hash !== actualScanPolicyHash ||
    report.kit_commit !== actualKitCommit
  ) {
    packageEvidenceIssue(
      issues,
      reportPath,
      "Package evidence is not bound to this project and package manifest.",
    );
  }
  if (!packageManifest) return;
  if (
    packageManifest.project_slug !== manifest.project.slug ||
    report.package_input_hash !== packageManifest.package_input_hash ||
    report.package_input_hash !== delivery?.packageInputHash
  ) {
    packageEvidenceIssue(
      issues,
      packageManifestPath,
      "Package manifest is not bound to the reusable validation report.",
    );
  }

  const seen = new Set();
  const caseFolded = new Set();
  const expectedPaths = [...(delivery?.expected.keys() ?? [])];
  for (const [index, entry] of packageManifest.files.entries()) {
    const entryPath = entry?.path;
    const expected = delivery?.expected.get(entryPath);
    const folded = typeof entryPath === "string"
      ? entryPath.toLocaleLowerCase("en-US")
      : null;
    if (
      !validPackagePath(entryPath) ||
      !validHash(entry?.sha256) ||
      typeof entry?.classification !== "string" ||
      entry.classification.length === 0 ||
      entryPath === packageManifestPath ||
      seen.has(entryPath) ||
      (folded !== null && caseFolded.has(folded)) ||
      entryPath !== expectedPaths[index] ||
      !expected ||
      entry.type !== expected.type ||
      entry.mode !== expected.mode ||
      entry.sha256 !== expected.sha256
    ) {
      packageEvidenceIssue(
        issues,
        `${packageManifestPath}.files[${index}]`,
        "Package manifest entry is unsafe, unsorted, duplicated, unexpected, missing metadata, or inconsistent with the authoritative delivery file.",
      );
    }
    if (typeof entryPath === "string") {
      seen.add(entryPath);
      caseFolded.add(folded);
    }
  }
  if (
    packageManifest.files.length !== expectedPaths.length ||
    expectedPaths.some((relativePath) => !seen.has(relativePath))
  ) {
    packageEvidenceIssue(
      issues,
      packageManifestPath,
      "Package manifest does not exactly cover the authoritative delivery file set.",
      {
        expected_files: expectedPaths,
        recorded_files: packageManifest.files.map((entry) =>
          entry?.path ?? null),
      },
    );
  }
}

async function loadKitContracts(fs) {
  const [stageText, toolkitText, assemblyCatalog] = await Promise.all([
    fs.readFile(STAGE_CATALOG_PATH, "utf8"),
    fs.readFile(TOOLKIT_CATALOG_PATH, "utf8"),
    loadOperationCatalog(ASSEMBLY_CATALOG_PATH),
  ]);
  const stageCatalog = parseStageCatalog(stageText);
  const toolkitCatalog = parseSafeYaml(toolkitText, "toolkit-keys.yaml");
  if (!Array.isArray(toolkitCatalog.toolkits)) {
    throw new Error("Toolkit catalog is invalid.");
  }
  return {
    stageCatalog,
    toolkitKeys: new Set(toolkitCatalog.toolkits.map(({ key }) => key)),
    assemblyCatalog,
  };
}

function validateAssemblyArtifacts({
  plan,
  documents,
  files,
  snapshots,
  registry,
  catalog,
  artifactVariables,
  dependencies,
}) {
  const issues = [];
  if (!plan || typeof plan !== "object") {
    return { issues, validation: null };
  }
  const payloads = new Map(
    [...documents].filter(([relativePath, value]) =>
      relativePath.startsWith("assembly/payloads/") &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)),
  );
  const validation = validateAssemblyPlan(plan, {
    catalog,
    registry,
    payloads,
    artifactVariables,
  });
  issues.push(...validation.issues);
  if (validation.issues.length > 0) return { issues, validation };
  const scriptPath = "assembly/octopus-cli-assemble.sh";
  const evidencePath = "reports/cli-assemble-evidence.json";
  const actualScript = files.get(scriptPath);
  const actualEvidence = files.get(evidencePath);
  const expectsScript = ["ready", "executed"].includes(
    plan.assembly_execution?.status,
  );
  if (validation.supportedWrites.length === 0) {
    if (actualScript) {
      issues.push(blocker(
        "B_ASSEMBLY_SCRIPT_UNEXPECTED",
        scriptPath,
        "Projects without supported writes must not contain an assembly script.",
        { stage: "assemble" },
      ));
    }
    if (actualEvidence) {
      issues.push(blocker(
        "B_ASSEMBLY_EVIDENCE_UNEXPECTED",
        evidencePath,
        "Projects without supported writes must not contain CLI assembly success evidence.",
        { stage: "validate" },
      ));
    }
    return { issues, validation };
  }
  const catalogById = new Map(
    catalog.supported.map((operation) => [operation.operation_id, operation]),
  );
  let expectedScript;
  try {
    expectedScript = renderDryrunScript(
      validation.supportedWrites,
      catalogById,
    );
  } catch (error) {
    issues.push(blocker(
      "B_ASSEMBLY_SCRIPT_TAMPERED",
      scriptPath,
      "Validated operations could not be rendered by the fixed assembly template.",
      { stage: "assemble", error: errorText(error) },
    ));
    return { issues, validation };
  }
  if (expectsScript && !actualScript) {
    issues.push(blocker(
      "B_ASSEMBLY_SCRIPT_MISSING",
      scriptPath,
      "Ready or executed assembly requires the generated assembly script.",
      { stage: "assemble" },
    ));
  }
  if (!expectsScript && actualScript) {
    issues.push(blocker(
      "B_ASSEMBLY_SCRIPT_UNEXPECTED",
      scriptPath,
      "Assembly script exists while assembly state does not declare it ready.",
      { stage: "assemble" },
    ));
  }
  if (plan.assembly_execution?.status !== "executed" && actualEvidence) {
    issues.push(blocker(
      "B_ASSEMBLY_EVIDENCE_UNEXPECTED",
      evidencePath,
      "CLI assembly success evidence exists while assembly state is not executed.",
      { stage: "validate" },
    ));
  }
  if (actualScript) {
    const inspection = inspectRenderedDryrunScript(actualScript, expectedScript, {
      processAdapter: dependencies?.localProcess,
    });
    const mode = snapshots.get(scriptPath)?.mode & 0o777;
    if (!inspection.valid || mode !== 0o755) {
      issues.push(blocker(
        "B_ASSEMBLY_SCRIPT_TAMPERED",
        scriptPath,
        "Assembly script bytes, Bash syntax, or mode differ from the fixed renderer.",
        { stage: "assemble", expected_mode: "0755", actual_mode: mode?.toString(8) },
      ));
    }
  }
  if (plan.assembly_execution?.status === "executed") {
    let evidence;
    try {
      if (
        plan.assembly_execution.evidence_file !== evidencePath ||
        !files.has(evidencePath)
      ) {
        throw new Error("Executed assembly evidence file is missing.");
      }
      evidence = parseSafeJson(
        files.get(evidencePath).toString("utf8"),
        evidencePath,
      );
      if (
        evidence.cli?.npm_package_version !==
          plan.assembly_execution.cli_package_version ||
        evidence.cli?.reported_version !==
          plan.assembly_execution.cli_reported_version
      ) {
        throw new Error("Recorded CLI versions differ from run evidence.");
      }
      const verified = validateDryrunEvidence(evidence, {
        artifactSetSha256: computeArtifactSetHashFromFiles(files),
        cliRealpath: evidence.cli?.binary_realpath,
        cliSha256: evidence.cli?.binary_sha256,
        expectedOperations: expectedDryrunOperations(
          validation.supportedWrites,
          catalogById,
        ),
      });
      issues.push(...verified.issues);
    } catch (error) {
      issues.push(blocker(
        "B_ASSEMBLY_EVIDENCE_INVALID",
        evidencePath,
        "Executed assembly status is not backed by complete current evidence.",
        { stage: "validate", error: errorText(error) },
      ));
    }
  }
  return { issues, validation };
}

export async function validateProjectDirectory(projectRoot, overrides = {}) {
  const fs = {
    access,
    lstat,
    open,
    readdir,
    readFile,
    ...overrides.fs,
  };
  await assertReadableProject(projectRoot, fs);
  const contracts = await loadKitContracts(fs);
  const manifestPath = path.join(projectRoot, "fde-project.yaml");
  let manifest;
  let manifestSchemaValid = false;
  const issues = [];
  let manifestBytes;
  let manifestSnapshot;
  try {
    manifestSnapshot = await readContainedRegularFileSnapshotNoFollow(
      fs,
      projectRoot,
      "fde-project.yaml",
    );
    manifestBytes = manifestSnapshot.bytes;
    manifest = parseSafeYaml(manifestBytes.toString("utf8"), "fde-project.yaml");
  } catch (error) {
    issues.push(
      blocker(
        "B_PROJECT_PARSE",
        "fde-project.yaml",
        "Project manifest could not be parsed safely.",
        { error: errorText(error) },
      ),
    );
  }

  const {
    files,
    issues: directoryIssues,
    snapshots,
  } = await walkProject(projectRoot, fs);
  issues.push(...directoryIssues);
  const present = new Set(files.keys());
  const hashes = Object.fromEntries(
    [...files.entries()].map(([relativePath, bytes]) => [
      relativePath,
      authoritativeStageHash(relativePath, bytes),
    ]),
  );

  let registry;
  let assemblyValidation = null;
  if (manifest) {
    registryPromise ??= createOfficialSchemaRegistry();
    registry = await registryPromise;
    const schema = validateSchema(registry, SCHEMA_IDS.project, manifest);
    if (!schema.valid) {
      issues.push(schemaIssue(SCHEMA_IDS.project, "fde-project.yaml", schema));
    } else {
      manifestSchemaValid = true;
      const matrix = deriveArtifactMatrix(manifest);
      issues.push(
        ...(await validateArtifactPresence(projectRoot, matrix, {
          exists: async (relativePath) => present.has(relativePath),
        })),
      );
      const documents = validateExternalDocuments(
        manifest,
        files,
        registry,
        issues,
      );
      const assembly = validateAssemblyArtifacts({
        plan: documents.get("assembly/operations.yaml"),
        documents,
        files,
        snapshots,
        registry,
        catalog: contracts.assemblyCatalog,
        dependencies: overrides.dependencies,
        artifactVariables: new Map([[
          "skill-slug",
          (manifest.skills ?? []).map(({ id }) =>
            id?.replace(/^skill\./u, "").replaceAll("_", "-")),
        ]]),
      });
      issues.push(...assembly.issues);
      assemblyValidation = assembly.validation;
      issues.push(
        ...validateCrossReferences(manifest, {
          toolkitKeys: contracts.toolkitKeys,
          files: documents,
          unsafePaths: directoryIssues
            .filter(({ code }) => code === "B_DIRECTORY_UNSAFE")
            .map(({ path: issuePath }) => issuePath),
        }),
      );
      await validatePackageEvidence(
        manifest,
        files,
        fs,
        contracts.stageCatalog,
        issues,
        {
          kitRoot: overrides.kitRoot ?? KIT_ROOT,
          env: overrides.env ?? process.env,
        },
      );
    }
  }

  let sorted = commandResult(issues).issues;
  const validStages = manifestSchemaValid
    ? validStageSet(sorted, contracts.stageCatalog, false)
    : new Set();
  const workingStages = new Set(
    contracts.stageCatalog.stages
      .map(({ id }) => id)
      .filter((id) => present.has(`.stage-${id}.in-progress`)),
  );
  const stageStates = manifestSchemaValid
    ? deriveStageStates(manifest, contracts.stageCatalog, {
        hashes,
        present,
        validStages,
        workingStages,
      })
    : Object.fromEntries(
        contracts.stageCatalog.stages.map(({ id }) => [id, "not-started"]),
      );
  const blockers = sorted.filter(({ severity }) => severity === "BLOCKER");
  const projectStatus = manifestSchemaValid
    ? deriveProjectStatus(manifest, stageStates, blockers)
    : "draft";
  if (manifestSchemaValid && manifest.project?.status !== projectStatus) {
    sorted = commandResult([
      ...sorted,
      blocker(
        "B_PROJECT_STATUS_DRIFT",
        "project.status",
        `Recorded project status ${manifest.project?.status} does not match derived status ${projectStatus}.`,
      ),
    ]).issues;
  }
  const result = commandResult(sorted, {
    stage_states: stageStates,
    project_status: projectStatus,
  });
  let validationSnapshot = null;
  if (manifestSchemaValid && overrides.stageId) {
    const stagePatterns = authoritativePatterns(
      contracts.stageCatalog,
      overrides.stageId,
      manifest,
    );
    const stageAuthoritative = resolveAuthoritativePaths(
      contracts.stageCatalog,
      overrides.stageId,
      present,
      manifest,
    );
    const deliveryPaths = sortRelativePaths(
      [...present].filter(isPackageInputPath),
    );
    const snapshotPaths = sortRelativePaths([
      ...new Set([
        ...deliveryPaths,
        ...stageAuthoritative.inputs,
        ...stageAuthoritative.outputs,
      ]),
    ]);
    validationSnapshot = {
      stage: overrides.stageId,
      files: snapshotPaths
        .map((relativePath) => snapshots.get(relativePath))
        .filter(Boolean),
      authoritative: {
        patterns: sortRelativePaths([
          ...new Set([
            ...PACKAGE_INPUT_EXACT_PATHS,
            ...PACKAGE_INPUT_PREFIXES.map((prefix) => `${prefix}**`),
            ...stagePatterns.inputs,
            ...stagePatterns.outputs,
          ]),
        ]),
        paths: snapshotPaths,
      },
    };
  }
  const assemblyArtifactPaths = sortRelativePaths(
    [...present].filter((relativePath) =>
      ASSEMBLY_ARTIFACT_PATTERNS.some((pattern) =>
        matchesAuthoritativePattern(pattern, relativePath))),
  );
  const assemblyValidationSnapshot = manifestSchemaValid
    ? {
      stage: "validate-assembly",
      files: assemblyArtifactPaths
        .map((relativePath) => snapshots.get(relativePath))
        .filter(Boolean),
      authoritative: {
        patterns: ASSEMBLY_ARTIFACT_PATTERNS,
        paths: assemblyArtifactPaths,
      },
    }
    : null;
  return {
    ...result,
    context: {
      projectRoot,
      manifest: manifestSchemaValid ? manifest : null,
      manifestBytes,
      files,
      present,
      hashes,
      stageCatalog: contracts.stageCatalog,
      validStages,
      validationSnapshot,
      dryrunValidationSnapshot: assemblyValidationSnapshot,
      assemblyValidation,
      assemblyCatalog: contracts.assemblyCatalog,
    },
  };
}
