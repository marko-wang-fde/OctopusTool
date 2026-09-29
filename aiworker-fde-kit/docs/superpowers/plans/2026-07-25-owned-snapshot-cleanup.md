# Owned Project Snapshot Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove normal owned project execution snapshots without leaving payload bytes in temporary storage, while stopping safely and reporting recovery paths on every ownership mismatch.

**Architecture:** Extend the creation inventory with type, mode, content hash, and inode identity for every owned file and directory. After atomically claiming the private `0700` owner container, clean bottom-up using only inventory paths: revalidate the quarantine root, every ancestor, and the leaf identity around each bounded syscall; bind files with `O_NOFOLLOW`, truncate through the verified handle, conditionally unlink, then remove verified empty directories with `rmdir`. Never use recursive removal after the snapshot has been exposed to the CLI.

**Tech Stack:** Node.js ESM, `node:fs/promises`, file handles with `O_NOFOLLOW`, Vitest.

---

### Task 1: Prove normal cleanup leaves no snapshot or payload residue

**Files:**
- Modify: `test/unit/assembly/dryrun-runner.test.js`

- [x] Scan `os.tmpdir()` for `fde-project-exec-` entries before a successful run.
- [x] Run a snapshot with a unique sensitive payload marker.
- [x] Scan again and assert no new live/cleanup directory exists and no new file contains the marker.
- [x] Run the focused test and confirm the currently preserved quarantine fails.

### Task 2: Prove mismatch cleanup stops and reports recovery

**Files:**
- Modify: `test/unit/assembly/dryrun-runner.test.js`
- Modify: `test/integration/validate-project-cli.test.js`

- [x] Inject a leaf replacement at the conditional unlink boundary.
- [x] Assert the replacement remains, cleanup stops, and `recoveryPaths` identifies the quarantine.
- [x] Inject a runner cleanup error into `validate-project` and assert the warning/details/data retain recovery paths.
- [x] Run focused tests and confirm current behavior does not meet the propagation contract.

### Task 3: Implement inventory-bound bottom-up cleanup

**Files:**
- Modify: `src/assembly/dryrun-runner.js`
- Modify: `src/commands/validate-project.js`

- [x] Record `dev`, `ino`, `type`, `mode`, and content hash for every file/directory at creation.
- [x] After the atomic quarantine claim, verify root and the complete inventory.
- [x] Sort files deepest-first, verify root/ancestors/leaf, open with `O_NOFOLLOW`, reverify the handle and path identity, truncate and sync, reverify, then conditionally unlink.
- [x] Sort directories deepest-first, verify root/ancestors/directory before and after a last cooperative `rmdir`.
- [x] Remove the empty verified quarantine root with the same last-syscall boundary and document why no recursive removal is used.
- [x] On any mismatch, stop immediately and attach the remaining quarantine to `recoveryPaths`.
- [x] Include recovery paths in the `validate-project` preflight warning details and result data.

### Task 4: Verify and publish

**Files:**
- Review all files above and this plan.

- [x] Run the focused runner and validate-project CLI suites.
- [x] Run `npm run verify`.
- [x] Run `git diff --check`, repository lint, and inspect status/diff.
- [x] Commit as one independent fix and report the SHA.
