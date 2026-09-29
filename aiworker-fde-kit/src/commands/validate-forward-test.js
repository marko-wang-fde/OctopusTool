import {
  lstat,
  readFile,
  readdir,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { spawnCommand } from "../assembly/cli-runner.js";
import {
  canonicalSkillPaths,
  computeSkillTreeHash,
} from "../install/file-snapshot.js";
import {
  parseSafeJson,
  parseSafeYaml,
} from "../contracts/safe-data.js";
import {
  sha256Bytes,
  sortRelativePaths,
} from "../shared/canonical.js";
import { commandResult, issue } from "../shared/result.js";
import {
  publicContentFindingCodes,
  publicFilenameFindingCodes,
} from "../security/public-content-rules.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const USAGE = "Usage: validate-forward-test <results-directory>";
const TRACKS = ["baseline", "with-skill"];
const TRACK_FILES = new Map([
  ["baseline", "v0.1.0-baseline.md"],
  ["with-skill", "v0.1.0-with-skill.md"],
]);
const CASE_FILES = ["agent-output.yaml", "artifact-manifest.json"];
const REPORT_KEYS = [
  "agent",
  "candidate_commit",
  "candidate_dirty",
  "cases",
  "cases_sha256",
  "evidence_root",
  "executed_at",
  "install_receipt",
  "model",
  "network_used",
  "production_writes",
  "run_id",
  "schema_version",
  "session_id",
  "track",
];
const REPORT_CASE_KEYS = [
  "evidence_path",
  "id",
  "input_sha256",
  "outcome",
];
const OUTPUT_KEYS = [
  "candidate_commit",
  "case_id",
  "constraints",
  "focus_results",
  "input_sha256",
  "observation_codes",
  "outcome",
  "run_id",
  "schema_version",
  "session_id",
  "track",
];
const MANIFEST_KEYS = [
  "candidate_commit",
  "case_id",
  "files",
  "input_sha256",
  "run_id",
  "schema_version",
  "session_id",
  "track",
];
const RECEIPT_KEYS = [
  "mode",
  "schema_version",
  "source_commit",
  "source_dirty",
  "source_tree_hash",
  "target",
];
const CASE_CONTRACT_KEYS = [
  "expected_focus",
  "id",
  "input",
  "input_sha256",
];
const HASH = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_RUN_ID = /^[a-z0-9]+(?:-[a-z0-9]+){1,7}$/u;
const decoder = new TextDecoder("utf-8", { fatal: true });

function withExit(exitCode, issues, data = {}) {
  return { ...commandResult(issues, data), exitCode };
}

function invocation(code, message) {
  return withExit(2, [
    issue("BLOCKER", code, ".", message),
  ], { usage: USAGE });
}

function parseArguments(args, cwd) {
  if (args.length === 1 && args[0] === "--help") return { help: true };
  if (args.length === 0) {
    return { error: invocation("B_ARGUMENT_MISSING", "Results directory is required.") };
  }
  if (args.length !== 1) {
    return { error: invocation("B_ARGUMENT_UNKNOWN", "Exactly one results directory is accepted.") };
  }
  return { directory: path.resolve(cwd, args[0]) };
}

function parseFrontmatter(text, sourceName) {
  if (!text.startsWith("---\n")) {
    throw new Error(`${sourceName} does not start with YAML frontmatter.`);
  }
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error(`${sourceName} has unterminated YAML frontmatter.`);
  }
  return parseSafeYaml(text.slice(4, end), sourceName);
}

function exactKeys(value, keys) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...keys].sort()),
  );
}

function validRelativePath(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("\\") &&
    !path.posix.isAbsolute(value) &&
    value.split("/").every((segment) =>
      segment !== "" && segment !== "." && segment !== "..")
  );
}

function inside(repository, absolutePath) {
  return (
    absolutePath === repository ||
    absolutePath.startsWith(`${repository}${path.sep}`)
  );
}

function schemaFinding(relativePath, message) {
  return issue(
    "BLOCKER",
    "B_FORWARD_SCHEMA",
    relativePath,
    message,
  );
}

function validateCasesDocument(document) {
  if (
    !exactKeys(document, ["cases", "schema_version"]) ||
    document.schema_version !== 1 ||
    !Array.isArray(document.cases) ||
    document.cases.length !== 6
  ) {
    throw new Error("Forward-test cases contract is malformed.");
  }
  const ids = new Set();
  for (const entry of document.cases) {
    if (
      !exactKeys(entry, CASE_CONTRACT_KEYS) ||
      !SAFE_ID.test(entry.id ?? "") ||
      ids.has(entry.id) ||
      !HASH.test(entry.input_sha256 ?? "") ||
      typeof entry.input !== "string" ||
      entry.input.length === 0 ||
      sha256Bytes(Buffer.from(entry.input, "utf8")) !== entry.input_sha256 ||
      !Array.isArray(entry.expected_focus) ||
      entry.expected_focus.length === 0 ||
      new Set(entry.expected_focus).size !== entry.expected_focus.length ||
      entry.expected_focus.some((value) =>
        typeof value !== "string" || value.trim().length === 0)
    ) {
      throw new Error("Forward-test cases contract is malformed.");
    }
    ids.add(entry.id);
  }
  return document.cases;
}

function validateReportSchema(report, expectedTrack, expectedCases) {
  if (
    !exactKeys(report, REPORT_KEYS) ||
    report.schema_version !== 2 ||
    report.track !== expectedTrack ||
    !COMMIT.test(report.candidate_commit ?? "") ||
    report.candidate_dirty !== false ||
    !HASH.test(report.cases_sha256 ?? "") ||
    typeof report.agent !== "string" ||
    report.agent.trim().length === 0 ||
    typeof report.model !== "string" ||
    report.model.trim().length === 0 ||
    !SAFE_RUN_ID.test(report.session_id ?? "") ||
    !SAFE_RUN_ID.test(report.run_id ?? "") ||
    typeof report.executed_at !== "string" ||
    Number.isNaN(Date.parse(report.executed_at)) ||
    new Date(report.executed_at).toISOString() !== report.executed_at ||
    report.evidence_root !== `evals/evidence/${expectedTrack}` ||
    report.install_receipt !== (
      expectedTrack === "with-skill"
        ? "evals/evidence/with-skill/install-receipt.yaml"
        : null
    ) ||
    report.network_used !== false ||
    report.production_writes !== false ||
    !Array.isArray(report.cases) ||
    report.cases.length !== expectedCases.length
  ) {
    return false;
  }
  const expectedById = new Map(expectedCases.map((entry) => [entry.id, entry]));
  const ids = new Set();
  for (const entry of report.cases) {
    const expected = expectedById.get(entry?.id);
    if (
      !exactKeys(entry, REPORT_CASE_KEYS) ||
      !expected ||
      ids.has(entry.id) ||
      entry.input_sha256 !== expected.input_sha256 ||
      entry.evidence_path !==
        `evals/evidence/${expectedTrack}/${entry.id}` ||
      entry.outcome !== (
        expectedTrack === "baseline" ? "observed" : "validated"
      )
    ) {
      return false;
    }
    ids.add(entry.id);
  }
  return ids.size === expectedCases.length;
}

function validateOutputSchema(output) {
  return Boolean(
    exactKeys(output, OUTPUT_KEYS) &&
    output.schema_version === 1 &&
    TRACKS.includes(output.track) &&
    SAFE_ID.test(output.case_id ?? "") &&
    COMMIT.test(output.candidate_commit ?? "") &&
    SAFE_RUN_ID.test(output.session_id ?? "") &&
    SAFE_RUN_ID.test(output.run_id ?? "") &&
    HASH.test(output.input_sha256 ?? "") &&
    ["observed", "validated"].includes(output.outcome) &&
    exactKeys(output.constraints, ["network_used", "production_writes"]) &&
    typeof output.constraints.network_used === "boolean" &&
    typeof output.constraints.production_writes === "boolean" &&
    Array.isArray(output.focus_results) &&
    output.focus_results.every((entry) =>
      exactKeys(entry, ["addressed", "requirement"]) &&
      typeof entry.requirement === "string" &&
      entry.requirement.trim().length > 0 &&
      typeof entry.addressed === "boolean") &&
    Array.isArray(output.observation_codes) &&
    output.observation_codes.every((entry) =>
      typeof entry === "string" && /^[A-Z][A-Z0-9_]*$/u.test(entry)) &&
    (
      output.track === "baseline"
        ? output.observation_codes.length > 0
        : output.observation_codes.length === 0
    )
  );
}

function validateManifestSchema(manifest) {
  return Boolean(
    exactKeys(manifest, MANIFEST_KEYS) &&
    manifest.schema_version === 1 &&
    TRACKS.includes(manifest.track) &&
    SAFE_ID.test(manifest.case_id ?? "") &&
    COMMIT.test(manifest.candidate_commit ?? "") &&
    SAFE_RUN_ID.test(manifest.session_id ?? "") &&
    SAFE_RUN_ID.test(manifest.run_id ?? "") &&
    HASH.test(manifest.input_sha256 ?? "") &&
    Array.isArray(manifest.files) &&
    manifest.files.length === 1 &&
    exactKeys(manifest.files[0], ["path", "sha256"]) &&
    manifest.files[0].path === "agent-output.yaml" &&
    HASH.test(manifest.files[0].sha256 ?? "")
  );
}

function validateReceiptSchema(receipt) {
  return Boolean(
    exactKeys(receipt, RECEIPT_KEYS) &&
    receipt.schema_version === 1 &&
    receipt.mode === "copy" &&
    ["codex", "claude-code"].includes(receipt.target) &&
    COMMIT.test(receipt.source_commit ?? "") &&
    receipt.source_dirty === false &&
    HASH.test(receipt.source_tree_hash ?? "")
  );
}

async function readRegularFile(filePath) {
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("Evidence artifact is not a regular file.");
  }
  return readFile(filePath);
}

function scanBytes(relativePath, bytes) {
  const filenameCodes = publicFilenameFindingCodes(relativePath);
  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    return ["B_PUBLIC_BINARY_UNKNOWN", ...filenameCodes];
  }
  return [...new Set([
    ...filenameCodes,
    ...publicContentFindingCodes(text),
  ])];
}

async function exactDirectoryEntries(directory, expectedNames) {
  const entries = await readdir(directory, { withFileTypes: true });
  const actual = entries.map(({ name }) => name).sort();
  const expected = [...expectedNames].sort();
  return {
    entries,
    exact: actual.join("\0") === expected.join("\0"),
  };
}

async function inspectEvidenceRoot(repository, relativeRoot) {
  if (!validRelativePath(relativeRoot)) return null;
  const absolute = path.resolve(repository, ...relativeRoot.split("/"));
  if (!inside(repository, absolute)) return null;
  let metadata;
  try {
    metadata = await lstat(absolute);
  } catch {
    return null;
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
  const [resolvedRepository, resolvedRoot] = await Promise.all([
    realpath(repository),
    realpath(absolute),
  ]);
  if (!inside(resolvedRepository, resolvedRoot)) return null;
  return absolute;
}

async function runGit(repository, args, execute) {
  return execute("git", ["-C", repository, ...args], {
    shell: false,
    cwd: repository,
  });
}

function splitNulRecords(bytes) {
  const records = [];
  let offset = 0;
  while (offset < bytes.length) {
    const end = bytes.indexOf(0, offset);
    if (end === -1) {
      throw new Error("Git tree output is not NUL terminated.");
    }
    if (end > offset) records.push(bytes.subarray(offset, end));
    offset = end + 1;
  }
  return records;
}

function canonicalCandidatePath(relativePath, paths) {
  return (
    paths.exact_files.includes(relativePath) ||
    paths.roots.some((root) =>
      relativePath === root || relativePath.startsWith(`${root}/`))
  );
}

async function candidateSkillTreeHash(
  repository,
  candidate,
  execute,
) {
  const paths = canonicalSkillPaths();
  const listing = await runGit(
    repository,
    [
      "ls-tree",
      "-rz",
      "--full-tree",
      candidate,
      "--",
      ...paths.exact_files,
      ...paths.roots,
    ],
    execute,
  );
  if (
    listing.exitCode !== 0 ||
    !Buffer.isBuffer(listing.stdout)
  ) {
    throw new Error("Git could not read the candidate Skill tree.");
  }
  const entries = new Map();
  for (const record of splitNulRecords(listing.stdout)) {
    const separator = record.indexOf(0x09);
    if (separator <= 0 || separator === record.length - 1) {
      throw new Error("Git returned malformed candidate tree metadata.");
    }
    const metadata = decoder.decode(record.subarray(0, separator));
    const match = metadata.match(
      /^([0-7]{6}) ([a-z]+) ([a-f0-9]{40}|[a-f0-9]{64})$/u,
    );
    const relativePath = decoder.decode(record.subarray(separator + 1));
    if (
      !match ||
      match[2] !== "blob" ||
      !["100644", "100755", "120000"].includes(match[1]) ||
      !validRelativePath(relativePath) ||
      !canonicalCandidatePath(relativePath, paths) ||
      entries.has(relativePath)
    ) {
      throw new Error("Git returned an unsafe candidate Skill entry.");
    }
    entries.set(relativePath, {
      mode: match[1],
      object: match[3],
    });
  }
  const files = {};
  for (const relativePath of sortRelativePaths([...entries.keys()])) {
    const entry = entries.get(relativePath);
    const blob = await runGit(
      repository,
      ["cat-file", "blob", entry.object],
      execute,
    );
    if (blob.exitCode !== 0 || !Buffer.isBuffer(blob.stdout)) {
      throw new Error("Git could not read a candidate Skill blob.");
    }
    if (entry.mode === "120000") {
      const linkTarget = decoder.decode(blob.stdout);
      if (linkTarget.includes("\0")) {
        throw new Error("Candidate Skill symlink target is invalid.");
      }
      files[relativePath] = {
        type: "symlink",
        sha256: null,
        mode: "0777",
        link_target: linkTarget,
      };
    } else {
      files[relativePath] = {
        type: "file",
        sha256: sha256Bytes(blob.stdout),
        mode: entry.mode === "100755" ? "0755" : "0644",
        link_target: null,
      };
    }
  }
  return computeSkillTreeHash(files);
}

async function validateGitState(repository, candidate, execute) {
  const findings = [];
  const exists = await runGit(
    repository,
    ["cat-file", "-e", `${candidate}^{commit}`],
    execute,
  );
  if (exists.exitCode !== 0) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_CANDIDATE",
      ".",
      "Recorded candidate commit does not exist in this repository.",
    ));
    return findings;
  }
  const ancestor = await runGit(
    repository,
    ["merge-base", "--is-ancestor", candidate, "HEAD"],
    execute,
  );
  if (ancestor.exitCode !== 0) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_CANDIDATE_STALE",
      ".",
      "Current HEAD does not descend from the recorded candidate.",
    ));
  }
  const changed = await runGit(
    repository,
    ["diff", "--name-only", "-z", candidate, "HEAD"],
    execute,
  );
  if (changed.exitCode !== 0) {
    throw new Error("Git could not compare candidate and HEAD.");
  }
  const paths = changed.stdout.toString("utf8").split("\0").filter(Boolean);
  if (paths.some((relativePath) =>
    !relativePath.startsWith("evals/evidence/") &&
    !relativePath.startsWith("evals/results/"))
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_CANDIDATE_STALE",
      ".",
      "Only forward evidence and result reports may change after the candidate.",
    ));
  }
  const status = await runGit(
    repository,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    execute,
  );
  if (status.exitCode !== 0) {
    throw new Error("Git could not inspect worktree cleanliness.");
  }
  if (status.stdout.length > 0) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_GIT_DIRTY",
      ".",
      "Forward evidence validation requires a clean worktree.",
    ));
  }
  return findings;
}

function crossReferenceValid(value, context) {
  return (
    value.track === context.track &&
    value.candidate_commit === context.candidateCommit &&
    value.session_id === context.sessionId &&
    value.run_id === context.runId &&
    value.case_id === context.testCase.id &&
    value.input_sha256 === context.testCase.input_sha256
  );
}

async function validateCaseArtifacts({
  caseRoot,
  context,
  findings,
  state,
}) {
  const relativeCaseRoot =
    `evals/evidence/${context.track}/${context.testCase.id}`;
  let listing;
  try {
    listing = await exactDirectoryEntries(caseRoot, CASE_FILES);
  } catch {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_FILE_SET",
      relativeCaseRoot,
      "Each behavior case must be a regular directory with the exact artifact set.",
    ));
    state.fileSet = false;
    return;
  }
  if (
    !listing.exact ||
    listing.entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_FILE_SET",
      relativeCaseRoot,
      "Each behavior case must contain exactly agent-output.yaml and artifact-manifest.json.",
    ));
    state.fileSet = false;
  }
  let outputBytes;
  let manifestBytes;
  try {
    [outputBytes, manifestBytes] = await Promise.all([
      readRegularFile(path.join(caseRoot, "agent-output.yaml")),
      readRegularFile(path.join(caseRoot, "artifact-manifest.json")),
    ]);
  } catch {
    return;
  }
  for (const [name, bytes] of [
    ["agent-output.yaml", outputBytes],
    ["artifact-manifest.json", manifestBytes],
  ]) {
    if (scanBytes(`${relativeCaseRoot}/${name}`, bytes).length > 0) {
      findings.push(issue(
        "BLOCKER",
        "B_FORWARD_REDACTION",
        `${relativeCaseRoot}/${name}`,
        "Forward evidence contains unsafe public content.",
      ));
      state.safeScan = false;
    }
  }
  let output;
  let manifest;
  try {
    output = parseSafeYaml(
      decoder.decode(outputBytes),
      `${relativeCaseRoot}/agent-output.yaml`,
    );
    manifest = parseSafeJson(
      decoder.decode(manifestBytes),
      `${relativeCaseRoot}/artifact-manifest.json`,
    );
  } catch {
    findings.push(schemaFinding(
      relativeCaseRoot,
      "Case evidence YAML or JSON is malformed.",
    ));
    state.schema = false;
    return;
  }
  if (!validateOutputSchema(output) || !validateManifestSchema(manifest)) {
    findings.push(schemaFinding(
      relativeCaseRoot,
      "Case evidence does not match the closed machine schema.",
    ));
    state.schema = false;
    return;
  }
  if (
    !crossReferenceValid(output, context) ||
    !crossReferenceValid(manifest, context)
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_CROSS_REFERENCE",
      relativeCaseRoot,
      "Case evidence identities do not match the report and cases contract.",
    ));
    state.crossReferences = false;
  }
  if (manifest.files[0].sha256 !== sha256Bytes(outputBytes)) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_ARTIFACT_HASH",
      `${relativeCaseRoot}/artifact-manifest.json`,
      "Artifact manifest digest does not match agent-output.yaml bytes.",
    ));
    state.artifactHashes = false;
  }
  const expectedOutcome =
    context.track === "baseline" ? "observed" : "validated";
  if (output.outcome !== expectedOutcome) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_BEHAVIOR",
      `${relativeCaseRoot}/agent-output.yaml`,
      "Agent output outcome does not match its behavior track.",
    ));
    if (context.track === "baseline") state.baselineObserved = false;
    else state.withSkillFocus = false;
  }
  if (
    output.constraints.network_used !== false ||
    output.constraints.production_writes !== false
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_CONSTRAINTS",
      `${relativeCaseRoot}/agent-output.yaml`,
      "Forward evidence must declare no network use and no production writes.",
    ));
    if (output.constraints.network_used) state.noNetwork = false;
    if (output.constraints.production_writes) state.noProductionWrites = false;
  }
  const expectedFocus = context.testCase.expected_focus;
  const actualFocus = output.focus_results.map(({ requirement }) => requirement);
  if (
    actualFocus.length !== expectedFocus.length ||
    new Set(actualFocus).size !== actualFocus.length ||
    actualFocus.some((value, index) => value !== expectedFocus[index]) ||
    (
      context.track === "with-skill" &&
      output.focus_results.some(({ addressed }) => addressed !== true)
    )
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_BEHAVIOR",
      `${relativeCaseRoot}/agent-output.yaml`,
      "Structured output does not cover the configured expected_focus exactly.",
    ));
    if (context.track === "with-skill") state.withSkillFocus = false;
  }
}

async function validateTrackEvidence({
  repository,
  report,
  expectedCases,
  findings,
  state,
  execute,
}) {
  const trackRoot = await inspectEvidenceRoot(
    repository,
    report.evidence_root,
  );
  if (!trackRoot) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_EVIDENCE_ROOT",
      report.evidence_root,
      "Evidence root must exist as a non-symlinked repository-relative directory.",
    ));
    state.fileSet = false;
    return;
  }
  const expectedEntries = expectedCases.map(({ id }) => id);
  if (report.track === "with-skill") {
    expectedEntries.push("install-receipt.yaml");
  }
  const listing = await exactDirectoryEntries(trackRoot, expectedEntries);
  const expectedDirectories = new Set(expectedCases.map(({ id }) => id));
  if (
    !listing.exact ||
    listing.entries.some((entry) =>
      expectedDirectories.has(entry.name)
        ? !entry.isDirectory() || entry.isSymbolicLink()
        : !entry.isFile() || entry.isSymbolicLink())
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_FILE_SET",
      report.evidence_root,
      "Track evidence must contain exactly the configured case directories and required receipt.",
    ));
    state.fileSet = false;
  }
  for (const testCase of expectedCases) {
    await validateCaseArtifacts({
      caseRoot: path.join(trackRoot, testCase.id),
      context: {
        candidateCommit: report.candidate_commit,
        runId: report.run_id,
        sessionId: report.session_id,
        testCase,
        track: report.track,
      },
      findings,
      state,
    });
  }
  if (report.track !== "with-skill") return;
  const relativeReceipt = "evals/evidence/with-skill/install-receipt.yaml";
  let bytes;
  try {
    bytes = await readRegularFile(path.join(trackRoot, "install-receipt.yaml"));
  } catch {
    return;
  }
  if (scanBytes(relativeReceipt, bytes).length > 0) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_REDACTION",
      relativeReceipt,
      "Copy-install receipt summary contains unsafe public content.",
    ));
    state.safeScan = false;
  }
  let receipt;
  try {
    receipt = parseSafeYaml(decoder.decode(bytes), relativeReceipt);
  } catch {
    findings.push(schemaFinding(
      relativeReceipt,
      "Copy-install receipt summary is malformed.",
    ));
    state.schema = false;
    return;
  }
  if (!validateReceiptSchema(receipt)) {
    findings.push(schemaFinding(
      relativeReceipt,
      "Copy-install receipt does not match the closed redacted schema.",
    ));
    state.schema = false;
    return;
  }
  let expectedTreeHash;
  try {
    expectedTreeHash = await candidateSkillTreeHash(
      repository,
      report.candidate_commit,
      execute,
    );
  } catch {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_INSTALL_RECEIPT",
      relativeReceipt,
      "Candidate Skill distribution snapshot could not be verified from Git objects.",
    ));
    state.crossReferences = false;
    return;
  }
  if (
    receipt.source_commit !== report.candidate_commit ||
    receipt.source_tree_hash !== expectedTreeHash
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_INSTALL_RECEIPT",
      relativeReceipt,
      "Copy-install receipt does not match the candidate Skill distribution snapshot.",
      {
        expected_tree_hash: expectedTreeHash,
        receipt_tree_hash: receipt.source_tree_hash,
      },
    ));
    state.crossReferences = false;
  }
}

export async function validateForwardTest(directory, options = {}) {
  const repository = path.resolve(options.repositoryRoot ?? ROOT);
  const expectedResults = path.join(repository, "evals/results");
  const [repositoryMetadata, resultsMetadata] = await Promise.all([
    lstat(repository),
    lstat(directory),
  ]);
  if (
    !repositoryMetadata.isDirectory() ||
    repositoryMetadata.isSymbolicLink() ||
    !resultsMetadata.isDirectory() ||
    resultsMetadata.isSymbolicLink() ||
    path.resolve(directory) !== expectedResults
  ) {
    throw new Error("Results path is not the repository evals/results directory.");
  }
  const resolvedRepository = await realpath(repository);
  const resolvedResults = await realpath(directory);
  if (!inside(resolvedRepository, resolvedResults)) {
    throw new Error("Results path escaped the repository.");
  }

  const findings = [];
  const state = {
    artifactHashes: true,
    baselineObserved: true,
    crossReferences: true,
    fileSet: true,
    noNetwork: true,
    noProductionWrites: true,
    safeScan: true,
    schema: true,
    withSkillFocus: true,
  };
  const resultsListing = await exactDirectoryEntries(
    directory,
    [...TRACK_FILES.values()],
  );
  if (
    !resultsListing.exact ||
    resultsListing.entries.some((entry) =>
      !entry.isFile() || entry.isSymbolicLink())
  ) {
    findings.push(issue(
      "BLOCKER",
      "B_FORWARD_FILE_SET",
      "evals/results",
      "Results directory must contain exactly the two versioned report files.",
    ));
    state.fileSet = false;
  }

  const casesPath =
    options.casesPath ?? path.join(repository, "evals/forward-test-cases.yaml");
  const casesBytes = await readRegularFile(casesPath);
  const casesSha256 = sha256Bytes(casesBytes);
  const expectedCases = validateCasesDocument(parseSafeYaml(
    decoder.decode(casesBytes),
    "evals/forward-test-cases.yaml",
  ));
  const reports = [];
  for (const [track, filename] of TRACK_FILES) {
    const relativePath = `evals/results/${filename}`;
    let bytes;
    try {
      bytes = await readRegularFile(path.join(directory, filename));
    } catch {
      continue;
    }
    if (scanBytes(relativePath, bytes).length > 0) {
      findings.push(issue(
        "BLOCKER",
        "B_FORWARD_REDACTION",
        relativePath,
        "Forward report contains unsafe public content.",
      ));
      state.safeScan = false;
    }
    let report;
    try {
      report = parseFrontmatter(decoder.decode(bytes), relativePath);
    } catch {
      findings.push(schemaFinding(
        relativePath,
        "Report frontmatter is missing or malformed.",
      ));
      state.schema = false;
      continue;
    }
    if (!validateReportSchema(report, track, expectedCases)) {
      findings.push(schemaFinding(
        relativePath,
        "Report does not match the closed schema version 2.",
      ));
      state.schema = false;
      continue;
    }
    if (report.cases_sha256 !== casesSha256) {
      findings.push(issue(
        "BLOCKER",
        "B_FORWARD_CASES_HASH",
        relativePath,
        "Report cases_sha256 does not match the cases file bytes.",
      ));
    }
    reports.push(report);
  }

  if (reports.length === TRACKS.length) {
    if (
      new Set(reports.map(({ candidate_commit: value }) => value)).size !== 1
    ) {
      findings.push(issue(
        "BLOCKER",
        "B_FORWARD_CANDIDATE",
        "evals/results",
        "Both tracks must bind the same candidate commit.",
      ));
      state.crossReferences = false;
    }
    if (
      new Set(reports.map(({ session_id: value }) => value)).size !==
        reports.length ||
      new Set(reports.map(({ run_id: value }) => value)).size !== reports.length
    ) {
      findings.push(issue(
        "BLOCKER",
        "B_FORWARD_SESSION_COLLISION",
        "evals/results",
        "Baseline and with-skill require distinct session and run identifiers.",
      ));
      state.crossReferences = false;
    }

    const evidenceParent = await inspectEvidenceRoot(
      repository,
      "evals/evidence",
    );
    if (!evidenceParent) {
      findings.push(issue(
        "BLOCKER",
        "B_FORWARD_EVIDENCE_ROOT",
        "evals/evidence",
        "Evidence root must exist as a non-symlinked repository-relative directory.",
      ));
      state.fileSet = false;
    } else {
      const evidenceListing = await exactDirectoryEntries(
        evidenceParent,
        TRACKS,
      );
      if (
        !evidenceListing.exact ||
        evidenceListing.entries.some((entry) =>
          !entry.isDirectory() || entry.isSymbolicLink())
      ) {
        findings.push(issue(
          "BLOCKER",
          "B_FORWARD_FILE_SET",
          "evals/evidence",
          "Evidence root must contain exactly baseline and with-skill directories.",
        ));
        state.fileSet = false;
      }
    }
    for (const report of reports) {
      await validateTrackEvidence({
        repository,
        report,
        expectedCases,
        findings,
        state,
        execute: options.spawnCommand ?? spawnCommand,
      });
    }
    findings.push(...await validateGitState(
      repository,
      reports[0].candidate_commit,
      options.spawnCommand ?? spawnCommand,
    ));
  }

  const evidenceIndexed = reports.length === TRACKS.length;
  return commandResult(findings, {
    artifact_hashes_verified: evidenceIndexed && state.artifactHashes,
    baseline_observed: evidenceIndexed && state.baselineObserved,
    case_count: expectedCases.length,
    cases_file_verified:
      !findings.some(({ code }) => code === "B_FORWARD_CASES_HASH"),
    execution_provenance_verified: false,
    isolation_enforced_by_validator: false,
    network_declared_unused: evidenceIndexed && state.noNetwork,
    production_writes_declared_none:
      evidenceIndexed && state.noProductionWrites,
    prose_hashed: false,
    tracks: reports.map(({ track }) => track),
    with_skill_focus_covered: evidenceIndexed && state.withSkillFocus,
  });
}

export async function main(args, options = {}) {
  const writeStdout =
    options.writeStdout ?? ((value) => process.stdout.write(value));
  const parsed = parseArguments(args, options.cwd ?? process.cwd());
  let result;
  try {
    if (parsed.help) {
      result = commandResult([], { usage: USAGE });
    } else if (parsed.error) {
      result = parsed.error;
    } else {
      result = await validateForwardTest(parsed.directory, options);
    }
  } catch (error) {
    result = withExit(3, [
      issue(
        "BLOCKER",
        "B_FORWARD_RUNTIME",
        ".",
        "Forward-test validation failed unexpectedly.",
        { error: error instanceof Error ? error.message : String(error) },
      ),
    ]);
  }
  writeStdout(`${JSON.stringify(result)}\n`);
  return result.exitCode;
}

if (
  process.env.AIWORKER_BUNDLED_RUNTIME !== "1" &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  process.exitCode = await main(process.argv.slice(2));
}

export { USAGE };
