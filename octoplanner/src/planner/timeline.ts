import type { Plan } from '../domain/types'

export function timelineForPlan(plan: Plan): unknown[] {
  return plan.scheduledOperations.map((operation) => ({
    operationId: operation.operationId,
    requirementId: operation.requirementId,
    itemId: operation.itemId,
    resourceId: operation.resourceId,
    startAt: operation.startAt,
    endAt: operation.endAt,
    locked: operation.locked,
    labels: operation.labels ?? {}
  }))
}
