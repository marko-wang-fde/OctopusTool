# Baseline Revision Diff Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add baseline-aware planning so `octoplanner` can load an existing plan, apply structured revision/rules, generate a new plan, output a stable diff, and render reports for both plans and diffs.

**Architecture:** Keep Excel and natural-language handling outside the product core. `octoplanner` owns structured model validation, baseline-aware revise/repair scheduling, diff generation, explainable rule/revision metadata, and report output. Baseline empty means full scheduling; baseline present means repair scheduling that preserves locked and unaffected operations where possible.

**Tech Stack:** TypeScript, Bun runtime, SQLite workspace, Zod validation, Vitest, React/Vite/Tailwind/shadcn report UI, `vis-timeline` for Gantt rendering. Use `npm` only.

---

## Operating Boundary

Excel parsing and writing are adapter responsibilities. The product accepts structured JSON:

- `requirement`, `item`, `routing`, `resource`, `supply`
- `plan` as baseline
- `revision` and/or `rule` as user intent

The product outputs structured JSON:

- revised `plan`
- `plan-diff`
- localized HTML report

Agent flow:

```text
Excel + user utterance
-> adapter/agent creates baseline plan + source mapping + revision/rules
-> octoplanner plan revise
-> octoplanner plan diff
-> octoplanner report output
-> adapter/agent applies diff back to Excel
```

---

### Task 1: Add Revision And PlanDiff Schemas

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/schemas.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/types.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/schema-registry.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/examples.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/domain/schemas.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/package/schemas.test.ts`

**Step 1: Write failing schema tests**

Add tests for:

- `ScheduledOperation.externalRef`
- `RevisionSchema`
- `RevisionBatchSchema`
- `PlanDiffSchema`
- `PlanDiffBatchSchema` if registry conventions need batch examples

Minimum expected shape:

```ts
const revision = RevisionSchema.parse({
  id: 'REV-601277344-URGENT',
  instruction: '将601277344这个订单进行紧急插单排产，其余订单尽量保持先后顺序不变',
  fromPlanId: 'PLAN-CURRENT',
  policy: {
    mode: 'repair',
    preserveResourceOrder: 'best-effort',
    preserveLockedOperations: true,
    moveScope: 'impacted-only'
  },
  rules: [{
    id: 'RULE-PRIORITY-REQ-601277344',
    type: 'priority-boost',
    target: { kind: 'requirement', id: 'REQ-601277344' },
    priority: 10000
  }]
})
expect(revision.policy.preserveResourceOrder).toBe('best-effort')
```

Plan diff expected shape:

```ts
const diff = PlanDiffSchema.parse({
  id: 'DIFF-1',
  fromPlanId: 'PLAN-CURRENT',
  toPlanId: 'PLAN-NEW',
  createdAt: '2026-06-05T00:00:00.000Z',
  summary: {
    added: 0,
    removed: 0,
    moved: 1,
    unchanged: 2,
    unplanned: 0
  },
  movedOperations: [{
    operationId: 'REQ-601275458:OP-930002',
    requirementId: 'REQ-601275458',
    resourceIdBefore: 'RES-SS-05',
    resourceIdAfter: 'RES-SS-05',
    startBefore: '2026-06-11T00:00:00.000Z',
    endBefore: '2026-06-20T00:00:00.000Z',
    startAfter: '2026-06-18T00:00:00.000Z',
    endAfter: '2026-06-27T00:00:00.000Z',
    reasonRuleIds: ['RULE-PRIORITY-REQ-601277344'],
    externalRef: { system: 'xlsx', id: '段友!6' }
  }],
  addedOperations: [],
  removedOperations: [],
  unchangedOperations: [],
  unplannedOperations: [],
  warnings: []
})
expect(diff.summary.moved).toBe(1)
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/domain/schemas.test.ts tests/package/schemas.test.ts
```

Expected: FAIL because schemas are missing.

**Step 3: Implement schemas**

Add:

- `RevisionPolicySchema`
- `RevisionSchema`
- `RevisionBatchSchema`
- `PlanDiffOperationChangeSchema`
- `PlanDiffSchema`

Extend `ScheduledOperationSchema`:

```ts
externalRef: ExternalRefSchema.optional()
```

Policy enums:

- `mode`: `full | repair | optimize`
- `preserveResourceOrder`: `strict | best-effort | none`
- `moveScope`: `impacted-only | all-open | all`

**Step 4: Register schema examples**

Update schema registry so these work:

```bash
npm run octoplanner -- schema list
npm run octoplanner -- schema example --name revision
npm run octoplanner -- schema example --name plan-diff
```

**Step 5: Run tests**

Run:

```bash
npm test -- tests/domain/schemas.test.ts tests/package/schemas.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/domain/schemas.ts src/domain/types.ts src/domain/schema-registry.ts src/domain/examples.ts tests/domain/schemas.test.ts tests/package/schemas.test.ts
git commit -m "feat: add revision and plan diff schemas"
```

---

### Task 2: Add Plan Diff Service

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/plan-service.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/plan-impact-scenario-explain-audit.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/planner/planner.test.ts`

**Step 1: Write failing diff tests**

Add unit tests for a baseline plan and revised plan where:

- one operation is moved
- one operation is unchanged
- one operation is added
- one operation is removed
- externalRef is copied from after operation first, then before operation

Expected assertion:

```ts
const diff = diffPlans(left, right)
expect(diff.summary).toMatchObject({ added: 1, removed: 1, moved: 1, unchanged: 1 })
expect(diff.movedOperations[0]).toMatchObject({
  operationId: 'OP-MOVED',
  resourceIdBefore: 'RES-1',
  resourceIdAfter: 'RES-1',
  externalRef: { system: 'xlsx', id: '段友!6' }
})
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/planner/planner.test.ts tests/commands/plan-impact-scenario-explain-audit.test.ts
```

Expected: FAIL because `diffPlans` does not exist or current `comparePlans` lacks full contract.

**Step 3: Implement `diffPlans(left, right, options?)`**

Keep existing `comparePlans` for backward compatibility, but implement it using `diffPlans`.

Rules:

- Match by `operationId`.
- Added: in right only.
- Removed: in left only.
- Moved: same operation with changed resource/start/end/locked.
- Unchanged: same operation with same resource/start/end/locked.
- Preserve `externalRef`.
- Include `reasonRuleIds`; default to `right.appliedRuleIds`, later refine per operation when planner emits reasons.

**Step 4: Run tests**

Run:

```bash
npm test -- tests/planner/planner.test.ts tests/commands/plan-impact-scenario-explain-audit.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain/plan-service.ts tests/planner/planner.test.ts tests/commands/plan-impact-scenario-explain-audit.test.ts
git commit -m "feat: add structured plan diff service"
```

---

### Task 3: Make Rules Affect Scheduling

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/constraints.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/schedule.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/planner/planner.test.ts`

**Step 1: Write failing planner tests**

Add tests that prove these rules affect output:

- `priority-boost` changes requirement sort order.
- `lock-operation` preserves baseline operation placement in repair mode.
- `lock-requirement` preserves all baseline operations for that requirement.
- `must-run-before` orders two requirements or operations.
- `must-run-after` orders two requirements or operations.

Example:

```ts
const plan = createPlanFromCase(inputWithPriorityBoost, { now: '2026-06-01T00:00:00.000Z' })
expect(plan.scheduledOperations[0]?.requirementId).toBe('REQ-URGENT')
```

Repair lock example:

```ts
const repaired = createPlanFromCase(input, {
  now: '2026-06-01T00:00:00.000Z',
  mode: 'repair',
  baseline
})
expect(repaired.scheduledOperations.find((op) => op.operationId === 'OP-LOCKED')).toMatchObject({
  resourceId: 'RES-1',
  startAt: '2026-06-02T00:00:00.000Z',
  endAt: '2026-06-03T00:00:00.000Z',
  locked: true
})
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/planner/planner.test.ts
```

Expected: FAIL because current planner mostly ignores these rule types.

**Step 3: Add rule helpers**

Add helpers:

- `priorityForRequirement(rules, requirementId, basePriority)`
- `lockedOperationPlacements(rules, baseline)`
- `isLockedRequirement(rules, requirementId)`
- `orderingEdges(rules)`

**Step 4: Update requirement sorting**

Effective priority:

```ts
effectivePriority = max(requirement.priority ?? 0, priority-boost priority values targeting requirement)
```

Ordering rule priority:

- Apply `must-run-before/after` as stable topological ordering when target/relatedTarget are requirements.
- For unsupported target combinations, add a warning instead of crashing.

**Step 5: Run tests**

Run:

```bash
npm test -- tests/planner/planner.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/planner/constraints.ts src/planner/schedule.ts tests/planner/planner.test.ts
git commit -m "feat: apply priority lock and ordering rules in planner"
```

---

### Task 4: Implement Baseline-Aware Repair Scheduling

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/schedule.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/metrics.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/planner/planner.test.ts`

**Step 1: Write failing repair tests**

Test cases:

1. Baseline undefined means full scheduling and matches existing behavior.
2. Baseline present with no new rules produces unchanged plan.
3. Urgent requirement on same resource moves later unlocked operations.
4. `preserveResourceOrder: best-effort` keeps non-target operations in original resource sequence.
5. Locked operation blocks later operations and is not moved.
6. `unplannedOperations` are emitted for impossible placements.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/planner/planner.test.ts
```

Expected: FAIL because repair mode currently does not preserve baseline operations.

**Step 3: Implement repair algorithm**

Algorithm:

1. Expand requirements into operations as today.
2. If no baseline: use existing full scheduling path.
3. If baseline exists:
   - Build baseline operation map by `operationId`.
   - Seed resource cursors with locked baseline operations.
   - Identify movable operations:
     - operations affected by new rules/revision target
     - operations after affected operations on same resource
     - downstream operations for impacted requirements
   - Keep unaffected operations where possible.
   - Schedule movable operations in effective priority/order.
   - Preserve original resource order for movable operations when `best-effort`.
4. Emit warnings when a rule target is not present in expanded operations.

Keep this deterministic. Do not introduce a third-party optimizer yet.

**Step 4: Update metrics**

`movedOperations` should compare against baseline:

```ts
movedOperations = count operations whose resource/start/end changed
```

Add metrics:

- `unchangedOperations`
- `addedOperations`
- `removedOperations`

**Step 5: Run tests**

Run:

```bash
npm test -- tests/planner/planner.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/planner/schedule.ts src/planner/metrics.ts tests/planner/planner.test.ts
git commit -m "feat: support baseline-aware repair scheduling"
```

---

### Task 5: Add `plan revise` And `plan diff` Commands

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/plan.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/plan-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/cli-reference.md`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/plan-impact-scenario-explain-audit.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/e2e/full-workflow.test.ts`

**Step 1: Write failing CLI tests**

Expected commands:

```bash
octoplanner plan revise --from-plan current --name current-after-urgent --rules rules.json
octoplanner plan revise --from-plan current --name current-after-urgent --revision revision.json
octoplanner plan diff --from current --to current-after-urgent --out diff.json
```

Tests should assert:

- `plan revise` saves a new active plan.
- new plan has `baselinePlanId`.
- `plan diff` returns `PlanDiffSchema` shape.
- `--out` writes JSON.
- audit log contains `plan revise` and `plan diff`.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/commands/plan-impact-scenario-explain-audit.test.ts tests/e2e/full-workflow.test.ts
```

Expected: FAIL because commands are missing.

**Step 3: Implement command parsing**

`plan revise` inputs:

- `--from-plan <name-or-id>` required
- `--name <name>` required
- `--rules <file>` optional
- `--revision <file>` optional

Behavior:

- Load baseline plan.
- Resolve baseline case.
- Materialize current case.
- Merge case rules + inline rules + revision rules.
- Call `createPlanFromCase(..., { mode: revision.policy.mode ?? 'repair', baseline, name })`.
- Save new plan.

`plan diff` inputs:

- `--from <plan>` required
- `--to <plan>` required
- `--out <file>` optional

Behavior:

- Load plans.
- Call `diffPlans`.
- Write `--out` if provided.
- Return JSON.

**Step 4: Run tests**

Run:

```bash
npm test -- tests/commands/plan-impact-scenario-explain-audit.test.ts tests/e2e/full-workflow.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/plan.ts src/domain/plan-service.ts docs/cli-reference.md tests/commands/plan-impact-scenario-explain-audit.test.ts tests/e2e/full-workflow.test.ts
git commit -m "feat: add plan revise and plan diff commands"
```

---

### Task 6: Add Report Support For Plan Diff

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/report-types.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/report-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/report/html.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/report/messages.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/report/locale.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/report.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/report/web/*`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/report.md`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/report.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/domain/report-service.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/report/html.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/e2e/report-workflow.test.ts`

**Step 1: Write failing report tests**

Add report type:

```bash
octoplanner report output --format html --diff diff.json --lang zh-CN plan-diff --out diff.html
```

Expected HTML contains:

- moved operation count
- added/removed/unplanned count
- before/after resource and time
- reason rule ids
- externalRef

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/commands/report.test.ts tests/domain/report-service.test.ts tests/report/html.test.ts tests/e2e/report-workflow.test.ts
```

Expected: FAIL because `plan-diff` report type is missing.

**Step 3: Implement report domain support**

Add `plan-diff` report type. It should accept `--diff <file>` rather than `--plan`.

Report sections:

- Summary counters
- Moved operations table
- Added operations table
- Removed operations table
- Unplanned operations table
- Warnings

**Step 4: Implement localized messages**

Chinese labels:

- `计划差异`
- `移动工序`
- `新增工序`
- `移除工序`
- `未排工序`
- `来源引用`

English labels:

- `Plan Diff`
- `Moved Operations`
- `Added Operations`
- `Removed Operations`
- `Unplanned Operations`
- `External Reference`

**Step 5: Update report website**

The interactive website should support viewing diff JSON when available:

- Diff summary cards.
- Operations table with filters by requirement/resource/change type.
- Gantt view can remain plan-oriented; do not overbuild diff timeline yet.

**Step 6: Run report tests**

Run:

```bash
npm test -- tests/commands/report.test.ts tests/domain/report-service.test.ts tests/report/html.test.ts tests/e2e/report-workflow.test.ts
npm run build:report-web
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/domain/report-types.ts src/domain/report-service.ts src/report src/commands/report.ts docs/report.md tests/commands/report.test.ts tests/domain/report-service.test.ts tests/report/html.test.ts tests/e2e/report-workflow.test.ts
git commit -m "feat: add plan diff report output"
```

---

### Task 7: Update Scenario Compatibility

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/scenario.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/cli-reference.md`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/plan-impact-scenario-explain-audit.test.ts`

**Step 1: Write failing compatibility test**

`scenario simulate --mode repair` should call the same baseline-aware planner as `plan revise`.

Expected:

- candidate plan has `baselinePlanId`.
- candidate plan metrics include moved count.
- scenario compare uses structured diff.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/commands/plan-impact-scenario-explain-audit.test.ts
```

Expected: FAIL if scenario still reconstructs incomplete model from scheduled operations.

**Step 3: Refactor scenario simulate**

Use baseline plan case materialization when possible:

- Load baseline plan.
- Resolve `baseline.caseId`.
- Materialize the case.
- Call `createPlanFromCase(..., { baseline, mode })`.

If baseline has no `caseId`, fastfail with `BASELINE_CASE_MISSING` instead of silently creating routings-less plans.

**Step 4: Run tests**

Run:

```bash
npm test -- tests/commands/plan-impact-scenario-explain-audit.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/commands/scenario.ts docs/cli-reference.md tests/commands/plan-impact-scenario-explain-audit.test.ts
git commit -m "fix: route scenario repair through baseline planner"
```

---

### Task 8: End-To-End Fixture For Urgent Insertion

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/README.md`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/requirements.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/items.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/routings.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/resources.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/baseline-plan.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/revision.json`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/e2e/full-workflow.test.ts`

**Step 1: Write failing E2E test**

Use fixture reflecting the machining example:

- `REQ-601277344` urgent insert on `RES-SS-05`.
- Existing jobs on `RES-SS-05` preserve relative order after urgent job.
- Downstream operations on `RES-SS-35` and `RES-SZ-01` move after predecessors.

Expected CLI sequence:

```bash
npm run octoplanner -- workspace init
npm run octoplanner -- model requirement load --file examples/revision-urgent-insert/requirements.json
npm run octoplanner -- model item load --file examples/revision-urgent-insert/items.json
npm run octoplanner -- model routing load --file examples/revision-urgent-insert/routings.json
npm run octoplanner -- model resource load --file examples/revision-urgent-insert/resources.json
npm run octoplanner -- plan load --file examples/revision-urgent-insert/baseline-plan.json --name current
npm run octoplanner -- plan revise --from-plan current --name after-urgent --revision examples/revision-urgent-insert/revision.json
npm run octoplanner -- plan diff --from current --to after-urgent --out diff.json
npm run octoplanner -- report output --format html --diff diff.json plan-diff --out diff.html
```

**Step 2: Run test to verify failure**

Run:

```bash
npm test -- tests/e2e/full-workflow.test.ts
```

Expected: FAIL until fixture and commands are complete.

**Step 3: Add fixtures and expected assertions**

Assertions:

- `REQ-601277344` starts first on `RES-SS-05`.
- `REQ-601277676` remains before `REQ-601275458`.
- diff moved count is greater than zero.
- every moved operation has `externalRef`.
- HTML report file exists and includes `计划差异`.

**Step 4: Run E2E test**

Run:

```bash
npm test -- tests/e2e/full-workflow.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add examples/revision-urgent-insert tests/e2e/full-workflow.test.ts
git commit -m "test: add urgent insertion revision workflow"
```

---

### Task 9: Update Documentation

**Files:**
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/README.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/cli-reference.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/model-contract.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/rule-contract.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/scheduling-semantics.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/agent-integration.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/report.md`

**Step 1: Write docs before final verification**

Document:

- Baseline empty means full scheduling.
- Baseline present means repair/revision scheduling.
- `plan revise` examples.
- `plan diff` contract.
- Report `plan-diff`.
- Adapter boundary: Excel is outside product.
- Agent flow from user utterance to revision/rules to diff.

**Step 2: Add command examples**

Include:

```bash
octoplanner plan load --file baseline-plan.json --name current
octoplanner plan revise --from-plan current --name after-urgent --revision revision.json
octoplanner plan diff --from current --to after-urgent --out diff.json
octoplanner report output --format html --diff diff.json plan-diff --out diff.html
```

**Step 3: Commit**

```bash
git add README.md docs/cli-reference.md docs/model-contract.md docs/rule-contract.md docs/scheduling-semantics.md docs/agent-integration.md docs/report.md
git commit -m "docs: describe baseline revision workflow"
```

---

### Task 10: Full Verification

**Files:**
- No code files unless verification exposes a bug.

**Step 1: Run full checks**

Run:

```bash
npm run check
npm run build
npm run build:report-web
```

Expected: all pass.

**Step 2: Run package checks**

Run:

```bash
npm run package:prepare
npm run pack:dry
```

Expected: package builds and dry pack succeeds.

**Step 3: Manual CLI smoke test**

In a temp directory:

```bash
tmp="$(mktemp -d)"
cd "$tmp"
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts workspace init
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts model requirement load --file /Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/requirements.json
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts model item load --file /Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/items.json
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts model routing load --file /Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/routings.json
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts model resource load --file /Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/resources.json
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts plan load --file /Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/baseline-plan.json --name current
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts plan revise --from-plan current --name after-urgent --revision /Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/revision.json
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts plan diff --from current --to after-urgent --out diff.json
npm --prefix /Users/wanglei/Projects/syngy/octoplanner exec -- bun /Users/wanglei/Projects/syngy/octoplanner/src/cli.ts report output --format html --diff diff.json plan-diff --out diff.html
test -s diff.json
test -s diff.html
```

Expected: all commands exit 0 and files exist.

**Step 4: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: clean except expected branch ahead commits.

**Step 5: Commit verification fixes if needed**

Only if verification required changes:

```bash
git add <changed-files>
git commit -m "fix: complete baseline revision verification"
```

---

## Acceptance Criteria

- Baseline empty still supports full plan creation through `plan create`.
- Baseline present supports `plan revise`.
- `priority-boost`, lock rules, and requirement-level ordering rules affect scheduling.
- `preserveResourceOrder: best-effort` preserves visible resource queue order when feasible.
- `plan diff` emits a stable, schema-validated JSON contract.
- Diff entries include `externalRef` when input operations have mappings.
- Report CLI can output localized HTML for `plan-diff`.
- Interactive report can display diff summary/table.
- End-to-end urgent insertion fixture passes.
- `npm run check`, `npm run build`, and `npm run build:report-web` pass.

