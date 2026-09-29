import type { Requirement, Rule } from '../domain/types'

export function enabledRules(rules: Rule[], now: string): Rule[] {
  return rules.filter((rule) => rule.enabled !== false && (!rule.expiresAt || rule.expiresAt > now))
}

export function notStartUntilForRequirement(rules: Rule[], requirementId: string): string | undefined {
  return rules
    .filter((rule) => rule.type === 'not-start-until' && rule.target.kind === 'requirement' && rule.target.id === requirementId && rule.until)
    .map((rule) => rule.until!)
    .sort()
    .at(-1)
}

export function resourceUnavailableWindows(rules: Rule[], resourceId: string): Array<{ from: string; to: string }> {
  return rules
    .filter((rule) => rule.type === 'resource-unavailable' && rule.target.kind === 'resource' && rule.target.id === resourceId && rule.from && rule.to)
    .map((rule) => ({ from: rule.from!, to: rule.to! }))
}

export function isLockedOperation(rules: Rule[], operationId: string, requirementId: string): boolean {
  return rules.some((rule) =>
    (rule.type === 'lock-operation' && rule.target.kind === 'operation' && rule.target.id === operationId)
    || (rule.type === 'lock-requirement' && rule.target.kind === 'requirement' && rule.target.id === requirementId)
  )
}

export function priorityForRequirement(rules: Rule[], requirement: Requirement): number {
  const base = requirement.priority ?? 0
  const boosts = rules
    .filter((rule) =>
      rule.type === 'priority-boost'
      && rule.priority !== undefined
      && (
        (rule.target.kind === 'requirement' && rule.target.id === requirement.id)
        || (rule.target.kind === 'item' && rule.target.id === requirement.itemId)
      )
    )
    .map((rule) => rule.priority!)
  return Math.max(base, ...boosts)
}

export function requirementOrderingEdges(rules: Rule[]): Array<{ before: string; after: string; ruleId: string }> {
  const edges: Array<{ before: string; after: string; ruleId: string }> = []
  for (const rule of rules) {
    if (!rule.relatedTarget || rule.target.kind !== 'requirement' || rule.relatedTarget.kind !== 'requirement') continue
    if (rule.type === 'must-run-before') edges.push({ before: rule.target.id, after: rule.relatedTarget.id, ruleId: rule.id })
    if (rule.type === 'must-run-after') edges.push({ before: rule.relatedTarget.id, after: rule.target.id, ruleId: rule.id })
  }
  return edges
}
