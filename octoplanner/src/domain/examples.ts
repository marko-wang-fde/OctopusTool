export const RequirementBatchExample = {
  id: 'req_batch_example',
  requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 10, dueAt: '2026-03-12T00:00:00.000Z', priority: 10 }]
}

export const ItemBatchExample = {
  id: 'item_batch_example',
  items: [{ id: 'ITEM-1', name: 'Example Item', setupGroup: 'valve-body', materialShape: 'round-bar' }]
}

export const RoutingBatchExample = {
  id: 'routing_batch_example',
  routings: [{
    itemId: 'ITEM-1',
    operations: [
      { id: 'op10', sequence: 10, name: 'Turning', durationMinutes: 60, eligibleResourceIds: ['R1'] },
      { id: 'op20', sequence: 20, name: 'Drilling', durationMinutes: 30, eligibleResourceIds: ['R1'] }
    ]
  }]
}

export const ResourceBatchExample = {
  id: 'resource_batch_example',
  resources: [{ id: 'R1', name: 'S-43' }]
}

export const SupplyBatchExample = {
  id: 'supply_batch_example',
  supplies: [{ id: 'SUP-1', itemId: 'ITEM-1', quantity: 10, availableAt: '2026-03-01T00:00:00.000Z' }]
}

export const RuleBatchExample = {
  id: 'rule_batch_example',
  rules: [{ id: 'RULE-1', type: 'not-start-until', target: { kind: 'requirement', id: 'REQ-1' }, until: '2026-03-12T00:00:00.000Z', enabled: true }]
}

export const RevisionBatchExample = {
  id: 'revision_batch_example',
  revisions: [{
    id: 'REV-1',
    instruction: 'Schedule REQ-1 as an urgent insertion while preserving other resource order where possible.',
    fromPlanId: 'plan_example',
    policy: {
      mode: 'repair',
      preserveResourceOrder: 'best-effort',
      preserveLockedOperations: true,
      moveScope: 'impacted-only'
    },
    rules: [{ id: 'RULE-URGENT-REQ-1', type: 'priority-boost', target: { kind: 'requirement', id: 'REQ-1' }, priority: 10000, enabled: true }]
  }]
}

export const CaseExample = {
  id: 'case_example',
  name: 'Example Case',
  modelBatchIds: { requirement: 'req_batch_example', item: 'item_batch_example', routing: 'routing_batch_example', resource: 'resource_batch_example', supply: 'supply_batch_example' },
  ruleIds: ['RULE-1'],
  createdAt: '2026-03-01T00:00:00.000Z'
}

export const PlanExample = {
  id: 'plan_example',
  name: 'Example Plan',
  caseId: 'case_example',
  state: 'active',
  createdAt: '2026-03-01T00:00:00.000Z',
  scheduledOperations: [],
  unplannedOperations: [],
  metrics: {},
  appliedRuleIds: [],
  warnings: [],
  notModeled: []
}

export const PlanDiffExample = {
  id: 'diff_example',
  fromPlanId: 'plan_before',
  toPlanId: 'plan_after',
  createdAt: '2026-03-01T00:00:00.000Z',
  summary: {
    added: 0,
    removed: 0,
    moved: 1,
    unchanged: 0,
    unplanned: 0
  },
  movedOperations: [{
    operationId: 'REQ-1:op10',
    requirementId: 'REQ-1',
    resourceIdBefore: 'R1',
    resourceIdAfter: 'R1',
    startBefore: '2026-03-01T00:00:00.000Z',
    endBefore: '2026-03-01T01:00:00.000Z',
    startAfter: '2026-03-01T02:00:00.000Z',
    endAfter: '2026-03-01T03:00:00.000Z',
    reasonRuleIds: ['RULE-URGENT-REQ-1'],
    externalRef: { system: 'xlsx', id: '段友!6' }
  }],
  addedOperations: [],
  removedOperations: [],
  unchangedOperations: [],
  unplannedOperations: [],
  warnings: []
}

export const ScenarioExample = {
  id: 'scenario_example',
  name: 'Example Scenario',
  fromPlanId: 'plan_example',
  state: 'open',
  createdAt: '2026-03-01T00:00:00.000Z',
  ruleIds: [],
  candidates: []
}
