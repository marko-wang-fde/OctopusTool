import {
  CaseSchema,
  ItemBatchSchema,
  PlanSchema,
  PlanDiffSchema,
  RequirementBatchSchema,
  ResourceBatchSchema,
  RevisionBatchSchema,
  RoutingBatchSchema,
  RuleBatchSchema,
  ScenarioSchema,
  SupplyBatchSchema
} from './schemas'
import {
  CaseExample,
  ItemBatchExample,
  PlanExample,
  PlanDiffExample,
  RequirementBatchExample,
  ResourceBatchExample,
  RevisionBatchExample,
  RoutingBatchExample,
  RuleBatchExample,
  ScenarioExample,
  SupplyBatchExample
} from './examples'

export const SCHEMA_REGISTRY = {
  'model.requirement': { schema: RequirementBatchSchema, example: RequirementBatchExample },
  'model.item': { schema: ItemBatchSchema, example: ItemBatchExample },
  'model.routing': { schema: RoutingBatchSchema, example: RoutingBatchExample },
  'model.resource': { schema: ResourceBatchSchema, example: ResourceBatchExample },
  'model.supply': { schema: SupplyBatchSchema, example: SupplyBatchExample },
  rule: { schema: RuleBatchSchema, example: RuleBatchExample },
  revision: { schema: RevisionBatchSchema, example: RevisionBatchExample },
  case: { schema: CaseSchema, example: CaseExample },
  plan: { schema: PlanSchema, example: PlanExample },
  'plan-diff': { schema: PlanDiffSchema, example: PlanDiffExample },
  scenario: { schema: ScenarioSchema, example: ScenarioExample }
} as const

export type SchemaName = keyof typeof SCHEMA_REGISTRY
