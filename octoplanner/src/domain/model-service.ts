import { fail } from '../core/errors'
import { readJsonFile } from '../core/json'
import {
  ItemBatchSchema,
  RequirementBatchSchema,
  ResourceBatchSchema,
  RoutingBatchSchema,
  SupplyBatchSchema
} from './schemas'
import type { ModelKind } from './types'

export const MODEL_SCHEMAS = {
  requirement: RequirementBatchSchema,
  item: ItemBatchSchema,
  routing: RoutingBatchSchema,
  resource: ResourceBatchSchema,
  supply: SupplyBatchSchema
} as const

export function parseModelFile(kind: ModelKind, file: string): any {
  const result = MODEL_SCHEMAS[kind].safeParse(readJsonFile(file))
  if (!result.success) fail('VALIDATION_FAILED', `VALIDATION_FAILED: invalid model ${kind}`, result.error.issues)
  return result.data
}

export function summarizeModel(kind: ModelKind, batches: any[]): unknown {
  const latest = batches[0]?.payload
  if (!latest) return { count: 0 }
  if (kind === 'requirement') {
    const requirements = latest.requirements as any[]
    const quantities = requirements.map((item) => Number(item.quantity))
    return { count: requirements.length, totalQuantity: quantities.reduce((sum, item) => sum + item, 0) }
  }
  if (kind === 'routing') return { count: latest.routings.length, operationCount: latest.routings.flatMap((item: any) => item.operations).length }
  const key = kind === 'item' ? 'items' : kind === 'resource' ? 'resources' : 'supplies'
  return { count: latest[key].length }
}

export function routingCoverage(requirements: any[], routings: any[]): { covered: string[]; missing: string[] } {
  const routedItemIds = new Set(routings.map((routing) => routing.itemId))
  const covered: string[] = []
  const missing: string[] = []
  for (const requirement of requirements) {
    if (routedItemIds.has(requirement.itemId)) covered.push(requirement.id)
    else missing.push(requirement.id)
  }
  return { covered, missing }
}
