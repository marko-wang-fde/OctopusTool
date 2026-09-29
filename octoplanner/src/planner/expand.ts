import type { Requirement, Routing } from '../domain/types'

export type ExpandedOperation = {
  operationId: string
  requirementId: string
  itemId: string
  routingOperationId: string
  sequence: number
  durationMinutes?: number
  eligibleResourceIds: string[]
}

export function expandRequirements(requirements: Requirement[], routings: Routing[]): { operations: ExpandedOperation[]; unplanned: any[] } {
  const routingByItem = new Map(routings.map((routing) => [routing.itemId, routing]))
  const operations: ExpandedOperation[] = []
  const unplanned: any[] = []
  for (const requirement of requirements) {
    const routing = routingByItem.get(requirement.itemId)
    if (!routing) {
      unplanned.push({ operationId: `${requirement.id}:routing`, requirementId: requirement.id, reason: 'ROUTING_MISSING' })
      continue
    }
    for (const operation of [...routing.operations].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))) {
      const operationId = `${requirement.id}:${operation.id}`
      if (!operation.durationMinutes) {
        unplanned.push({ operationId, requirementId: requirement.id, reason: 'DURATION_MISSING' })
        continue
      }
      operations.push({
        operationId,
        requirementId: requirement.id,
        itemId: requirement.itemId,
        routingOperationId: operation.id,
        sequence: operation.sequence,
        durationMinutes: operation.durationMinutes,
        eligibleResourceIds: operation.eligibleResourceIds ?? []
      })
    }
  }
  return { operations, unplanned }
}
