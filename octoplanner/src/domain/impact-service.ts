import type { Plan, Rule } from './types'

export function analyzeImpact(plan: Plan, rule?: Rule): Record<string, unknown> {
  const affectedOperations = rule
    ? plan.scheduledOperations.filter((op) => targetMatches(rule, op.requirementId, op.operationId, op.resourceId)).map((op) => op.operationId)
    : []
  const affectedRequirements = [...new Set(plan.scheduledOperations.filter((op) => affectedOperations.includes(op.operationId)).map((op) => op.requirementId))]
  const affectedResources = [...new Set(plan.scheduledOperations.filter((op) => affectedOperations.includes(op.operationId)).map((op) => op.resourceId))]
  return {
    affectedRequirements,
    affectedOperations,
    affectedResources,
    blockedChains: affectedRequirements.map((id) => ({ requirementId: id, operations: plan.scheduledOperations.filter((op) => op.requirementId === id).map((op) => op.operationId) })),
    candidatePullForwardOperations: plan.scheduledOperations.filter((op) => !affectedOperations.includes(op.operationId)).slice(0, 10).map((op) => op.operationId),
    disruptionEstimate: { movedOperations: affectedOperations.length },
    appliedRule: rule
  }
}

export function traceImpact(plan: Plan, target: string): Record<string, unknown> {
  const [, id] = target.split(':')
  const operations = plan.scheduledOperations.filter((op) => op.requirementId === id || op.operationId === id || op.resourceId === id)
  return { target, operations, reasons: operations.map((op) => ({ operationId: op.operationId, reason: 'related to target by requirement, operation, or resource id' })) }
}

function targetMatches(rule: Rule, requirementId: string, operationId: string, resourceId: string): boolean {
  if (rule.target.kind === 'requirement') return rule.target.id === requirementId
  if (rule.target.kind === 'operation') return rule.target.id === operationId
  if (rule.target.kind === 'resource') return rule.target.id === resourceId
  return false
}
