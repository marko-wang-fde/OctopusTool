import type { ReportLocale } from '../report/locale'
import type { Plan, PlanDiff, ScheduledOperation } from './types'

export type ReportType =
  | 'plan-overview'
  | 'resource-timeline'
  | 'requirement-trace'
  | 'exception-review'
  | 'rule-impact'
  | 'plan-diff'
  | 'scenario-compare'

export type ReportSource = {
  id: string
  name: string
  state?: string
  createdAt?: string
}

export type BaseReport = {
  reportType: ReportType
  title: string
  locale: ReportLocale
  generatedAt: string
  source: ReportSource
  warnings: Plan['warnings']
  notModeled: string[]
}

export type PlanOverviewReport = BaseReport & {
  reportType: 'plan-overview'
  metrics: Record<string, unknown>
  scheduledOperationCount: number
  unplannedOperations: Plan['unplannedOperations']
  appliedRuleIds: string[]
}

export type ResourceTimelineReport = BaseReport & {
  reportType: 'resource-timeline'
  resources: Array<{
    resourceId: string
    operationCount: number
    operations: ScheduledOperation[]
  }>
}

export type RequirementTraceReport = BaseReport & {
  reportType: 'requirement-trace'
  requirements: Array<{
    requirementId: string
    itemId: string
    operationCount: number
    operations: ScheduledOperation[]
  }>
}

export type ExceptionRecord = {
  id: string
  type: 'unplanned-operation' | 'warning' | 'not-modeled'
  severity: 'blocked' | 'warning' | 'info'
  requirementId?: string
  operationId?: string
  reason: string
  nextAction: string
}

export type ExceptionReviewReport = BaseReport & {
  reportType: 'exception-review'
  exceptions: ExceptionRecord[]
}

export type RuleImpactReport = BaseReport & {
  reportType: 'rule-impact'
  appliedRuleIds: string[]
}

export type PlanDiffReport = {
  reportType: 'plan-diff'
  title: string
  locale: ReportLocale
  generatedAt: string
  source: ReportSource
  diff: PlanDiff
  warnings: PlanDiff['warnings']
  notModeled: string[]
}

export type ScenarioCompareReport = {
  reportType: 'scenario-compare'
  title: string
  locale: ReportLocale
  generatedAt: string
  scenario: {
    id: string
    name: string
    state: string
    fromPlanId: string
  }
  candidates: Array<{
    planId: string
    planName: string
    comparison: Record<string, unknown>
  }>
  warnings: Plan['warnings']
  notModeled: string[]
}

export type ReportViewModel =
  | PlanOverviewReport
  | ResourceTimelineReport
  | RequirementTraceReport
  | ExceptionReviewReport
  | RuleImpactReport
  | PlanDiffReport
  | ScenarioCompareReport
