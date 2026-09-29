import { fail } from '../core/errors'
import { createId, nowIso } from '../core/ids'
import { CaseSchema } from './schemas'

export function buildCase(input: {
  name: string
  modelBatchIds: Record<string, string | undefined>
  ruleIds: string[]
  baselinePlanId?: string
}): any {
  const candidate = {
    id: createId('case'),
    name: input.name,
    modelBatchIds: input.modelBatchIds,
    ruleIds: input.ruleIds,
    baselinePlanId: input.baselinePlanId,
    createdAt: nowIso()
  }
  const result = CaseSchema.safeParse(candidate)
  if (!result.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid case', result.error.issues)
  return result.data
}

export function validateCase(input: { casePayload: any; requirements: any[]; items: any[]; routings: any[]; resources: any[]; supplies: any[]; rules: any[] }): {
  valid: boolean
  errors: string[]
  notModeled: string[]
  summary: Record<string, number>
} {
  const errors: string[] = []
  const notModeled: string[] = []
  const itemIds = new Set(input.items.map((item) => item.id))
  const routingItemIds = new Set(input.routings.map((routing) => routing.itemId))
  const resourceIds = new Set(input.resources.map((resource) => resource.id))

  for (const requirement of input.requirements) {
    if (!itemIds.has(requirement.itemId)) errors.push(`requirement ${requirement.id} references missing item ${requirement.itemId}`)
    if (!routingItemIds.has(requirement.itemId)) errors.push(`requirement ${requirement.id} has no routing for item ${requirement.itemId}`)
  }
  for (const routing of input.routings) {
    for (const operation of routing.operations ?? []) {
      for (const resourceId of operation.eligibleResourceIds ?? []) {
        if (!resourceIds.has(resourceId)) errors.push(`routing ${routing.itemId} operation ${operation.id} references missing resource ${resourceId}`)
      }
    }
  }
  if (input.supplies.length === 0) notModeled.push('supply_availability')
  if (!input.resources.some((resource) => Array.isArray(resource.unavailableWindows))) notModeled.push('shift_calendar')
  if (!input.items.some((item) => item.setupGroup)) notModeled.push('changeover_cost')

  return {
    valid: errors.length === 0,
    errors,
    notModeled,
    summary: {
      requirements: input.requirements.length,
      items: input.items.length,
      routings: input.routings.length,
      resources: input.resources.length,
      supplies: input.supplies.length,
      rules: input.rules.length
    }
  }
}
