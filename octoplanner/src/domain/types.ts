export type ModelKind = 'requirement' | 'item' | 'routing' | 'resource' | 'supply'

export type ExternalRef = {
  system: string
  id: string
  payload?: unknown
}

export type Requirement = {
  id: string
  itemId: string
  quantity: number
  dueAt?: string
  priority?: number
  customer?: string
  vehicleModel?: string
  attributes?: Record<string, string>
  externalRef?: ExternalRef
}

export type RequirementBatch = { id: string; requirements: Requirement[] }

export type Item = {
  id: string
  name: string
  materialId?: string
  materialShape?: string
  materialGrade?: string
  processFamily?: string
  setupGroup?: string
  attributes?: Record<string, string>
  externalRef?: ExternalRef
}

export type ItemBatch = { id: string; items: Item[] }

export type RoutingOperation = {
  id: string
  sequence: number
  name: string
  durationMinutes?: number
  eligibleResourceIds?: string[]
  resourceGroupId?: string
  setupGroup?: string
  materialShape?: string
  minLagMinutes?: number
  maxLagMinutes?: number
  continuity?: 'required' | 'preferred' | 'none'
}

export type Routing = {
  id?: string
  itemId: string
  operations: RoutingOperation[]
}

export type RoutingBatch = { id: string; routings: Routing[] }

export type Resource = {
  id: string
  name: string
  groupId?: string
  capacity?: number
  unavailableWindows?: Array<{ from: string; to: string }>
  attributes?: Record<string, string>
}

export type ResourceBatch = { id: string; resources: Resource[] }

export type Supply = {
  id: string
  itemId?: string
  materialId?: string
  quantity?: number
  availableAt?: string
  shortageQty?: number
  supplyMode?: 'buy' | 'make' | 'outsource' | 'unknown'
  ownerDepartment?: string
  ownerPerson?: string
  externalRef?: ExternalRef
}

export type SupplyBatch = { id: string; supplies: Supply[] }

export type Target = {
  kind: 'requirement' | 'item' | 'operation' | 'resource' | 'supply'
  id: string
}

export type Rule = {
  id: string
  type:
    | 'not-start-until'
    | 'not-finish-after'
    | 'resource-unavailable'
    | 'lock-operation'
    | 'lock-requirement'
    | 'avoid-resource'
    | 'prefer-resource'
    | 'priority-boost'
    | 'must-run-before'
    | 'must-run-after'
    | 'supply-not-available-until'
  target: Target
  enabled: boolean
  reason?: string
  until?: string
  after?: string
  from?: string
  to?: string
  priority?: number
  resourceId?: string
  relatedTarget?: Target
  expiresAt?: string
  createdAt?: string
}

export type RuleBatch = { id: string; rules: Rule[] }

export type RevisionPolicy = {
  mode?: 'full' | 'repair' | 'optimize'
  preserveResourceOrder?: 'strict' | 'best-effort' | 'none'
  preserveLockedOperations?: boolean
  moveScope?: 'impacted-only' | 'all-open' | 'all'
}

export type Revision = {
  id: string
  instruction?: string
  fromPlanId?: string
  policy?: RevisionPolicy
  rules: Rule[]
  createdAt?: string
}

export type RevisionBatch = { id: string; revisions: Revision[] }

export type Case = {
  id: string
  name: string
  modelBatchIds: {
    requirement?: string
    item?: string
    routing?: string
    resource?: string
    supply?: string
  }
  ruleIds: string[]
  baselinePlanId?: string
  createdAt: string
}

export type ScheduledOperation = {
  operationId: string
  requirementId: string
  itemId: string
  routingOperationId: string
  resourceId: string
  startAt: string
  endAt: string
  locked: boolean
  labels?: Record<string, string>
  externalRef?: ExternalRef
}

export type Plan = {
  id: string
  name: string
  caseId?: string
  baselinePlanId?: string
  state: 'active' | 'archived'
  createdAt: string
  scheduledOperations: ScheduledOperation[]
  unplannedOperations: Array<{ operationId: string; requirementId: string; reason: string }>
  metrics: Record<string, unknown>
  appliedRuleIds: string[]
  warnings: Array<{ code: string; message: string; details?: unknown }>
  notModeled: string[]
}

export type PlanDiffOperationChange = {
  operationId: string
  requirementId: string
  resourceIdBefore?: string
  resourceIdAfter?: string
  startBefore?: string
  endBefore?: string
  startAfter?: string
  endAfter?: string
  lockedBefore?: boolean
  lockedAfter?: boolean
  reasonRuleIds: string[]
  externalRef?: ExternalRef
}

export type PlanDiff = {
  id: string
  fromPlanId: string
  toPlanId: string
  createdAt: string
  summary: {
    added: number
    removed: number
    moved: number
    unchanged: number
    unplanned: number
  }
  movedOperations: PlanDiffOperationChange[]
  addedOperations: PlanDiffOperationChange[]
  removedOperations: PlanDiffOperationChange[]
  unchangedOperations: PlanDiffOperationChange[]
  unplannedOperations: Array<{ operationId: string; requirementId: string; reason: string }>
  warnings: Array<{ code: string; message: string; details?: unknown }>
}

export type Scenario = {
  id: string
  name: string
  fromPlanId: string
  state: 'open' | 'committed' | 'discarded'
  createdAt: string
  ruleIds: string[]
  candidates: Plan[]
  committedPlanId?: string
}
