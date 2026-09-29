import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'
import { parseReportLocale } from '../../src/report/locale'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

function tempWorkspace(): string {
  dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-report-'))
  return dir
}

function envelope(stdout: string) {
  return JSON.parse(stdout)
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

describe('report command', () => {
  it('defaults report locale to zh-CN', () => {
    expect(parseReportLocale(undefined)).toBe('zh-CN')
  })

  it('accepts supported report locales', () => {
    expect(parseReportLocale('zh-CN')).toBe('zh-CN')
    expect(parseReportLocale('en-US')).toBe('en-US')
  })

  it('fastfails unsupported report locales', async () => {
    const result = await runCli(['report', 'output', '--format', 'html', '--lang', 'fr-FR', '--plan', 'march-plan', 'plan-overview'], { cwd: tempWorkspace(), env: {} })

    expect(result.exitCode).toBe(2)
    expect(envelope(result.stderr)).toMatchObject({
      ok: false,
      error: { code: 'UNSUPPORTED_LANGUAGE' }
    })
  })

  it('routes report output with explicit zh-CN locale', async () => {
    const cwd = tempWorkspace()
    await setupPlan(cwd)
    const out = path.join(cwd, 'report-zh.html')
    const result = await runCli(['report', 'output', '--format', 'html', '--lang', 'zh-CN', '--plan', 'march-plan', 'plan-overview', '--out', out], { cwd, env: {} })

    expect(result.exitCode).toBe(0)
    expect(envelope(result.stdout)).toMatchObject({
      ok: true,
      data: { locale: 'zh-CN', reportType: 'plan-overview', out }
    })
    expect(existsSync(out)).toBe(true)
    expect(readFileSync(out, 'utf8')).toContain('计划总览')
  })

  it('routes report output with explicit en-US locale', async () => {
    const cwd = tempWorkspace()
    await setupPlan(cwd)
    const result = await runCli(['report', 'output', '--format', 'html', '--lang', 'en-US', '--plan', 'march-plan', 'plan-overview'], { cwd, env: {} })

    expect(result.exitCode).toBe(0)
    expect(envelope(result.stdout)).toMatchObject({
      ok: true,
      data: { locale: 'en-US', reportType: 'plan-overview' }
    })
    expect(envelope(result.stdout).data.html).toContain('Plan overview')
  })

  it('routes report serve with locale and ephemeral port', async () => {
    const result = await runCli(['report', 'serve', '--lang', 'zh-CN', '--port', '0'], { cwd: tempWorkspace(), env: { OCTOPLANNER_REPORT_SERVE_DRY_RUN: '1' } })

    expect(result.exitCode).toBe(0)
    expect(envelope(result.stdout)).toMatchObject({
      ok: true,
      data: { action: 'serve', locale: 'zh-CN', host: '127.0.0.1', port: 0, dryRun: true }
    })
  })

  it('routes plan diff report output from diff json', async () => {
    const cwd = tempWorkspace()
    await setupPlan(cwd)
    const diffFile = path.join(cwd, 'diff.json')
    const out = path.join(cwd, 'diff.html')
    writeFileSync(diffFile, JSON.stringify({
      id: 'DIFF-1',
      fromPlanId: 'PLAN-1',
      toPlanId: 'PLAN-2',
      createdAt: '2026-06-05T00:00:00.000Z',
      summary: { added: 0, removed: 0, moved: 1, unchanged: 0, unplanned: 0 },
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
    }))

    const result = await runCli(['report', 'output', '--format', 'html', '--lang', 'zh-CN', '--diff', diffFile, 'plan-diff', '--out', out], { cwd, env: {} })

    expect(result.exitCode).toBe(0)
    expect(envelope(result.stdout).data).toMatchObject({ locale: 'zh-CN', reportType: 'plan-diff', out })
    expect(readFileSync(out, 'utf8')).toContain('计划差异')
  })

  it('fastfails unknown report actions', async () => {
    const result = await runCli(['report', 'unknown'], { cwd: tempWorkspace(), env: {} })

    expect(result.exitCode).toBe(2)
    expect(envelope(result.stderr)).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_COMMAND' }
    })
  })
})
