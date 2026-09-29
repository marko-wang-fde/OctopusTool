import * as zod from 'zod'

const z = (zod as any).z ?? (zod as any).default

export const IdSchema = z.string().min(1)
export const IsoDateTimeSchema = z.string().datetime()

export const ExternalRefSchema = z.object({
  system: z.string().min(1),
  id: z.string().min(1),
  payload: z.unknown().optional()
})

export const RequirementSchema = z.object({
  id: IdSchema,
  itemId: IdSchema,
  quantity: z.number().positive(),
  dueAt: IsoDateTimeSchema.optional(),
  priority: z.number().finite().optional(),
  customer: z.string().min(1).optional(),
  vehicleModel: z.string().min(1).optional(),
  attributes: z.record(z.string()).optional(),
  externalRef: ExternalRefSchema.optional()
})

export const RequirementBatchSchema = z.object({
  id: IdSchema,
  requirements: z.array(RequirementSchema)
})

export const ItemSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  materialId: IdSchema.optional(),
  materialShape: z.string().min(1).optional(),
  materialGrade: z.string().min(1).optional(),
  processFamily: z.string().min(1).optional(),
  setupGroup: z.string().min(1).optional(),
  attributes: z.record(z.string()).optional(),
  externalRef: ExternalRefSchema.optional()
})

export const ItemBatchSchema = z.object({
  id: IdSchema,
  items: z.array(ItemSchema)
})

export const RoutingOperationSchema = z.object({
  id: IdSchema,
  sequence: z.number().int().finite(),
  name: z.string().min(1),
  durationMinutes: z.number().positive().optional(),
  eligibleResourceIds: z.array(IdSchema).optional(),
  resourceGroupId: IdSchema.optional(),
  setupGroup: z.string().min(1).optional(),
  materialShape: z.string().min(1).optional(),
  minLagMinutes: z.number().nonnegative().optional(),
  maxLagMinutes: z.number().nonnegative().optional(),
  continuity: z.enum(['required', 'preferred', 'none']).optional()
})

export const RoutingSchema = z.object({
  id: IdSchema.optional(),
  itemId: IdSchema,
  operations: z.array(RoutingOperationSchema)
})

export const RoutingBatchSchema = z.object({
  id: IdSchema,
  routings: z.array(RoutingSchema)
})

export const ResourceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  groupId: IdSchema.optional(),
  capacity: z.number().positive().optional(),
  unavailableWindows: z.array(z.object({ from: IsoDateTimeSchema, to: IsoDateTimeSchema })).optional(),
  attributes: z.record(z.string()).optional()
})

export const ResourceBatchSchema = z.object({
  id: IdSchema,
  resources: z.array(ResourceSchema)
})

export const SupplySchema = z.object({
  id: IdSchema,
  itemId: IdSchema.optional(),
  materialId: IdSchema.optional(),
  quantity: z.number().finite().optional(),
  availableAt: IsoDateTimeSchema.optional(),
  shortageQty: z.number().finite().optional(),
  supplyMode: z.enum(['buy', 'make', 'outsource', 'unknown']).optional(),
  ownerDepartment: z.string().min(1).optional(),
  ownerPerson: z.string().min(1).optional(),
  externalRef: ExternalRefSchema.optional()
})

export const SupplyBatchSchema = z.object({
  id: IdSchema,
  supplies: z.array(SupplySchema)
})

export const TargetSchema = z.object({
  kind: z.enum(['requirement', 'item', 'operation', 'resource', 'supply']),
  id: IdSchema
})

export const RuleTypeSchema = z.enum([
  'not-start-until',
  'not-finish-after',
  'resource-unavailable',
  'lock-operation',
  'lock-requirement',
  'avoid-resource',
  'prefer-resource',
  'priority-boost',
  'must-run-before',
  'must-run-after',
  'supply-not-available-until'
])

export const RuleSchema = z.object({
  id: IdSchema,
  type: RuleTypeSchema,
  target: TargetSchema,
  enabled: z.boolean().default(true),
  reason: z.string().min(1).optional(),
  until: IsoDateTimeSchema.optional(),
  after: IsoDateTimeSchema.optional(),
  from: IsoDateTimeSchema.optional(),
  to: IsoDateTimeSchema.optional(),
  priority: z.number().finite().optional(),
  resourceId: IdSchema.optional(),
  relatedTarget: TargetSchema.optional(),
  expiresAt: IsoDateTimeSchema.optional(),
  createdAt: IsoDateTimeSchema.optional()
}).superRefine((rule: any, ctx: any) => {
  const requireField = (field: keyof typeof rule) => {
    if (rule[field] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `${String(field)} is required for ${rule.type}` })
  }
  if (rule.type === 'not-start-until') requireField('until')
  if (rule.type === 'not-finish-after') requireField('after')
  if (rule.type === 'resource-unavailable') {
    if (rule.target.kind !== 'resource') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['target'], message: 'resource-unavailable target must be resource' })
    requireField('from')
    requireField('to')
  }
  if (rule.type === 'priority-boost') requireField('priority')
  if (rule.type === 'avoid-resource' || rule.type === 'prefer-resource') requireField('resourceId')
  if (rule.type === 'must-run-before' || rule.type === 'must-run-after') requireField('relatedTarget')
  if (rule.type === 'supply-not-available-until') requireField('until')
})

export const RuleBatchSchema = z.object({
  id: IdSchema,
  rules: z.array(RuleSchema)
})

export const RevisionPolicySchema = z.object({
  mode: z.enum(['full', 'repair', 'optimize']).optional(),
  preserveResourceOrder: z.enum(['strict', 'best-effort', 'none']).optional(),
  preserveLockedOperations: z.boolean().optional(),
  moveScope: z.enum(['impacted-only', 'all-open', 'all']).optional()
})

export const RevisionSchema = z.object({
  id: IdSchema,
  instruction: z.string().min(1).optional(),
  fromPlanId: IdSchema.optional(),
  policy: RevisionPolicySchema.optional(),
  rules: z.array(RuleSchema).default([]),
  createdAt: IsoDateTimeSchema.optional()
})

export const RevisionBatchSchema = z.object({
  id: IdSchema,
  revisions: z.array(RevisionSchema)
})

export const CaseSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  modelBatchIds: z.object({
    requirement: IdSchema.optional(),
    item: IdSchema.optional(),
    routing: IdSchema.optional(),
    resource: IdSchema.optional(),
    supply: IdSchema.optional()
  }),
  ruleIds: z.array(IdSchema).default([]),
  baselinePlanId: IdSchema.optional(),
  createdAt: IsoDateTimeSchema
})

export const ScheduledOperationSchema = z.object({
  operationId: IdSchema,
  requirementId: IdSchema,
  itemId: IdSchema,
  routingOperationId: IdSchema,
  resourceId: IdSchema,
  startAt: IsoDateTimeSchema,
  endAt: IsoDateTimeSchema,
  locked: z.boolean().default(false),
  labels: z.record(z.string()).optional(),
  externalRef: ExternalRefSchema.optional()
})

export const PlanSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  caseId: IdSchema.optional(),
  baselinePlanId: IdSchema.optional(),
  state: z.enum(['active', 'archived']).default('active'),
  createdAt: IsoDateTimeSchema,
  scheduledOperations: z.array(ScheduledOperationSchema),
  unplannedOperations: z.array(z.object({
    operationId: IdSchema,
    requirementId: IdSchema,
    reason: z.string().min(1)
  })).default([]),
  metrics: z.record(z.unknown()).default({}),
  appliedRuleIds: z.array(IdSchema).default([]),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() })).default([]),
  notModeled: z.array(z.string()).default([])
})

export const PlanDiffOperationChangeSchema = z.object({
  operationId: IdSchema,
  requirementId: IdSchema,
  resourceIdBefore: IdSchema.optional(),
  resourceIdAfter: IdSchema.optional(),
  startBefore: IsoDateTimeSchema.optional(),
  endBefore: IsoDateTimeSchema.optional(),
  startAfter: IsoDateTimeSchema.optional(),
  endAfter: IsoDateTimeSchema.optional(),
  lockedBefore: z.boolean().optional(),
  lockedAfter: z.boolean().optional(),
  reasonRuleIds: z.array(IdSchema).default([]),
  externalRef: ExternalRefSchema.optional()
})

export const PlanDiffSchema = z.object({
  id: IdSchema,
  fromPlanId: IdSchema,
  toPlanId: IdSchema,
  createdAt: IsoDateTimeSchema,
  summary: z.object({
    added: z.number().int().nonnegative(),
    removed: z.number().int().nonnegative(),
    moved: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
    unplanned: z.number().int().nonnegative()
  }),
  movedOperations: z.array(PlanDiffOperationChangeSchema).default([]),
  addedOperations: z.array(PlanDiffOperationChangeSchema).default([]),
  removedOperations: z.array(PlanDiffOperationChangeSchema).default([]),
  unchangedOperations: z.array(PlanDiffOperationChangeSchema).default([]),
  unplannedOperations: z.array(z.object({
    operationId: IdSchema,
    requirementId: IdSchema,
    reason: z.string().min(1)
  })).default([]),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() })).default([])
})

export const PlanDiffBatchSchema = z.object({
  id: IdSchema,
  diffs: z.array(PlanDiffSchema)
})

export const ScenarioSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  fromPlanId: IdSchema,
  state: z.enum(['open', 'committed', 'discarded']).default('open'),
  createdAt: IsoDateTimeSchema,
  ruleIds: z.array(IdSchema).default([]),
  candidates: z.array(PlanSchema).default([]),
  committedPlanId: IdSchema.optional()
})
