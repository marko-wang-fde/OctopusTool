import type { ReportMessages } from '../report/messages'
import type { ReportLocale } from '../report/locale'
import { comparePlans } from './plan-service'
import type {
  ExceptionReviewReport,
  PlanDiffReport,
  PlanOverviewReport,
  RequirementTraceReport,
  ResourceTimelineReport,
  RuleImpactReport,
  ScenarioCompareReport
} from './report-types'
import type { Plan, PlanDiff, Scenario, ScheduledOperation } from './types'

type ReportInput = {
  plan: Plan
  locale: ReportLocale
  messages: ReportMessages
}

type ScenarioReportInput = {
  scenario: Scenario
  baselinePlan?: Plan
  locale: ReportLocale
  messages: ReportMessages
}

function generatedAt(): string {
  return new Date().toISOString()
}

function sourceForPlan(plan: Plan) {
  return {
    id: plan.id,
    name: plan.name,
    state: plan.state,
    createdAt: plan.createdAt
  }
}

function byStartAt(left: ScheduledOperation, right: ScheduledOperation): number {
  const start = left.startAt.localeCompare(right.startAt)
  if (start !== 0) return start
  return left.operationId.localeCompare(right.operationId)
}

function baseForPlan(input: ReportInput, title: string) {
  return {
    title,
    locale: input.locale,
    generatedAt: generatedAt(),
    source: sourceForPlan(input.plan),
    warnings: input.plan.warnings,
    notModeled: input.plan.notModeled
  }
}

export function buildPlanOverviewReport(input: ReportInput): PlanOverviewReport {
  return {
    ...baseForPlan(input, input.messages.reportTitles.planOverview),
    reportType: 'plan-overview',
    metrics: input.plan.metrics,
    scheduledOperationCount: input.plan.scheduledOperations.length,
    unplannedOperations: input.plan.unplannedOperations,
    appliedRuleIds: input.plan.appliedRuleIds
  }
}

export function buildResourceTimelineReport(input: ReportInput): ResourceTimelineReport {
  const byResource = new Map<string, ScheduledOperation[]>()
  for (const operation of input.plan.scheduledOperations) {
    const operations = byResource.get(operation.resourceId) ?? []
    operations.push(operation)
    byResource.set(operation.resourceId, operations)
  }

  return {
    ...baseForPlan(input, input.messages.reportTitles.resourceTimeline),
    reportType: 'resource-timeline',
    resources: [...byResource.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resourceId, operations]) => {
        const sorted = [...operations].sort(byStartAt)
        return { resourceId, operationCount: sorted.length, operations: sorted }
      })
  }
}

export function buildRequirementTraceReport(input: ReportInput): RequirementTraceReport {
  const byRequirement = new Map<string, ScheduledOperation[]>()
  for (const operation of input.plan.scheduledOperations) {
    const operations = byRequirement.get(operation.requirementId) ?? []
    operations.push(operation)
    byRequirement.set(operation.requirementId, operations)
  }

  return {
    ...baseForPlan(input, input.messages.reportTitles.requirementTrace),
    reportType: 'requirement-trace',
    requirements: [...byRequirement.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([requirementId, operations]) => {
        const sorted = [...operations].sort(byStartAt)
        return {
          requirementId,
          itemId: sorted[0]?.itemId ?? '',
          operationCount: sorted.length,
          operations: sorted
        }
      })
  }
}

export function buildExceptionReviewReport(input: ReportInput): ExceptionReviewReport {
  return {
    ...baseForPlan(input, input.messages.reportTitles.exceptionReview),
    reportType: 'exception-review',
    exceptions: [
      ...input.plan.unplannedOperations.map((operation) => ({
        id: `unplanned:${operation.operationId}`,
        type: 'unplanned-operation' as const,
        severity: 'blocked' as const,
        requirementId: operation.requirementId,
        operationId: operation.operationId,
        reason: operation.reason,
        nextAction: input.messages.nextActions.inspectRouting
      })),
      ...input.plan.warnings.map((warning, index) => ({
        id: `warning:${warning.code}:${index}`,
        type: 'warning' as const,
        severity: 'warning' as const,
        reason: warning.message,
        nextAction: input.messages.nextActions.inspectWarning
      })),
      ...input.plan.notModeled.map((item, index) => ({
        id: `not-modeled:${index}`,
        type: 'not-modeled' as const,
        severity: 'info' as const,
        reason: item,
        nextAction: input.messages.nextActions.inspectModelingGap
      }))
    ]
  }
}

export function buildRuleImpactReport(input: ReportInput): RuleImpactReport {
  return {
    ...baseForPlan(input, input.messages.reportTitles.ruleImpact),
    reportType: 'rule-impact',
    appliedRuleIds: input.plan.appliedRuleIds
  }
}

export function buildPlanDiffReport(input: { diff: PlanDiff; locale: ReportLocale; messages: ReportMessages }): PlanDiffReport {
  return {
    reportType: 'plan-diff',
    title: input.messages.reportTitles.planDiff,
    locale: input.locale,
    generatedAt: generatedAt(),
    source: {
      id: input.diff.id,
      name: `${input.diff.fromPlanId} -> ${input.diff.toPlanId}`,
      createdAt: input.diff.createdAt
    },
    diff: input.diff,
    warnings: input.diff.warnings,
    notModeled: []
  }
}

export function buildScenarioCompareReport(input: ScenarioReportInput): ScenarioCompareReport {
  return {
    reportType: 'scenario-compare',
    title: input.messages.reportTitles.scenarioCompare,
    locale: input.locale,
    generatedAt: generatedAt(),
    scenario: {
      id: input.scenario.id,
      name: input.scenario.name,
      state: input.scenario.state,
      fromPlanId: input.scenario.fromPlanId
    },
    candidates: input.scenario.candidates.map((candidate) => ({
      planId: candidate.id,
      planName: candidate.name,
      comparison: input.baselinePlan ? comparePlans(input.baselinePlan, candidate) : { right: candidate.name }
    })),
    warnings: input.scenario.candidates.flatMap((candidate) => candidate.warnings),
    notModeled: [...new Set(input.scenario.candidates.flatMap((candidate) => candidate.notModeled))]
  }
}
