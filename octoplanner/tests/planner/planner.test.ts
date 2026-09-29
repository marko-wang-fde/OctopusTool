import { describe, expect, it } from 'vitest'
import { diffPlans } from '../../src/domain/plan-service'
import { createPlanFromCase } from '../../src/planner/schedule'
import type { Plan } from '../../src/domain/types'

describe('planner engine', () => {
  it('creates deterministic operation schedule with precedence and resource no-overlap', () => {
    const plan = createPlanFromCase({
      requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 1, dueAt: '2026-03-12T00:00:00.000Z' }],
      items: [{ id: 'ITEM-1', name: 'Item 1' }],
      routings: [{
        itemId: 'ITEM-1',
        operations: [
          { id: 'op10', sequence: 10, name: 'A', durationMinutes: 60, eligibleResourceIds: ['R1'] },
          { id: 'op20', sequence: 20, name: 'B', durationMinutes: 60, eligibleResourceIds: ['R1'] }
        ]
      }],
      resources: [{ id: 'R1', name: 'Machine 1' }],
      supplies: [],
      rules: []
    }, { now: '2026-03-01T08:00:00.000Z', mode: 'create', name: 'test-plan' })

    expect(plan.scheduledOperations).toHaveLength(2)
    expect(plan.scheduledOperations[1]!.startAt >= plan.scheduledOperations[0]!.endAt).toBe(true)
  })

  it('creates structured plan diffs with external references', () => {
    const left: Plan = {
      id: 'PLAN-LEFT',
      name: 'Before',
      state: 'active',
      createdAt: '2026-06-05T00:00:00.000Z',
      scheduledOperations: [
        operation('OP-MOVED', 'REQ-1', 'RES-1', '2026-06-05T00:00:00.000Z', '2026-06-06T00:00:00.000Z', { system: 'xlsx', id: '段友!6-before' }),
        operation('OP-SAME', 'REQ-2', 'RES-1', '2026-06-06T00:00:00.000Z', '2026-06-07T00:00:00.000Z'),
        operation('OP-REMOVED', 'REQ-3', 'RES-2', '2026-06-07T00:00:00.000Z', '2026-06-08T00:00:00.000Z')
      ],
      unplannedOperations: [],
      metrics: {},
      appliedRuleIds: [],
      warnings: [],
      notModeled: []
    }
    const right: Plan = {
      ...left,
      id: 'PLAN-RIGHT',
      name: 'After',
      scheduledOperations: [
        operation('OP-MOVED', 'REQ-1', 'RES-1', '2026-06-08T00:00:00.000Z', '2026-06-09T00:00:00.000Z', { system: 'xlsx', id: '段友!6' }),
        operation('OP-SAME', 'REQ-2', 'RES-1', '2026-06-06T00:00:00.000Z', '2026-06-07T00:00:00.000Z'),
        operation('OP-ADDED', 'REQ-4', 'RES-3', '2026-06-09T00:00:00.000Z', '2026-06-10T00:00:00.000Z')
      ],
      unplannedOperations: [{ operationId: 'OP-UNPLANNED', requirementId: 'REQ-5', reason: 'NO_FEASIBLE_SLOT' }],
      appliedRuleIds: ['RULE-PRIORITY-REQ-1']
    }

    const diff = diffPlans(left, right)

    expect(diff.summary).toMatchObject({ added: 1, removed: 1, moved: 1, unchanged: 1, unplanned: 1 })
    expect(diff.movedOperations[0]).toMatchObject({
      operationId: 'OP-MOVED',
      requirementId: 'REQ-1',
      resourceIdBefore: 'RES-1',
      resourceIdAfter: 'RES-1',
      startBefore: '2026-06-05T00:00:00.000Z',
      startAfter: '2026-06-08T00:00:00.000Z',
      reasonRuleIds: ['RULE-PRIORITY-REQ-1'],
      externalRef: { system: 'xlsx', id: '段友!6' }
    })
    expect(diff.addedOperations[0]?.operationId).toBe('OP-ADDED')
    expect(diff.removedOperations[0]?.operationId).toBe('OP-REMOVED')
    expect(diff.unchangedOperations[0]?.operationId).toBe('OP-SAME')
  })

  it('uses priority-boost rules when sorting requirements', () => {
    const plan = createPlanFromCase(twoRequirementCase([{
      id: 'RULE-URGENT',
      type: 'priority-boost',
      target: { kind: 'requirement', id: 'REQ-B' },
      priority: 1000,
      enabled: true
    }]), { now: '2026-03-01T08:00:00.000Z', mode: 'create', name: 'priority-test' })

    expect(plan.scheduledOperations[0]?.requirementId).toBe('REQ-B')
  })

  it('uses must-run-before requirement rules when sorting requirements', () => {
    const plan = createPlanFromCase(twoRequirementCase([{
      id: 'RULE-B-BEFORE-A',
      type: 'must-run-before',
      target: { kind: 'requirement', id: 'REQ-B' },
      relatedTarget: { kind: 'requirement', id: 'REQ-A' },
      enabled: true
    }]), { now: '2026-03-01T08:00:00.000Z', mode: 'create', name: 'before-test' })

    expect(plan.scheduledOperations[0]?.requirementId).toBe('REQ-B')
  })

  it('uses must-run-after requirement rules when sorting requirements', () => {
    const plan = createPlanFromCase(twoRequirementCase([{
      id: 'RULE-A-AFTER-B',
      type: 'must-run-after',
      target: { kind: 'requirement', id: 'REQ-A' },
      relatedTarget: { kind: 'requirement', id: 'REQ-B' },
      enabled: true
    }]), { now: '2026-03-01T08:00:00.000Z', mode: 'create', name: 'after-test' })

    expect(plan.scheduledOperations[0]?.requirementId).toBe('REQ-B')
  })

  it('marks locked operations and requirements from rules', () => {
    const plan = createPlanFromCase(twoRequirementCase([
      {
        id: 'RULE-LOCK-OP',
        type: 'lock-operation',
        target: { kind: 'operation', id: 'REQ-A:op10' },
        enabled: true
      },
      {
        id: 'RULE-LOCK-REQ',
        type: 'lock-requirement',
        target: { kind: 'requirement', id: 'REQ-B' },
        enabled: true
      }
    ]), { now: '2026-03-01T08:00:00.000Z', mode: 'create', name: 'lock-test' })

    expect(plan.scheduledOperations.find((op) => op.operationId === 'REQ-A:op10')?.locked).toBe(true)
    expect(plan.scheduledOperations.find((op) => op.operationId === 'REQ-B:op10')?.locked).toBe(true)
  })

  it('preserves baseline placements in repair mode when no rescheduling rule exists', () => {
    const baseline = baselinePlan([
      operation('REQ-A:op10', 'REQ-A', 'R1', '2026-03-03T08:00:00.000Z', '2026-03-03T09:00:00.000Z', { system: 'xlsx', id: '段友!3' }),
      operation('REQ-B:op10', 'REQ-B', 'R1', '2026-03-03T09:00:00.000Z', '2026-03-03T10:00:00.000Z', { system: 'xlsx', id: '段友!4' })
    ])

    const repaired = createPlanFromCase(twoRequirementCase(), {
      now: '2026-03-01T08:00:00.000Z',
      mode: 'repair',
      name: 'repair-no-rules',
      baseline
    })

    expect(repaired.baselinePlanId).toBe('PLAN-BASELINE')
    expect(repaired.scheduledOperations.map((op) => op.startAt)).toEqual([
      '2026-03-03T08:00:00.000Z',
      '2026-03-03T09:00:00.000Z'
    ])
    expect(repaired.scheduledOperations[0]?.externalRef?.id).toBe('段友!3')
    expect(repaired.metrics.movedOperations).toBe(0)
  })

  it('repairs from a baseline by prioritizing urgent requirements and preserving later queue order', () => {
    const baseline = baselinePlan([
      operation('REQ-A:op10', 'REQ-A', 'R1', '2026-03-03T08:00:00.000Z', '2026-03-03T09:00:00.000Z', { system: 'xlsx', id: '段友!3' }),
      operation('REQ-B:op10', 'REQ-B', 'R1', '2026-03-03T09:00:00.000Z', '2026-03-03T10:00:00.000Z', { system: 'xlsx', id: '段友!4' })
    ])

    const repaired = createPlanFromCase(twoRequirementCase([{
      id: 'RULE-URGENT-B',
      type: 'priority-boost',
      target: { kind: 'requirement', id: 'REQ-B' },
      priority: 1000,
      enabled: true
    }]), {
      now: '2026-03-03T08:00:00.000Z',
      mode: 'repair',
      name: 'repair-urgent',
      baseline
    })

    expect(repaired.scheduledOperations.map((op) => op.operationId)).toEqual(['REQ-B:op10', 'REQ-A:op10'])
    expect(repaired.scheduledOperations.map((op) => op.startAt)).toEqual([
      '2026-03-03T08:00:00.000Z',
      '2026-03-03T09:00:00.000Z'
    ])
    expect(repaired.scheduledOperations.find((op) => op.operationId === 'REQ-B:op10')?.externalRef?.id).toBe('段友!4')
    expect(repaired.metrics.movedOperations).toBe(2)
  })

  it('does not move locked baseline operations during repair', () => {
    const baseline = baselinePlan([
      operation('REQ-A:op10', 'REQ-A', 'R1', '2026-03-03T08:00:00.000Z', '2026-03-03T09:00:00.000Z'),
      operation('REQ-B:op10', 'REQ-B', 'R1', '2026-03-03T09:00:00.000Z', '2026-03-03T10:00:00.000Z')
    ])

    const repaired = createPlanFromCase(twoRequirementCase([
      {
        id: 'RULE-LOCK-A',
        type: 'lock-operation',
        target: { kind: 'operation', id: 'REQ-A:op10' },
        enabled: true
      },
      {
        id: 'RULE-URGENT-B',
        type: 'priority-boost',
        target: { kind: 'requirement', id: 'REQ-B' },
        priority: 1000,
        enabled: true
      }
    ]), {
      now: '2026-03-03T08:00:00.000Z',
      mode: 'repair',
      name: 'repair-locked',
      baseline
    })

    expect(repaired.scheduledOperations.find((op) => op.operationId === 'REQ-A:op10')).toMatchObject({
      startAt: '2026-03-03T08:00:00.000Z',
      endAt: '2026-03-03T09:00:00.000Z',
      locked: true
    })
    expect(repaired.scheduledOperations.find((op) => op.operationId === 'REQ-B:op10')?.startAt).toBe('2026-03-03T09:00:00.000Z')
  })
})

function twoRequirementCase(rules: any[] = []) {
  return {
    requirements: [
      { id: 'REQ-A', itemId: 'ITEM-A', quantity: 1, priority: 10 },
      { id: 'REQ-B', itemId: 'ITEM-B', quantity: 1, priority: 1 }
    ],
    items: [
      { id: 'ITEM-A', name: 'Item A' },
      { id: 'ITEM-B', name: 'Item B' }
    ],
    routings: [
      { itemId: 'ITEM-A', operations: [{ id: 'op10', sequence: 10, name: 'A', durationMinutes: 60, eligibleResourceIds: ['R1'] }] },
      { itemId: 'ITEM-B', operations: [{ id: 'op10', sequence: 10, name: 'B', durationMinutes: 60, eligibleResourceIds: ['R1'] }] }
    ],
    resources: [{ id: 'R1', name: 'Machine 1' }],
    supplies: [],
    rules
  }
}

function operation(
  operationId: string,
  requirementId: string,
  resourceId: string,
  startAt: string,
  endAt: string,
  externalRef?: { system: string; id: string }
): Plan['scheduledOperations'][number] {
  return {
    operationId,
    requirementId,
    itemId: `ITEM-${requirementId}`,
    routingOperationId: operationId,
    resourceId,
    startAt,
    endAt,
    locked: false,
    labels: {},
    ...(externalRef ? { externalRef } : {})
  }
}

function baselinePlan(scheduledOperations: Plan['scheduledOperations']): Plan {
  return {
    id: 'PLAN-BASELINE',
    name: 'Baseline',
    state: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
    scheduledOperations,
    unplannedOperations: [],
    metrics: {},
    appliedRuleIds: [],
    warnings: [],
    notModeled: []
  }
}
