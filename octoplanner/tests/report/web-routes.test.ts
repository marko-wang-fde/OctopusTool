import { describe, expect, it } from 'vitest'
import { getMessages } from '../../src/report/web/src/lib/i18n'
import { parseRoute, planHref, scenarioHref } from '../../src/report/web/src/routes'

describe('report web routes', () => {
  it('parses report routes', () => {
    expect(parseRoute('/')).toEqual({ page: 'plans' })
    expect(parseRoute('/plans/march-plan')).toEqual({ page: 'overview', planId: 'march-plan' })
    expect(parseRoute('/plans/march-plan/timeline')).toEqual({ page: 'timeline', planId: 'march-plan' })
    expect(parseRoute('/scenarios/delay')).toEqual({ page: 'scenario', scenarioId: 'delay' })
    expect(parseRoute('/diff', '?file=%2Ftmp%2Fdiff.json')).toEqual({ page: 'diff', file: '/tmp/diff.json' })
  })

  it('builds encoded hrefs', () => {
    expect(planHref('march plan', 'exceptions')).toBe('/plans/march%20plan/exceptions')
    expect(scenarioHref('delay case')).toBe('/scenarios/delay%20case')
  })

  it('falls back to zh-CN messages', () => {
    expect(getMessages(undefined).plans).toBe('计划')
    expect(getMessages('en-US').plans).toBe('Plans')
  })
})
