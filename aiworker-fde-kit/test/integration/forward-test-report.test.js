import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";

import { main } from "../../src/commands/validate-forward-test.js";
import { snapshotSkillTree } from "../../src/install/file-snapshot.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SOURCE_CASES = path.join(ROOT, "evals/forward-test-cases.yaml");
const execFileAsync = promisify(execFile);
let temporaryRoot;
const fixtureText = (...parts) => parts.join("");

beforeEach(async () => {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fde-forward-evidence-"));
});

afterEach(async () => {
  await rm(temporaryRoot, { recursive: true, force: true });
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function git(repository, ...args) {
  return (await execFileAsync("git", args, { cwd: repository })).stdout.trim();
}

async function commitAll(repository, message) {
  await git(repository, "add", "-A");
  await git(repository, "commit", "--quiet", "-m", message);
}

async function writeYaml(filePath, value) {
  await writeFile(filePath, stringify(value, { lineWidth: 0 }));
}

async function writeReport(filePath, report) {
  await writeFile(
    filePath,
    `---\n${stringify(report, { lineWidth: 0 })}---\n\n` +
      "# Redacted behavior summary\n\nNarrative prose is not hashed.\n",
  );
}

async function readReport(filePath) {
  const text = await readFile(filePath, "utf8");
  return parse(text.slice(4, text.indexOf("\n---\n", 4)));
}

async function initializeRepository() {
  const repository = path.join(temporaryRoot, "repository");
  await mkdir(path.join(repository, "evals/results"), { recursive: true });
  await mkdir(path.join(repository, "agents"), { recursive: true });
  await mkdir(path.join(repository, "scripts"), { recursive: true });
  await cp(SOURCE_CASES, path.join(repository, "evals/forward-test-cases.yaml"));
  await writeFile(path.join(repository, "LICENSE"), "fixture license\n");
  await writeFile(path.join(repository, "SKILL.md"), "# Fixture Skill\n");
  await writeFile(
    path.join(repository, "agents/openai.yaml"),
    "name: fixture-agent\n",
  );
  await writeFile(
    path.join(repository, "scripts/fixture-command"),
    "#!/bin/sh\nexit 0\n",
  );
  await chmod(path.join(repository, "scripts/fixture-command"), 0o755);
  await writeFile(path.join(repository, "product.txt"), "candidate product\n");
  await git(repository, "init", "--quiet");
  await git(repository, "config", "user.name", "Forward Evidence Test");
  await git(
    repository,
    "config",
    "user.email",
    ["forward-test", "@", "example.invalid"].join(""),
  );
  await commitAll(repository, "candidate");
  const candidateCommit = await git(repository, "rev-parse", "HEAD");
  const candidateTreeHash =
    (await snapshotSkillTree(repository)).source_tree_hash;
  return {
    candidateCommit,
    candidateTreeHash,
    casesPath: path.join(repository, "evals/forward-test-cases.yaml"),
    repository,
    results: path.join(repository, "evals/results"),
  };
}

async function addEvidence(fixture) {
  const casesBytes = await readFile(fixture.casesPath);
  const casesDocument = parse(casesBytes.toString("utf8"));
  const casesSha256 = sha256(casesBytes);
  for (const track of ["baseline", "with-skill"]) {
    const sessionId = `session-${track}`;
    const runId = `run-${track}`;
    const evidenceRoot = `evals/evidence/${track}`;
    const reportCases = [];
    for (const testCase of casesDocument.cases) {
      const caseRoot = path.join(
        fixture.repository,
        evidenceRoot,
        testCase.id,
      );
      await mkdir(caseRoot, { recursive: true });
      const output = {
        schema_version: 1,
        track,
        case_id: testCase.id,
        candidate_commit: fixture.candidateCommit,
        session_id: sessionId,
        run_id: runId,
        input_sha256: testCase.input_sha256,
        outcome: track === "baseline" ? "observed" : "validated",
        constraints: {
          network_used: false,
          production_writes: false,
        },
        focus_results: testCase.expected_focus.map((requirement) => ({
          requirement,
          addressed: track === "with-skill",
        })),
        observation_codes: track === "baseline"
          ? ["CONTROL_ONLY"]
          : [],
      };
      const outputPath = path.join(caseRoot, "agent-output.yaml");
      await writeYaml(outputPath, output);
      await writeFile(
        path.join(caseRoot, "artifact-manifest.json"),
        `${JSON.stringify({
          schema_version: 1,
          track,
          case_id: testCase.id,
          candidate_commit: fixture.candidateCommit,
          session_id: sessionId,
          run_id: runId,
          input_sha256: testCase.input_sha256,
          files: [{
            path: "agent-output.yaml",
            sha256: sha256(await readFile(outputPath)),
          }],
        }, null, 2)}\n`,
      );
      reportCases.push({
        id: testCase.id,
        input_sha256: testCase.input_sha256,
        evidence_path: `${evidenceRoot}/${testCase.id}`,
        outcome: track === "baseline" ? "observed" : "validated",
      });
    }
    const installReceipt = track === "with-skill"
      ? `${evidenceRoot}/install-receipt.yaml`
      : null;
    if (installReceipt) {
      await writeYaml(path.join(fixture.repository, installReceipt), {
        schema_version: 1,
        mode: "copy",
        target: "codex",
        source_commit: fixture.candidateCommit,
        source_dirty: false,
        source_tree_hash: fixture.candidateTreeHash,
      });
    }
    await writeReport(
      path.join(fixture.results, `v0.1.0-${track}.md`),
      {
        schema_version: 2,
        track,
        candidate_commit: fixture.candidateCommit,
        candidate_dirty: false,
        cases_sha256: casesSha256,
        agent: "isolated-agent",
        model: "test-model",
        session_id: sessionId,
        run_id: runId,
        executed_at: "2026-07-25T01:02:03.000Z",
        evidence_root: evidenceRoot,
        install_receipt: installReceipt,
        network_used: false,
        production_writes: false,
        cases: reportCases,
      },
    );
  }
  await commitAll(fixture.repository, "forward evidence");
}

async function prepareValidRepository() {
  const fixture = await initializeRepository();
  await addEvidence(fixture);
  return fixture;
}

async function invoke(fixture, args = [fixture.results]) {
  const chunks = [];
  const exitCode = await main(args, {
    casesPath: fixture.casesPath,
    repositoryRoot: fixture.repository,
    writeStdout: (chunk) => chunks.push(chunk),
  });
  expect(chunks).toHaveLength(1);
  return { exitCode, result: JSON.parse(chunks[0]) };
}

async function mutateYaml(filePath, mutate) {
  const document = parse(await readFile(filePath, "utf8"));
  await writeYaml(filePath, mutate(document));
}

async function refreshManifest(caseRoot) {
  const manifestPath = path.join(caseRoot, "artifact-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files[0].sha256 = sha256(
    await readFile(path.join(caseRoot, "agent-output.yaml")),
  );
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

describe("forward-test machine evidence validator", () => {
  it("does not claim derived evidence checks when reports are absent", async () => {
    const fixture = await initializeRepository();
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.data).toMatchObject({
      artifact_hashes_verified: false,
      baseline_observed: false,
      network_declared_unused: false,
      production_writes_declared_none: false,
      execution_provenance_verified: false,
      isolation_enforced_by_validator: false,
      with_skill_focus_covered: false,
    });
    expect(response.result.data).not.toHaveProperty("no_network_verified");
    expect(response.result.data)
      .not.toHaveProperty("no_production_writes_verified");
  });

  it("accepts recomputed evidence from an evidence-only commit", async () => {
    const fixture = await prepareValidRepository();
    const response = await invoke(fixture);
    expect(response.exitCode, JSON.stringify(response.result)).toBe(0);
    expect(response.result.data).toMatchObject({
      case_count: 6,
      tracks: ["baseline", "with-skill"],
      cases_file_verified: true,
      artifact_hashes_verified: true,
      baseline_observed: true,
      with_skill_focus_covered: true,
      network_declared_unused: true,
      production_writes_declared_none: true,
      execution_provenance_verified: false,
      isolation_enforced_by_validator: false,
      prose_hashed: false,
    });
    expect(response.result.data).not.toHaveProperty("no_network_verified");
    expect(response.result.data)
      .not.toHaveProperty("no_production_writes_verified");
  });

  it("does not hash Markdown narrative prose", async () => {
    const fixture = await prepareValidRepository();
    const reportPath = path.join(fixture.results, "v0.1.0-baseline.md");
    await writeFile(
      reportPath,
      (await readFile(reportPath, "utf8"))
        .replace("Narrative prose is not hashed.", "Narrative may be revised."),
    );
    await commitAll(fixture.repository, "revise narrative");
    expect((await invoke(fixture)).exitCode).toBe(0);
  });

  it("blocks when the declared evidence root does not exist", async () => {
    const fixture = await prepareValidRepository();
    await rm(path.join(fixture.repository, "evals/evidence"), {
      recursive: true,
    });
    await commitAll(fixture.repository, "remove evidence");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_EVIDENCE_ROOT" }),
    ]));
  });

  it("blocks a symlinked evidence root", async () => {
    const fixture = await prepareValidRepository();
    const evidence = path.join(fixture.repository, "evals/evidence");
    const outside = path.join(temporaryRoot, "outside-evidence");
    await cp(evidence, outside, { recursive: true });
    await rm(evidence, { recursive: true });
    await symlink(outside, evidence);
    expect((await lstat(evidence)).isSymbolicLink()).toBe(true);
    await commitAll(fixture.repository, "replace evidence with symlink");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_EVIDENCE_ROOT" }),
    ]));
  });

  it("blocks artifact tampering even when the report claims validation", async () => {
    const fixture = await prepareValidRepository();
    const outputPath = path.join(
      fixture.repository,
      "evals/evidence/with-skill/cli-missing/agent-output.yaml",
    );
    await writeFile(outputPath, `${await readFile(outputPath, "utf8")}# tampered\n`);
    await commitAll(fixture.repository, "tamper output");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_ARTIFACT_HASH" }),
    ]));
  });

  it("rejects self-reported validator exits and invariants as unknown fields", async () => {
    const fixture = await prepareValidRepository();
    const reportPath = path.join(fixture.results, "v0.1.0-with-skill.md");
    const report = await readReport(reportPath);
    report.cases[0].validator_exit = 0;
    report.cases[0].invariants = [
      "safe-scan",
      "file-set",
      "schema",
      "cross-reference",
      "behavior-case",
    ];
    await writeReport(reportPath, report);
    await commitAll(fixture.repository, "forge self-report");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_SCHEMA" }),
    ]));
  });

  it("blocks a product change after the candidate commit", async () => {
    const fixture = await prepareValidRepository();
    await writeFile(path.join(fixture.repository, "product.txt"), "changed\n");
    await commitAll(fixture.repository, "stale product change");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_CANDIDATE_STALE" }),
    ]));
  });

  it("blocks a dirty worktree", async () => {
    const fixture = await prepareValidRepository();
    await writeFile(
      path.join(
        fixture.repository,
        "evals/evidence/baseline/cli-missing/agent-output.yaml",
      ),
      "dirty\n",
    );
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_GIT_DIRTY" }),
    ]));
  });

  it("blocks a candidate commit mismatch", async () => {
    const fixture = await prepareValidRepository();
    const reportPath = path.join(fixture.results, "v0.1.0-baseline.md");
    const report = await readReport(reportPath);
    report.candidate_commit = "a".repeat(40);
    await writeReport(reportPath, report);
    await commitAll(fixture.repository, "mismatch candidate");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_CANDIDATE" }),
    ]));
  });

  it("blocks a copy-install receipt that does not bind the candidate", async () => {
    const fixture = await prepareValidRepository();
    await mutateYaml(
      path.join(
        fixture.repository,
        "evals/evidence/with-skill/install-receipt.yaml",
      ),
      (receipt) => ({ ...receipt, source_commit: "a".repeat(40) }),
    );
    await commitAll(fixture.repository, "mismatch receipt");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_INSTALL_RECEIPT" }),
    ]));
  });

  it("blocks a format-valid receipt tree hash that does not match the candidate snapshot", async () => {
    const fixture = await prepareValidRepository();
    await mutateYaml(
      path.join(
        fixture.repository,
        "evals/evidence/with-skill/install-receipt.yaml",
      ),
      (receipt) => ({
        ...receipt,
        source_tree_hash:
          receipt.source_tree_hash === "0".repeat(64)
            ? "1".repeat(64)
            : "0".repeat(64),
      }),
    );
    await commitAll(fixture.repository, "mismatch candidate tree");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_INSTALL_RECEIPT" }),
    ]));
  });

  it("scans every evidence artifact for unsafe public content", async () => {
    const fixture = await prepareValidRepository();
    const caseRoot = path.join(
      fixture.repository,
      "evals/evidence/with-skill/cli-missing",
    );
    await mutateYaml(
      path.join(caseRoot, "agent-output.yaml"),
      (output) => ({
        ...output,
        focus_results: output.focus_results.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                requirement:
                  fixtureText("Authorization: Bearer ", "unsafe-value-123"),
              }
            : entry),
      }),
    );
    await refreshManifest(caseRoot);
    await commitAll(fixture.repository, "unsafe evidence");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_REDACTION" }),
    ]));
  });

  it("derives expected-focus coverage from structured with-skill output", async () => {
    const fixture = await prepareValidRepository();
    const caseRoot = path.join(
      fixture.repository,
      "evals/evidence/with-skill/cli-missing",
    );
    await mutateYaml(
      path.join(caseRoot, "agent-output.yaml"),
      (output) => ({
        ...output,
        focus_results: output.focus_results.map((entry, index) =>
          index === 0 ? { ...entry, addressed: false } : entry),
      }),
    );
    await refreshManifest(caseRoot);
    await commitAll(fixture.repository, "miss expected focus");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_BEHAVIOR" }),
    ]));
  });

  it("rejects production-write declarations in retained artifacts", async () => {
    const fixture = await prepareValidRepository();
    const caseRoot = path.join(
      fixture.repository,
      "evals/evidence/with-skill/target-team-missing",
    );
    await mutateYaml(
      path.join(caseRoot, "agent-output.yaml"),
      (output) => ({
        ...output,
        constraints: {
          ...output.constraints,
          production_writes: true,
        },
      }),
    );
    await refreshManifest(caseRoot);
    await commitAll(fixture.repository, "claim production write");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_CONSTRAINTS" }),
    ]));
  });

  it("requires the exact evidence file set", async () => {
    const fixture = await prepareValidRepository();
    await writeFile(
      path.join(
        fixture.repository,
        "evals/evidence/baseline/cli-missing/extra.txt",
      ),
      "extra\n",
    );
    await commitAll(fixture.repository, "extra evidence");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_FILE_SET" }),
    ]));
  });

  it("recomputes the cases-file hash recorded by each report", async () => {
    const fixture = await prepareValidRepository();
    const reportPath = path.join(fixture.results, "v0.1.0-baseline.md");
    const report = await readReport(reportPath);
    report.cases_sha256 = "0".repeat(64);
    await writeReport(reportPath, report);
    await commitAll(fixture.repository, "stale cases hash");
    const response = await invoke(fixture);
    expect(response.exitCode).toBe(1);
    expect(response.result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "B_FORWARD_CASES_HASH" }),
    ]));
  });

  it("uses exit 2 for invocation and exit 3 for runtime failures", async () => {
    const fixture = await initializeRepository();
    expect((await invoke(fixture, [])).exitCode).toBe(2);
    expect((await invoke(fixture, [fixture.results, "--unknown"])).exitCode)
      .toBe(2);
    const help = await invoke(fixture, ["--help"]);
    expect(help.exitCode).toBe(0);
    expect(help.result.data.usage).toBe(
      "Usage: validate-forward-test <results-directory>",
    );
    expect(
      (await invoke(fixture, [path.join(fixture.repository, "missing")]))
        .exitCode,
    ).toBe(3);
  });
});
