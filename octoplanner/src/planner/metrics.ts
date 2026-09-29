import type { Plan, Requirement, ScheduledOperation } from '../domain/types'

export function minutesBetween(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000))
}

export function addMinutes(startAt: string, minutes: number): string {
  return new Date(new Date(startAt).getTime() + minutes * 60000).toISOString()
}

export function computeMetrics(input: { requirements: Requirement[]; scheduledOperations: ScheduledOperation[]; unplannedOperations: any[]; baseline?: Plan }): Record<string, unknown> {
  const requirementById = new Map(input.requirements.map((item) => [item.id, item]))
  const finishByRequirement = new Map<string, string>()
  for (const op of input.scheduledOperations) {
    const current = finishByRequirement.get(op.requirementId)
    if (!current || op.endAt > current) finishByRequirement.set(op.requirementId, op.endAt)
  }
  let lateRequirements = 0
  let totalLatenessMinutes = 0
  for (const [id, finish] of finishByRequirement) {
    const requirement = requirementById.get(id)
    if (requirement?.dueAt && finish > requirement.dueAt) {
      lateRequirements += 1
      totalLatenessMinutes += minutesBetween(requirement.dueAt, finish)
    }
  }
  const baselineByOperation = new Map((input.baseline?.scheduledOperations ?? []).map((op) => [op.operationId, op]))
  const scheduledByOperation = new Map(input.scheduledOperations.map((op) => [op.operationId, op]))
  const movedOperations = input.scheduledOperations.filter((op) => {
    const baseline = baselineByOperation.get(op.operationId)
    return baseline && (baseline.startAt !== op.startAt || baseline.endAt !== op.endAt || baseline.resourceId !== op.resourceId || baseline.locked !== op.locked)
  }).length
  const unchangedOperations = input.scheduledOperations.filter((op) => {
    const baseline = baselineByOperation.get(op.operationId)
    return baseline && baseline.startAt === op.startAt && baseline.endAt === op.endAt && baseline.resourceId === op.resourceId && baseline.locked === op.locked
  }).length
  const addedOperations = input.scheduledOperations.filter((op) => !baselineByOperation.has(op.operationId)).length
  const removedOperations = [...baselineByOperation.keys()].filter((operationId) => !scheduledByOperation.has(operationId)).length
  return {
    totalRequirements: input.requirements.length,
    scheduledOperations: input.scheduledOperations.length,
    unplannedOperations: input.unplannedOperations.length,
    lateRequirements,
    totalLatenessMinutes,
    movedOperations,
    unchangedOperations,
    addedOperations,
    removedOperations
  }
}
