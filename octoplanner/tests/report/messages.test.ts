import { describe, expect, it } from 'vitest'
import { getReportMessages, reportMessages } from '../../src/report/messages'

function keysOf(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keysOf(child, prefix ? `${prefix}.${key}` : key))
}

describe('report messages', () => {
  it('returns zh-CN labels', () => {
    const messages = getReportMessages('zh-CN')

    expect(messages.navigation.plans).toBe('计划')
    expect(messages.reportTitles.planOverview).toBe('计划总览')
    expect(messages.tableHeaders.requirementId).toBe('需求')
    expect(messages.empty.noPlans).toBe('暂无计划')
  })

  it('returns en-US labels', () => {
    const messages = getReportMessages('en-US')

    expect(messages.navigation.plans).toBe('Plans')
    expect(messages.reportTitles.planOverview).toBe('Plan overview')
    expect(messages.tableHeaders.requirementId).toBe('Requirement')
    expect(messages.empty.noPlans).toBe('No plans')
  })

  it('keeps message keys aligned across supported locales', () => {
    const zhKeys = keysOf(reportMessages['zh-CN']).sort()
    const enKeys = keysOf(reportMessages['en-US']).sort()

    expect(enKeys).toEqual(zhKeys)
  })
})
