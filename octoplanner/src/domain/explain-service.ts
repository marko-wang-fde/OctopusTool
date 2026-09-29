import type { Plan, Rule, Scenario } from './types'

export function explainPlan(plan: Plan): Record<string, unknown> {
  return { subject: { kind: 'plan', id: plan.id }, summary: `Plan ${plan.name} has ${plan.scheduledOperations.length} scheduled operations.`, factors: [{ kind: 'metrics', effect: plan.metrics }], warnings: plan.warnings, notModeled: plan.notModeled }
}

export function explainRequirement(plan: Plan, id: string): Record<string, unknown> {
  const operations = plan.scheduledOperations.filter((op) => op.requirementId === id)
  return { subject: { kind: 'requirement', id }, summary: `Requirement ${id} has ${operations.length} scheduled operations.`, factors: operations.map((op) => ({ kind: 'operation', id: op.operationId, effect: `scheduled on ${op.resourceId}` })), warnings: [], notModeled: plan.notModeled }
}

export function explainOperation(plan: Plan, id: string): Record<string, unknown> {
  const op = plan.scheduledOperations.find((item) => item.operationId === id)
  return { subject: { kind: 'operation', id }, summary: op ? `Operation ${id} runs on ${op.resourceId}.` : `Operation ${id} is not scheduled.`, factors: op ? [{ kind: 'resource', id: op.resourceId, effect: `${op.startAt} to ${op.endAt}` }] : [], warnings: [], notModeled: plan.notModeled }
}

export function explainResource(plan: Plan, id: string): Record<string, unknown> {
  const operations = plan.scheduledOperations.filter((op) => op.resourceId === id)
  return { subject: { kind: 'resource', id }, summary: `Resource ${id} has ${operations.length} scheduled operations.`, factors: operations.map((op) => ({ kind: 'operation', id: op.operationId, effect: `${op.startAt} to ${op.endAt}` })), warnings: [], notModeled: plan.notModeled }
}

export function explainRule(rule: Rule): Record<string, unknown> {
  return { subject: { kind: 'rule', id: rule.id }, summary: `Rule ${rule.id} applies ${rule.type} to ${rule.target.kind}:${rule.target.id}.`, factors: [{ kind: 'target', effect: rule.target }], warnings: [], notModeled: [] }
}

export function explainScenario(scenario: Scenario): Record<string, unknown> {
  return { subject: { kind: 'scenario', id: scenario.id }, summary: `Scenario ${scenario.name} has ${scenario.candidates.length} candidates.`, factors: scenario.candidates.map((candidate) => ({ kind: 'plan', id: candidate.id, effect: candidate.metrics })), warnings: [], notModeled: [] }
}
