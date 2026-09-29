# Package Quality Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining semantic scanning and filesystem transaction gaps in offline packaging and validation.

**Architecture:** Keep parsing, selection, and snapshot logic in reusable modules rather than adding command-specific exceptions. Treat all filesystem publication and cleanup as identity-bound claims, and keep package report reuse derived entirely from current validated state.

**Tech Stack:** Node.js ESM, Vitest, safe JSON/YAML parsers, POSIX filesystem primitives, SHA-256.

---

## Chunk 1: Scanner and report correctness

### Task 1: Semantic structured-data scanning

**Files:**
- Modify: `src/delivery/sensitive-scan.js`
- Test: `test/unit/delivery/sensitive-scan.test.js`

- [x] Add failing nested JSON/YAML tests for secret, token, API key, password, cookie, profile, host, and endpoint keys.
- [x] Add semantic recursive traversal with normalized exact keys and scalar values.
- [x] Preserve immutable BLOCKER classifications and verify focused tests.

### Task 2: Fail-closed source media policy

**Files:**
- Create: `src/delivery/source-scan-policy.js`
- Modify: `src/commands/package-delivery.js`
- Test: `test/integration/package-delivery.test.js`

- [x] Add failing DOCX/PDF/image/archive source tests.
- [x] Permit only explicit UTF-8 text extensions/media with fatal decoding and no NUL.
- [x] Emit `B_SOURCE_UNSCANNABLE` before staging and verify source tests.

### Task 3: Exact report reuse

**Files:**
- Modify: `src/commands/package-delivery.js`
- Test: `test/integration/package-delivery.test.js`

- [x] Add failing tests for tampered redactions/results/issues under the same three-key identity.
- [x] Build the current expected fixed report first and reuse old bytes only when all fields except `validated_at` are deeply exact.
- [x] Verify valid reports preserve the first `validated_at`.

## Chunk 2: Transaction integrity

### Task 4: Identity-bound temporary publication

**Files:**
- Modify: `src/commands/package-delivery.js`
- Test: `test/integration/package-delivery.test.js`

- [x] Add a replacement-at-publish test for a prepared temporary output.
- [x] Record temporary dev/ino/mode/hash/bytes, atomically claim to a private unique path, and reverify before linking.
- [x] Fail closed and retain explicit recovery paths on mismatch.

### Task 5: Complete validation input snapshot

**Files:**
- Modify: `src/contracts/project-validator.js`
- Modify: `src/project/validation-report.js`
- Modify: `src/commands/validate-project.js`
- Test: `test/integration/validate-project.test.js`

- [x] Add late edits for every package-input category at publication and final-commit boundaries.
- [x] Persist the complete authoritative path set plus identity, ancestors, bytes, and hashes.
- [x] Reverify immediately before each output commit and abort without publishing on drift.

### Task 6: Post-commit backup cleanup

**Files:**
- Modify: `src/commands/package-delivery.js`
- Modify: `src/project/validation-report.js`
- Test: `test/integration/package-delivery.test.js`
- Test: `test/integration/validate-project.test.js`

- [x] Add backup-cleanup failure tests after successful publication.
- [x] Separate commit success from cleanup warnings; never roll back through a deleted backup.
- [x] Identity-bind or quarantine every backup lifecycle action and return recovery paths.

### Task 7: Identity-bound staging cleanup

**Files:**
- Modify: `src/commands/package-delivery.js`
- Test: `test/integration/package-delivery.test.js`

- [x] Add a foreign staging replacement test.
- [x] Atomically rename owned staging to a unique quarantine path, verify root identity and complete inventory, then remove only the claimed tree.
- [x] Preserve/report foreign replacements and verify normal owned cleanup.

## Chunk 3: Verification

- [x] Run focused scanner, package, and validation tests.
- [x] Run `npm run verify`.
- [x] Run `SOURCE_DATE_EPOCH=1784854800 npm test -- --run test/integration/package-delivery.test.js test/integration/test-example.test.js`.
- [x] Run the manual example command documented by the repository.
- [x] Run `git diff --check`, request independent review, fix Important findings, and commit once.
