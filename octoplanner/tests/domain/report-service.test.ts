import { describe, expect, it } from 'vitest'
import {
  buildExceptionReviewReport,
  buildPlanDiffReport,
  buildPlanOverviewReport,
  buildRequirementTraceReport,
  buildResourceTimelineReport,
  buildScenarioCompareReport
} from '../../src/domain/report-service'
import { getReportMessages } from '../../src/report/messages'
import type { Plan, PlanDiff, Scenario } from '../../src/domain/types'

const plan: Plan = {
  id: 'plan-1',
  name: 'March plan',
  caseId: 'case-1',
  state: 'active',
  createdAt: '2026-03-01T00:00:00.000Z',
  scheduledOperations: [
    {
      operationId: 'op-2',
      requirementId: 'REQ-2',
      itemId: 'ITEM-2',
      routingOperationId: 'turning',
      resourceId: 'R-1',
      startAt: '2026-03-02T10:00:00.000Z',
      endAt: '2026-03-02T11:00:00.000Z',
      locked: false
    },
    {
      operationId: 'op-1',
      requirementId: 'REQ-1',
      itemId: 'ITEM-1',
      routingOperationId: 'cutting',
      resourceId: 'R-1',
      startAt: '2026-03-02T08:00:00.000Z',
      endAt: '2026-03-02T09:00:00.000Z',
      locked: true
    },
    {
      operationId: 'op-3',
      requirementId: 'REQ-1',
      itemId: 'ITEM-1',
      routingOperationId: 'polishing',
      resourceId: 'R-2',
      startAt: '2026-03-02T12:00:00.000Z',
      endAt: '2026-03-02T13:00:00.000Z',
      locked: false
    }
  ],
  unplannedOperations: [{ operationId: 'op-4', requirementId: 'REQ-3', reason: 'missing routing duration' }],
  metrics: { scheduledOperationCount: 3, unplannedOperationCount: 1 },
  appliedRuleIds: ['rule-1'],
  warnings: [{ code: 'MODEL_GAP', message: 'Missing duration' }],
  notModeled: ['material setup transition']
}

describe('report service', () => {
  it('builds localized plan overview view model', () => {
    const report = buildPlanOverviewReport({ plan, locale: 'zh-CN', messages: getReportMessages('zh-CN') })

    expect(report).toMatchObject({
      reportType: 'plan-overview',
      locale: 'zh-CN',
      source: { id: 'plan-1', name: 'March plan', state: 'active' },
      metrics: { scheduledOperationCount: 3, unplannedOperationCount: 1 },
      appliedRuleIds: ['rule-1'],
      notModeled: ['material setup transition']
    })
    expect(report.title).toBe('计划总览')
    expect(report.unplannedOperations).toHaveLength(1)
  })

  it('groups resource timeline by resource and sorts operations by start time', () => {
    const report = buildResourceTimelineReport({ plan, locale: 'en-US', messages: getReportMessages('en-US') })

    expect(report.reportType).toBe('resource-timeline')
    expect(report.resources.map((resource) => resource.resourceId)).toEqual(['R-1', 'R-2'])
    expect(report.resources[0]!.operations.map((operation) => operation.operationId)).toEqual(['op-1', 'op-2'])
    expect(report.resources[0]!.operationCount).toBe(2)
  })

  it('groups requirement trace by requirement and sorts operations by start time', () => {
    const report = buildRequirementTraceReport({ plan, locale: 'en-US', messages: getReportMessages('en-US') })

    expect(report.reportType).toBe('requirement-trace')
    expect(report.requirements.map((requirement) => requirement.requirementId)).toEqual(['REQ-1', 'REQ-2'])
    expect(report.requirements[0]!.operations.map((operation) => operation.operationId)).toEqual(['op-1', 'op-3'])
  })

  it('builds localized exception review records', () => {
    const zh = buildExceptionReviewReport({ plan, locale: 'zh-CN', messages: getReportMessages('zh-CN') })
    const en = buildExceptionReviewReport({ plan, locale: 'en-US', messages: getReportMessages('en-US') })

    expect(zh.exceptions.map((item) => item.type)).toEqual(['unplanned-operation', 'warning', 'not-modeled'])
    expect(zh.exceptions[0]!).toMatchObject({
      severity: 'blocked',
      requirementId: 'REQ-3',
      nextAction: '检查工艺路线、资源候选或工时是否完整'
    })
    expect(en.exceptions[0]!.nextAction).toBe('Inspect routing, eligible resources, and duration data')
  })

  it('wraps scenario candidate comparisons', () => {
    const candidate: Plan = {
      ...plan,
      id: 'plan-2',
      name: 'Candidate',
      scheduledOperations: [{ ...plan.scheduledOperations[0]!, startAt: '2026-03-02T12:00:00.000Z' }]
    }
    const scenario: Scenario = {
      id: 'scenario-1',
      name: 'Repair',
      fromPlanId: plan.id,
      state: 'open',
      createdAt: '2026-03-01T00:00:00.000Z',
      ruleIds: ['rule-1'],
      candidates: [candidate]
    }

    const report = buildScenarioCompareReport({ scenario, baselinePlan: plan, locale: 'en-US', messages: getReportMessages('en-US') })

    expect(report.reportType).toBe('scenario-compare')
    expect(report.scenario).toMatchObject({ id: 'scenario-1', name: 'Repair' })
    expect(report.candidates[0]!.comparison).toMatchObject({
      left: 'March plan',
      right: 'Candidate',
      moved: ['op-2']
    })
  })

  it('builds localized plan diff reports', () => {
    const diff: PlanDiff = {
      id: 'diff-1',
      fromPlanId: 'plan-1',
      toPlanId: 'plan-2',
      createdAt: '2026-06-05T00:00:00.000Z',
      summary: { added: 0, removed: 0, moved: 1, unchanged: 1, unplanned: 0 },
      movedOperations: [{
        operationId: 'op-1',
        requirementId: 'REQ-1',
        resourceIdBefore: 'R-1',
        resourceIdAfter: 'R-1',
        startBefore: '2026-06-05T00:00:00.000Z',
        endBefore: '2026-06-06T00:00:00.000Z',
        startAfter: '2026-06-07T00:00:00.000Z',
        endAfter: '2026-06-08T00:00:00.000Z',
        reasonRuleIds: ['RULE-1'],
        externalRef: { system: 'xlsx', id: '段友!6' }
      }],
      addedOperations: [],
      removedOperations: [],
      unchangedOperations: [],
      unplannedOperations: [],
      warnings: []
    }

    const report = buildPlanDiffReport({ diff, locale: 'zh-CN', messages: getReportMessages('zh-CN') })

    expect(report.reportType).toBe('plan-diff')
    expect(report.title).toBe('计划差异')
    expect(report.diff.summary.moved).toBe(1)
  })
})
