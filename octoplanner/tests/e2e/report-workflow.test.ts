import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'
import { createReportServer } from '../../src/report/server'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

function tempWorkspace(): string {
  dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-report-e2e-'))
  return dir
}

async function json(response: Response) {
  return JSON.parse(await response.text())
}

async function setupPlan(cwd: string) {
  await runCli(['workspace', 'init'], { cwd, env: {} })
  await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd, env: {} })
  await runCli(['model', 'item', 'load', '--file', fixture('items.json')], { cwd, env: {} })
  await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd, env: {} })
  await runCli(['model', 'resource', 'load', '--file', fixture('resources.json')], { cwd, env: {} })
  await runCli(['case', 'create', '--name', 'march-case'], { cwd, env: {} })
  await runCli(['plan', 'create', '--case', 'march-case', '--name', 'march-plan'], { cwd, env: {} })
  await runCli(['scenario', 'create', '--from-plan', 'march-plan', '--name', 'delay'], { cwd, env: {} })
}

describe('report workflow', () => {
  it('exports localized HTML and serves localized read-only APIs', async () => {
    const cwd = tempWorkspace()
    await setupPlan(cwd)
    const zhOut = path.join(cwd, 'report-zh.html')
    const enOut = path.join(cwd, 'report-en.html')

    const zh = await runCli(['report', 'output', '--format', 'html', '--lang', 'zh-CN', '--plan', 'march-plan', 'plan-overview', '--out', zhOut], { cwd, env: {} })
    const en = await runCli(['report', 'output', '--format', 'html', '--lang', 'en-US', '--plan', 'march-plan', 'exception-review', '--out', enOut], { cwd, env: {} })

    expect(zh.exitCode).toBe(0)
    expect(en.exitCode).toBe(0)
    expect(existsSync(zhOut)).toBe(true)
    expect(existsSync(enOut)).toBe(true)
    expect(readFileSync(zhOut, 'utf8')).toContain('计划总览')
    expect(readFileSync(enOut, 'utf8')).toContain('Exception review')

    const server = createReportServer({ cwd, host: '127.0.0.1', port: 0, locale: 'en-US' })
    expect(await json(await server.fetch(new Request('http://local/api/config')))).toMatchObject({
      ok: true,
      data: { locale: 'en-US', readOnly: true }
    })
    expect(await json(await server.fetch(new Request('http://local/api/plans/march-plan/overview')))).toMatchObject({
      ok: true,
      data: { reportType: 'plan-overview', locale: 'en-US' }
    })
    expect(await json(await server.fetch(new Request('http://local/api/scenarios/delay/compare')))).toMatchObject({
      ok: true,
      data: { reportType: 'scenario-compare', locale: 'en-US' }
    })
  })
})
