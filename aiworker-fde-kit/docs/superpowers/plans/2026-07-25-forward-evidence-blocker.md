# Forward Evidence Blocker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:test-driven-development while implementing this plan. Keep real Agent evidence out of the candidate commit.

**Goal:** Make forward evidence a repository-bound, machine-recomputed release blocker without calling a model, hashing prose, or retaining raw conversations.

**Architecture:** Keep the two Markdown reports as closed-schema indexes. Resolve their repository-relative evidence roots into an exact two-track/six-case tree, then validate closed YAML/JSON artifacts, recompute byte hashes and case bindings, scan every retained artifact, and prove the candidate/current Git relationship. Deterministic offline-package correctness remains owned by Golden and E2E tests.

**Tech Stack:** Node.js 20 ESM, Vitest, YAML, Git subprocesses, bundled esbuild runtime.

---

## Chunk 1: Contract and validator

### Task 1: Specify failing evidence-boundary tests

**Files:**
- Modify: `test/integration/forward-test-report.test.js`

- [ ] Replace report-only fixtures with a temporary Git repository containing a candidate commit and a later evidence-only commit.
- [ ] Add RED coverage for a missing or symlinked evidence root, exact tracks/cases/files, artifact tampering, forged self-reported validator fields, stale product diffs, dirty worktrees, candidate mismatch, receipt mismatch, and unsafe artifact content.
- [ ] Run `npm test -- --run test/integration/forward-test-report.test.js` and confirm the new assertions fail for missing behavior.

### Task 2: Implement the minimal machine validator

**Files:**
- Modify: `src/commands/validate-forward-test.js`

- [ ] Require closed report, agent-output, artifact-manifest, and install-receipt shapes.
- [ ] Resolve only non-symlinked repository-relative evidence trees with the exact expected tracks, cases, and files.
- [ ] Recompute the cases-file hash, every input hash, and every retained artifact hash.
- [ ] Cross-check track, case, candidate, session, run, and input identities throughout the tree.
- [ ] Derive baseline observation, with-skill expected-focus coverage, and no-network/no-production-write results from artifacts rather than report claims.
- [ ] Verify the candidate commit exists; require a clean worktree and permit only `evals/evidence/**` and `evals/results/**` changes from candidate to current HEAD.
- [ ] Run the target test to GREEN and refactor only while it remains green.

## Chunk 2: Operator contract and release verification

### Task 3: Document exact evidence production

**Files:**
- Modify: `docs/agent-forward-test.md`
- Modify: `evals/forward-test-cases.yaml`
- Delete: `evals/results/v0.1.0-baseline.md`
- Delete: `evals/results/v0.1.0-with-skill.md`

- [ ] Document the exact report and artifact schemas and the candidate/evidence commit sequence.
- [ ] Require a redacted copy-install receipt summary and prohibit absolute paths/raw conversations.
- [ ] State explicitly that behavior evidence does not prove the deterministic offline package; Golden and E2E do.
- [ ] Remove stale report-only evidence so the real forward command remains blocked until fresh Agents generate artifacts.

### Task 4: Rebuild and verify

**Files:**
- Modify: `scripts/runtime/aiworker-fde-runtime.mjs`
- Modify: `scripts/runtime/bundle-manifest.json`

- [ ] Run `npm run build:runtime`.
- [ ] Run the target test, full suite, public scan, Golden example, and E2E.
- [ ] Run `./scripts/validate-forward-test evals/results` and confirm it fails because fresh evidence is intentionally absent.
- [ ] Inspect the scoped diff, explicitly stage only forward files, and create the candidate commit.
