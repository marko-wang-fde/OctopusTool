export type Envelope<T> = {
  ok: true
  data: T
  warnings: Array<{ code: string; message: string }>
  notModeled: string[]
}

export type FailureEnvelope = {
  ok: false
  error: { code: string; message: string }
}

export type Config = {
  locale: 'zh-CN' | 'en-US'
  supportedLocales: Array<'zh-CN' | 'en-US'>
  readOnly: boolean
}

export type PlanListItem = {
  id: string
  name: string
  state: string
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
}

export type ExternalRef = {
  system: string
  id: string
  payload?: unknown
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
  reasonRuleIds: string[]
  externalRef?: ExternalRef
}

export type PlanOverviewReport = {
  reportType: 'plan-overview'
  title: string
  locale: string
  source: PlanListItem
  metrics: Record<string, unknown>
  scheduledOperationCount: number
  unplannedOperations: Array<{ operationId: string; requirementId: string; reason: string }>
  appliedRuleIds: string[]
  warnings: Array<{ code: string; message: string }>
  notModeled: string[]
}

export type ResourceTimelineReport = {
  reportType: 'resource-timeline'
  title: string
  resources: Array<{ resourceId: string; operationCount: number; operations: ScheduledOperation[] }>
}

export type RequirementTraceReport = {
  reportType: 'requirement-trace'
  title: string
  requirements: Array<{ requirementId: string; itemId: string; operationCount: number; operations: ScheduledOperation[] }>
}

export type ExceptionReviewReport = {
  reportType: 'exception-review'
  title: string
  exceptions: Array<{ id: string; type: string; severity: string; requirementId?: string; operationId?: string; reason: string; nextAction: string }>
}

export type RuleImpactReport = {
  reportType: 'rule-impact'
  title: string
  appliedRuleIds: string[]
}

export type PlanDiffReport = {
  reportType: 'plan-diff'
  title: string
  diff: {
    id: string
    fromPlanId: string
    toPlanId: string
    summary: { added: number; removed: number; moved: number; unchanged: number; unplanned: number }
    movedOperations: PlanDiffOperationChange[]
    addedOperations: PlanDiffOperationChange[]
    removedOperations: PlanDiffOperationChange[]
    unchangedOperations: PlanDiffOperationChange[]
    unplannedOperations: Array<{ operationId: string; requirementId: string; reason: string }>
  }
}

export type ScenarioListItem = {
  id: string
  name: string
  state: string
  fromPlanId: string
  createdAt: string
}

export type ScenarioCompareReport = {
  reportType: 'scenario-compare'
  title: string
  scenario: { id: string; name: string; state: string; fromPlanId: string }
  candidates: Array<{ planId: string; planName: string; comparison: Record<string, unknown> }>
}
