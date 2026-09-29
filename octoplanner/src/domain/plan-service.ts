import { fail } from '../core/errors'
import { createId, nowIso } from '../core/ids'
import { readJsonFile } from '../core/json'
import { PlanDiffSchema, PlanSchema, RevisionBatchSchema, RevisionSchema } from './schemas'
import type { Plan, PlanDiff, PlanDiffOperationChange, Revision, ScheduledOperation } from './types'

export function parsePlanFile(file: string, name?: string): Plan {
  const result = PlanSchema.safeParse(readJsonFile(file))
  if (!result.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid plan', result.error.issues)
  return name ? { ...result.data, name } : result.data
}

export function parseRevisionFile(file: string): Revision {
  const raw = readJsonFile(file)
  const single = RevisionSchema.safeParse(raw)
  if (single.success) return single.data
  const batch = RevisionBatchSchema.safeParse(raw)
  if (batch.success && batch.data.revisions[0]) return batch.data.revisions[0]
  fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid revision', single.error.issues)
}

export function comparePlans(left: Plan, right: Plan): Record<string, unknown> {
  const diff = diffPlans(left, right)
  const added = diff.addedOperations.map((op) => op.operationId)
  const removed = diff.removedOperations.map((op) => op.operationId)
  const moved = diff.movedOperations.map((op) => op.operationId)
  return { left: left.name, right: right.name, added, removed, moved, metricsDelta: { left: left.metrics, right: right.metrics } }
}

export function diffPlans(left: Plan, right: Plan, options: { id?: string; createdAt?: string } = {}): PlanDiff {
  const leftOps = new Map(left.scheduledOperations.map((op) => [op.operationId, op]))
  const rightOps = new Map(right.scheduledOperations.map((op) => [op.operationId, op]))
  const movedOperations: PlanDiffOperationChange[] = []
  const addedOperations: PlanDiffOperationChange[] = []
  const removedOperations: PlanDiffOperationChange[] = []
  const unchangedOperations: PlanDiffOperationChange[] = []

  for (const op of right.scheduledOperations) {
    const before = leftOps.get(op.operationId)
    if (!before) {
      addedOperations.push(changeFrom(undefined, op, right.appliedRuleIds))
      continue
    }
    const target = hasPlacementChanged(before, op) ? movedOperations : unchangedOperations
    target.push(changeFrom(before, op, hasPlacementChanged(before, op) ? right.appliedRuleIds : []))
  }

  for (const op of left.scheduledOperations) {
    if (!rightOps.has(op.operationId)) removedOperations.push(changeFrom(op, undefined, right.appliedRuleIds))
  }

  const candidate = {
    id: options.id ?? createId('diff'),
    fromPlanId: left.id,
    toPlanId: right.id,
    createdAt: options.createdAt ?? nowIso(),
    summary: {
      added: addedOperations.length,
      removed: removedOperations.length,
      moved: movedOperations.length,
      unchanged: unchangedOperations.length,
      unplanned: right.unplannedOperations.length
    },
    movedOperations,
    addedOperations,
    removedOperations,
    unchangedOperations,
    unplannedOperations: right.unplannedOperations,
    warnings: right.warnings
  }
  return PlanDiffSchema.parse(candidate)
}

function hasPlacementChanged(before: ScheduledOperation, after: ScheduledOperation): boolean {
  return before.resourceId !== after.resourceId
    || before.startAt !== after.startAt
    || before.endAt !== after.endAt
    || before.locked !== after.locked
}

function changeFrom(before: ScheduledOperation | undefined, after: ScheduledOperation | undefined, reasonRuleIds: string[]): PlanDiffOperationChange {
  const op = after ?? before
  if (!op) fail('PLAN_DIFF_INVALID', 'PLAN_DIFF_INVALID: change requires before or after operation')
  const externalRef = after?.externalRef ?? before?.externalRef
  const change: PlanDiffOperationChange = {
    operationId: op.operationId,
    requirementId: op.requirementId,
    ...(before ? {
      resourceIdBefore: before.resourceId,
      startBefore: before.startAt,
      endBefore: before.endAt,
      lockedBefore: before.locked
    } : {}),
    ...(after ? {
      resourceIdAfter: after.resourceId,
      startAfter: after.startAt,
      endAfter: after.endAt,
      lockedAfter: after.locked
    } : {}),
    reasonRuleIds
  }
  if (externalRef) change.externalRef = externalRef
  return change
}
