import { writeFileSync } from 'node:fs'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'
import { buildPlanDiffReport, buildPlanOverviewReport } from '../../src/domain/report-service'
import type { Plan, PlanDiff } from '../../src/domain/types'
import { renderReportHtml } from '../../src/report/html'
import { getReportMessages } from '../../src/report/messages'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

function tempWorkspace(): string {
  dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-report-html-'))
  return dir
}

async function setupPlan(cwd: string) {
  await runCli(['workspace', 'init'], { cwd, env: {} })
  await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd, env: {} })
  await runCli(['model', 'item', 'load', '--file', fixture('items.json')], { cwd, env: {} })
  await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd, env: {} })
  await runCli(['model', 'resource', 'load', '--file', fixture('resources.json')], { cwd, env: {} })
  await runCli(['case', 'create', '--name', 'march-case'], { cwd, env: {} })
  await runCli(['plan', 'create', '--case', 'march-case', '--name', 'march-plan'], { cwd, env: {} })
}

function envelope(stdout: string) {
  return JSON.parse(stdout)
}

describe('report html output', () => {
  it('escapes unsafe text', () => {
    const plan: Plan = {
      id: 'plan-1',
      name: '<script>alert(1)</script>',
      state: 'active',
      createdAt: '2026-03-01T00:00:00.000Z',
      scheduledOperations: [],
      unplannedOperations: [],
      metrics: {},
      appliedRuleIds: [],
      warnings: [],
      notModeled: ['<img src=x onerror=alert(1)>']
    }
    const report = buildPlanOverviewReport({ plan, locale: 'en-US', messages: getReportMessages('en-US') })
    const html = renderReportHtml(report, getReportMessages('en-US'))

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('writes zh-CN and en-US report files', async () => {
    const cwd = tempWorkspace()
    await setupPlan(cwd)
    const zhOut = path.join(cwd, 'zh.html')
    const enOut = path.join(cwd, 'en.html')

    const zh = await runCli(['report', 'output', '--format', 'html', '--lang', 'zh-CN', '--plan', 'march-plan', 'plan-overview', '--out', zhOut], { cwd, env: {} })
    const en = await runCli(['report', 'output', '--format', 'html', '--lang', 'en-US', '--plan', 'march-plan', 'plan-overview', '--out', enOut], { cwd, env: {} })

    expect(zh.exitCode).toBe(0)
    expect(en.exitCode).toBe(0)
    expect(readFileSync(zhOut, 'utf8')).toContain('计划总览')
    expect(readFileSync(enOut, 'utf8')).toContain('Plan overview')
    expect(envelope(zh.stdout).data).toMatchObject({ locale: 'zh-CN', reportType: 'plan-overview', out: zhOut })
  })

  it('fastfails missing plan for plan reports', async () => {
    const result = await runCli(['report', 'output', '--format', 'html', 'plan-overview'], { cwd: tempWorkspace(), env: {} })

    expect(result.exitCode).toBe(2)
    expect(envelope(result.stderr).error.code).toBe('ARGUMENT_REQUIRED')
  })

  it('fastfails missing scenario for scenario-compare', async () => {
    const result = await runCli(['report', 'output', '--format', 'html', 'scenario-compare'], { cwd: tempWorkspace(), env: {} })

    expect(result.exitCode).toBe(2)
    expect(envelope(result.stderr).error.code).toBe('ARGUMENT_REQUIRED')
  })

  it('fastfails unsupported format', async () => {
    const result = await runCli(['report', 'output', '--format', 'pdf', '--plan', 'march-plan', 'plan-overview'], { cwd: tempWorkspace(), env: {} })

    expect(result.exitCode).toBe(2)
    expect(envelope(result.stderr).error.code).toBe('UNSUPPORTED_FORMAT')
  })

  it('loads scenario compare reports', async () => {
    const cwd = tempWorkspace()
    await setupPlan(cwd)
    const scenarioFile = path.join(cwd, 'scenario.json')
    writeFileSync(scenarioFile, JSON.stringify({
      id: 'scenario-1',
      name: 'Scenario',
      fromPlanId: 'missing-baseline',
      state: 'open',
      createdAt: '2026-03-01T00:00:00.000Z',
      ruleIds: [],
      candidates: []
    }))

    const load = await runCli(['scenario', 'create', '--from-plan', 'march-plan', '--name', 'delay'], { cwd, env: {} })
    expect(load.exitCode).toBe(0)
    const result = await runCli(['report', 'output', '--format', 'html', '--scenario', 'delay', 'scenario-compare'], { cwd, env: {} })

    expect(result.exitCode).toBe(0)
    expect(envelope(result.stdout).data.html).toContain('场景对比')
  })

  it('renders plan diff reports with external references', () => {
    const diff: PlanDiff = {
      id: 'diff-1',
      fromPlanId: 'plan-1',
      toPlanId: 'plan-2',
      createdAt: '2026-06-05T00:00:00.000Z',
      summary: { added: 0, removed: 0, moved: 1, unchanged: 0, unplanned: 0 },
      movedOperations: [{
        operationId: 'op-1',
        requirementId: 'REQ-1',
        resourceIdBefore: 'R-1',
        resourceIdAfter: 'R-2',
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

    const html = renderReportHtml(buildPlanDiffReport({ diff, locale: 'zh-CN', messages: getReportMessages('zh-CN') }), getReportMessages('zh-CN'))

    expect(html).toContain('计划差异')
    expect(html).toContain('xlsx:段友!6')
  })
})
