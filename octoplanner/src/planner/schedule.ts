import { createId, nowIso } from '../core/ids'
import { PlanSchema } from '../domain/schemas'
import type { Plan, Requirement, Resource, RevisionPolicy, Rule, ScheduledOperation } from '../domain/types'
import { enabledRules, isLockedOperation, notStartUntilForRequirement, priorityForRequirement, requirementOrderingEdges, resourceUnavailableWindows } from './constraints'
import { expandRequirements, type ExpandedOperation } from './expand'
import { addMinutes, computeMetrics } from './metrics'

export type MaterializedPlanningCase = {
  casePayload?: any
  requirements: Requirement[]
  items: any[]
  routings: any[]
  resources: Resource[]
  supplies: any[]
  rules: Rule[]
}

export function createPlanFromCase(input: MaterializedPlanningCase, options: { now?: string; mode?: 'create' | 'repair' | 'optimize'; name?: string; baseline?: Plan; moveScope?: RevisionPolicy['moveScope'] } = {}): Plan {
  const now = options.now ?? nowIso()
  const rules = enabledRules(input.rules, now)
  const baselineOrder = options.baseline ? baselineRequirementOrder(options.baseline) : undefined
  const sortedRequirements = sortRequirements(input.requirements, rules, baselineOrder)
  const expanded = expandRequirements(sortedRequirements, input.routings)
  const resourceIds = input.resources.map((resource) => resource.id)
  const cursors = new Map(resourceIds.map((id) => [id, now]))
  const previousRequirementEnd = new Map<string, string>()
  const scheduledOperations: Plan['scheduledOperations'] = []
  const unplannedOperations = [...expanded.unplanned]
  const baselineByOperation = new Map((options.baseline?.scheduledOperations ?? []).map((op) => [op.operationId, op]))

  if (options.baseline && (options.mode === 'repair' || options.mode === 'optimize') && !hasReschedulingRules(rules)) {
    const scheduledOperations = options.baseline.scheduledOperations.map((operation) => ({
      ...operation,
      locked: isLockedOperation(rules, operation.operationId, operation.requirementId) || operation.locked
    }))
    const candidate = basePlanCandidate(input, options, scheduledOperations, options.baseline.unplannedOperations, rules)
    return PlanSchema.parse(candidate)
  }

  const movableOperationIds = options.baseline && (options.mode === 'repair' || options.mode === 'optimize') && options.moveScope !== 'all' && options.moveScope !== 'all-open'
    ? impactedOperationIds(expanded.operations, options.baseline, rules, now)
    : new Set(expanded.operations.map((operation) => operation.operationId))

  if (options.baseline && (options.mode === 'repair' || options.mode === 'optimize')) {
    const expandedOperationIds = new Set(expanded.operations.map((operation) => operation.operationId))
    for (const baselineOperation of options.baseline.scheduledOperations) {
      if (!expandedOperationIds.has(baselineOperation.operationId)) continue
      const locked = isLockedOperation(rules, baselineOperation.operationId, baselineOperation.requirementId) || baselineOperation.locked
      const preserved = !movableOperationIds.has(baselineOperation.operationId)
      if (!locked && !preserved) continue
      scheduledOperations.push({ ...baselineOperation, locked })
      cursors.set(baselineOperation.resourceId, maxIso([cursors.get(baselineOperation.resourceId) ?? now, baselineOperation.endAt]))
      previousRequirementEnd.set(baselineOperation.requirementId, maxIso([previousRequirementEnd.get(baselineOperation.requirementId) ?? now, baselineOperation.endAt]))
    }
  }

  for (const operation of expanded.operations) {
    const baselineOperation = baselineByOperation.get(operation.operationId)
    if (scheduledOperations.some((scheduled) => scheduled.operationId === operation.operationId)) continue
    const candidates = operation.eligibleResourceIds.length > 0 ? operation.eligibleResourceIds : resourceIds
    if (candidates.length === 0) {
      unplannedOperations.push({ operationId: operation.operationId, requirementId: operation.requirementId, reason: 'RESOURCE_MISSING' })
      continue
    }
    let best: { resourceId: string; startAt: string; endAt: string } | undefined
    for (const resourceId of candidates) {
      let startAt = maxIso([cursors.get(resourceId) ?? now, previousRequirementEnd.get(operation.requirementId) ?? now, notStartUntilForRequirement(rules, operation.requirementId) ?? now])
      for (const window of resourceUnavailableWindows(rules, resourceId)) {
        const endAt = addMinutes(startAt, operation.durationMinutes!)
        if (startAt < window.to && endAt > window.from) startAt = window.to
      }
      const candidate = { resourceId, startAt, endAt: addMinutes(startAt, operation.durationMinutes!) }
      if (!best || candidate.endAt < best.endAt || (candidate.endAt === best.endAt && candidate.resourceId < best.resourceId)) best = candidate
    }
    if (!best) {
      unplannedOperations.push({ operationId: operation.operationId, requirementId: operation.requirementId, reason: 'NO_FEASIBLE_SLOT' })
      continue
    }
    cursors.set(best.resourceId, best.endAt)
    previousRequirementEnd.set(operation.requirementId, best.endAt)
    scheduledOperations.push({
      operationId: operation.operationId,
      requirementId: operation.requirementId,
      itemId: operation.itemId,
      routingOperationId: operation.routingOperationId,
      resourceId: best.resourceId,
      startAt: best.startAt,
      endAt: best.endAt,
      locked: isLockedOperation(rules, operation.operationId, operation.requirementId),
      labels: baselineOperation?.labels ?? {},
      ...(baselineOperation?.externalRef ? { externalRef: baselineOperation.externalRef } : {})
    })
  }

  return PlanSchema.parse(basePlanCandidate(input, options, scheduledOperations, unplannedOperations, rules))
}

function maxIso(values: string[]): string {
  return values.sort().at(-1) ?? values[0]!
}

function sortRequirements(requirements: Requirement[], rules: Rule[], baselineOrder = new Map<string, number>()): Requirement[] {
  const base = [...requirements].sort((a, b) =>
    priorityForRequirement(rules, b) - priorityForRequirement(rules, a)
    || (baselineOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (baselineOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    || (a.dueAt ?? '').localeCompare(b.dueAt ?? '')
    || a.id.localeCompare(b.id)
  )
  const baseIndex = new Map(base.map((requirement, index) => [requirement.id, index]))
  const requirementIds = new Set(base.map((requirement) => requirement.id))
  const edges = requirementOrderingEdges(rules).filter((edge) => requirementIds.has(edge.before) && requirementIds.has(edge.after))
  if (edges.length === 0) return base

  const outgoing = new Map<string, string[]>()
  const indegree = new Map(base.map((requirement) => [requirement.id, 0]))
  for (const edge of edges) {
    outgoing.set(edge.before, [...(outgoing.get(edge.before) ?? []), edge.after])
    indegree.set(edge.after, (indegree.get(edge.after) ?? 0) + 1)
  }

  const available = base.filter((requirement) => (indegree.get(requirement.id) ?? 0) === 0)
  const ordered: Requirement[] = []
  while (available.length > 0) {
    available.sort((a, b) => (baseIndex.get(a.id) ?? 0) - (baseIndex.get(b.id) ?? 0))
    const current = available.shift()!
    ordered.push(current)
    for (const nextId of outgoing.get(current.id) ?? []) {
      indegree.set(nextId, (indegree.get(nextId) ?? 0) - 1)
      if (indegree.get(nextId) === 0) {
        const next = base.find((requirement) => requirement.id === nextId)
        if (next) available.push(next)
      }
    }
  }

  return ordered.length === base.length ? ordered : base
}

function basePlanCandidate(
  input: MaterializedPlanningCase,
  options: { name?: string; baseline?: Plan },
  scheduledOperations: ScheduledOperation[],
  unplannedOperations: Plan['unplannedOperations'],
  rules: Rule[]
): unknown {
  const notModeled = [
    ...(input.supplies.length === 0 ? ['supply_availability'] : []),
    ...(!input.resources.some((resource) => resource.unavailableWindows) ? ['shift_calendar'] : []),
    ...(!input.items.some((item) => item.setupGroup) ? ['changeover_cost'] : [])
  ]
  return {
    id: createId('plan'),
    name: options.name ?? createId('plan_name'),
    caseId: input.casePayload?.id,
    baselinePlanId: options.baseline?.id,
    state: 'active',
    createdAt: nowIso(),
    scheduledOperations,
    unplannedOperations,
    metrics: computeMetrics({ requirements: input.requirements, scheduledOperations, unplannedOperations, ...(options.baseline ? { baseline: options.baseline } : {}) }),
    appliedRuleIds: rules.map((rule) => rule.id),
    warnings: [],
    notModeled
  }
}

function baselineRequirementOrder(baseline: Plan): Map<string, number> {
  const sorted = [...baseline.scheduledOperations].sort((a, b) => a.startAt.localeCompare(b.startAt) || a.operationId.localeCompare(b.operationId))
  const order = new Map<string, number>()
  for (const operation of sorted) {
    if (!order.has(operation.requirementId)) order.set(operation.requirementId, order.size)
  }
  return order
}

function hasReschedulingRules(rules: Rule[]): boolean {
  return rules.some((rule) => !['lock-operation', 'lock-requirement'].includes(rule.type))
}

function earliestImpactStart(rule: Rule, rules: Rule[], now: string): string {
  if (rule.target.kind === 'requirement' && (rule.type === 'priority-boost' || rule.type === 'must-run-before' || rule.type === 'must-run-after')) {
    return notStartUntilForRequirement(rules, rule.target.id) ?? now
  }
  return rule.until ?? rule.from ?? rule.after ?? now
}

function impactedOperationIds(expandedOperations: ExpandedOperation[], baseline: Plan, rules: Rule[], now: string): Set<string> {
  const baselineByOperation = new Map(baseline.scheduledOperations.map((operation) => [operation.operationId, operation]))
  const operationsByRequirement = groupBy(expandedOperations, (operation) => operation.requirementId)
  const requirementsByItem = groupBy(expandedOperations, (operation) => operation.itemId)
  const requirementMinSequence = new Map<string, number>()
  const impactedResourceStarts = new Map<string, string>()

  const markRequirement = (requirementId: string, earliest?: string) => {
    const operations = operationsByRequirement.get(requirementId) ?? []
    if (operations.length === 0) return
    const minSequence = Math.min(...operations.map((operation) => operation.sequence))
    markRequirementSequence(requirementMinSequence, requirementId, minSequence)
    for (const operation of operations) markOperationResourceStart(operation, baselineByOperation, impactedResourceStarts, earliest)
  }

  const markOperation = (operationId: string, earliest?: string) => {
    const operation = expandedOperations.find((candidate) => candidate.operationId === operationId)
    if (!operation) return
    markRequirementSequence(requirementMinSequence, operation.requirementId, operation.sequence)
    markOperationResourceStart(operation, baselineByOperation, impactedResourceStarts, earliest)
  }

  for (const rule of rules) {
    if (rule.type === 'lock-operation' || rule.type === 'lock-requirement') continue
    const earliest = earliestImpactStart(rule, rules, now)
    if (rule.target.kind === 'requirement') markRequirement(rule.target.id, earliest)
    if (rule.target.kind === 'operation') markOperation(rule.target.id, earliest)
    if (rule.target.kind === 'item') {
      for (const operation of requirementsByItem.get(rule.target.id) ?? []) markRequirement(operation.requirementId, earliest)
    }
    if (rule.target.kind === 'resource') {
      impactedResourceStarts.set(rule.target.id, minIso(impactedResourceStarts.get(rule.target.id), rule.from ?? now))
    }
    if ((rule.type === 'must-run-before' || rule.type === 'must-run-after') && rule.relatedTarget?.kind === 'requirement') {
      markRequirement(rule.relatedTarget.id, earliest)
    }
  }

  for (const operation of expandedOperations) {
    const baselineOperation = baselineByOperation.get(operation.operationId)
    if (!baselineOperation) {
      markRequirementSequence(requirementMinSequence, operation.requirementId, operation.sequence)
      continue
    }
    const impactStart = impactedResourceStarts.get(baselineOperation.resourceId)
    if (!impactStart) continue
    if (baselineOperation.startAt >= impactStart || baselineOperation.endAt > impactStart) {
      markRequirementSequence(requirementMinSequence, operation.requirementId, operation.sequence)
    }
  }

  const impacted = new Set<string>()
  for (const operation of expandedOperations) {
    const minSequence = requirementMinSequence.get(operation.requirementId)
    if (minSequence !== undefined && operation.sequence >= minSequence) impacted.add(operation.operationId)
  }
  return impacted
}

function markRequirementSequence(index: Map<string, number>, requirementId: string, sequence: number): void {
  index.set(requirementId, Math.min(index.get(requirementId) ?? Number.MAX_SAFE_INTEGER, sequence))
}

function markOperationResourceStart(
  operation: ExpandedOperation,
  baselineByOperation: Map<string, ScheduledOperation>,
  impactedResourceStarts: Map<string, string>,
  earliest?: string
): void {
  const baselineOperation = baselineByOperation.get(operation.operationId)
  if (!baselineOperation) return
  impactedResourceStarts.set(
    baselineOperation.resourceId,
    minIso(impactedResourceStarts.get(baselineOperation.resourceId), minIso(baselineOperation.startAt, earliest))
  )
}

function minIso(left?: string, right?: string): string {
  if (!left) return right ?? ''
  if (!right) return left
  return left < right ? left : right
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}
