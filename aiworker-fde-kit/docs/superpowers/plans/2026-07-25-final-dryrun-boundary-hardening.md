# Final Dry-run Boundary Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the final three dry-run validation boundaries so malformed plans remain domain errors, caller-supplied artifact paths cannot escape the private snapshot, and snapshot cleanup never mutates or deletes foreign replacements.

**Architecture:** Split assembly document parsing from payload loading so the official schema gates every operation dereference. Introduce one strict shared relative-path predicate and apply it before artifact allowlisting and before resolving snapshot targets. Replace path-first recursive snapshot cleanup with an atomic quarantine claim, root and owned-inventory identity verification, and safe preservation when ownership cannot be proven.

**Tech Stack:** Node.js ESM, `node:fs/promises`, Vitest, YAML/Ajv project contracts.

---

### Task 1: Gate payload reads behind assembly schema validation

**Files:**
- Modify: `src/commands/render-dryrun-script.js`
- Test: `test/integration/render-dryrun-script.test.js`

- [x] Add a CLI regression test with `operations: [null]` that expects exit 1 and `B_ASSEMBLY_SCHEMA`, never runtime exit 3.
- [x] Run only that test and confirm the existing dereference produces exit 3.
- [x] Split project assembly document reads from payload reads; validate the official assembly schema before iterating operations.
- [x] Run the render integration tests and confirm the regression passes.

### Task 2: Enforce strict artifact relative paths

**Files:**
- Create: `src/shared/safe-relative-path.js`
- Modify: `src/assembly/dryrun-runner.js`
- Test: `test/unit/assembly/dryrun-runner.test.js`

- [x] Add table-driven tests rejecting absolute, dot, dot-dot, empty-segment, backslash, control/NUL, drive-prefix, and percent-encoded escape paths.
- [x] Add an escape-path test that asserts a marker outside the snapshot is never written and the CLI is never executed.
- [x] Run the focused tests and confirm current prefix-only filtering fails.
- [x] Implement the shared strict relative-path validator.
- [x] Validate every supplied map key before artifact allowlisting, resolve each selected target with `path.resolve`, assert containment, and create/verify each ancestor without following symlinks.
- [x] Run the focused runner tests and confirm all path cases pass.

### Task 3: Claim project snapshots before cleanup

**Files:**
- Modify: `src/assembly/dryrun-runner.js`
- Test: `test/unit/assembly/dryrun-runner.test.js`

- [x] Add deterministic cleanup-race tests that replace the live snapshot with a symlink and with a directory between the cleanup observation and claim.
- [x] Assert the foreign target or directory is restored/preserved, receives no chmod/delete mutation, and recovery paths are reported.
- [x] Run the focused tests and confirm the current pre-claim chmod behavior fails.
- [x] Record an owned inventory of created directories/files and their identities.
- [x] Atomically rename the live snapshot to a unique quarantine before any chmod or traversal, then verify root identity and owned inventory using `lstat`/no-follow reads.
- [x] On ownership mismatch, restore the foreign entry if the live name is free or preserve it in quarantine and report recovery paths.
- [x] Preserve verified owned quarantine instead of recursively deleting through mutable paths.
- [x] Run all dry-run tests and confirm both replacement cases pass.

### Task 4: Verify and publish the isolated fix

**Files:**
- Review all files above plus this plan.

- [x] Run the targeted render and runner suites.
- [x] Run `npm run verify` and confirm all tests and `lint:repo` pass.
- [x] Run `git diff --check` and review the final diff/status.
- [x] Commit the changes as one independent quality-fix commit and report its SHA.
