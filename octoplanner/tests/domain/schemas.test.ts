import { describe, expect, it } from 'vitest'
import { PlanDiffSchema, PlanSchema, RequirementBatchSchema, RevisionBatchSchema, RevisionSchema, RoutingBatchSchema, RuleSchema } from '../../src/domain/schemas'
import { SCHEMA_REGISTRY } from '../../src/domain/schema-registry'

describe('domain schemas', () => {
  it('validates requirement batches', () => {
    const parsed = RequirementBatchSchema.parse({
      id: 'req_batch_1',
      requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 10, dueAt: '2026-03-12T00:00:00.000Z' }]
    })
    expect(parsed.requirements[0]?.id).toBe('REQ-1')
  })

  it('rejects non-positive quantities', () => {
    expect(() => RequirementBatchSchema.parse({
      id: 'bad',
      requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 0 }]
    })).toThrow()
  })

  it('validates not-start-until rules', () => {
    const parsed = RuleSchema.parse({
      id: 'rule_1',
      type: 'not-start-until',
      target: { kind: 'requirement', id: 'REQ-1' },
      until: '2026-03-12T00:00:00.000Z',
      enabled: true
    })
    expect(parsed.type).toBe('not-start-until')
  })

  it('allows empty routing batches', () => {
    expect(() => RoutingBatchSchema.parse({ id: 'routing_batch_1', routings: [] })).not.toThrow()
  })

  it('registers public schemas', () => {
    expect(Object.keys(SCHEMA_REGISTRY)).toContain('model.requirement')
    expect(Object.keys(SCHEMA_REGISTRY)).toContain('rule')
    expect(Object.keys(SCHEMA_REGISTRY)).toContain('revision')
    expect(Object.keys(SCHEMA_REGISTRY)).toContain('plan-diff')
  })

  it('allows scheduled operations to carry external references', () => {
    const parsed = PlanSchema.parse({
      id: 'PLAN-1',
      name: 'Plan 1',
      state: 'active',
      createdAt: '2026-06-05T00:00:00.000Z',
      scheduledOperations: [{
        operationId: 'REQ-1:OP-10',
        requirementId: 'REQ-1',
        itemId: 'ITEM-1',
        routingOperationId: 'OP-10',
        resourceId: 'RES-1',
        startAt: '2026-06-05T00:00:00.000Z',
        endAt: '2026-06-06T00:00:00.000Z',
        locked: false,
        externalRef: { system: 'xlsx', id: '段友!6' }
      }],
      unplannedOperations: [],
      metrics: {},
      appliedRuleIds: [],
      warnings: [],
      notModeled: []
    })
    expect(parsed.scheduledOperations[0]?.externalRef?.id).toBe('段友!6')
  })

  it('validates revision payloads', () => {
    const parsed = RevisionSchema.parse({
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
    expect(parsed.policy?.preserveResourceOrder).toBe('best-effort')
  })

  it('validates revision batches', () => {
    const parsed = RevisionBatchSchema.parse({
      id: 'REV-BATCH-1',
      revisions: [{
        id: 'REV-1',
        instruction: 'Urgent insertion',
        rules: []
      }]
    })
    expect(parsed.revisions).toHaveLength(1)
  })

  it('validates plan diff payloads', () => {
    const parsed = PlanDiffSchema.parse({
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
    expect(parsed.summary.moved).toBe(1)
  })
})
