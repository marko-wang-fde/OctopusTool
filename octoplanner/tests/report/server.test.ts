import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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
  dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-report-server-'))
  return dir
}

async function setup(cwd: string) {
  await runCli(['workspace', 'init'], { cwd, env: {} })
  await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd, env: {} })
  await runCli(['model', 'item', 'load', '--file', fixture('items.json')], { cwd, env: {} })
  await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd, env: {} })
  await runCli(['model', 'resource', 'load', '--file', fixture('resources.json')], { cwd, env: {} })
  await runCli(['case', 'create', '--name', 'march-case'], { cwd, env: {} })
  await runCli(['plan', 'create', '--case', 'march-case', '--name', 'march-plan'], { cwd, env: {} })
  await runCli(['scenario', 'create', '--from-plan', 'march-plan', '--name', 'delay'], { cwd, env: {} })
}

async function json(response: Response) {
  return JSON.parse(await response.text())
}

describe('report server api', () => {
  it('serves read-only report APIs with selected locale', async () => {
    const cwd = tempWorkspace()
    await setup(cwd)
    const server = createReportServer({ cwd, host: '127.0.0.1', port: 0, locale: 'en-US' })

    expect(await json(await server.fetch(new Request('http://local/api/config')))).toMatchObject({
      ok: true,
      data: { locale: 'en-US', supportedLocales: ['zh-CN', 'en-US'], readOnly: true }
    })
    expect(await json(await server.fetch(new Request('http://local/api/health')))).toMatchObject({ ok: true })
    expect(await json(await server.fetch(new Request('http://local/api/plans')))).toMatchObject({
      ok: true,
      data: { plans: [{ name: 'march-plan' }] }
    })
    expect(await json(await server.fetch(new Request('http://local/api/plans/march-plan/overview')))).toMatchObject({
      ok: true,
      data: { reportType: 'plan-overview', locale: 'en-US' }
    })
    expect(await json(await server.fetch(new Request('http://local/api/plans/march-plan/timeline')))).toMatchObject({
      ok: true,
      data: { reportType: 'resource-timeline', locale: 'en-US' }
    })
    expect(await json(await server.fetch(new Request('http://local/api/plans/march-plan/requirements')))).toMatchObject({
      ok: true,
      data: { reportType: 'requirement-trace', locale: 'en-US' }
    })
    expect(await json(await server.fetch(new Request('http://local/api/plans/march-plan/exceptions')))).toMatchObject({
      ok: true,
      data: { reportType: 'exception-review', locale: 'en-US' }
    })
    expect(await json(await server.fetch(new Request('http://local/api/plans/march-plan/rules')))).toMatchObject({
      ok: true,
      data: { reportType: 'rule-impact', locale: 'en-US' }
    })
    expect(await json(await server.fetch(new Request('http://local/api/scenarios')))).toMatchObject({
      ok: true,
      data: { scenarios: [{ name: 'delay' }] }
    })
    expect(await json(await server.fetch(new Request('http://local/api/scenarios/delay/compare')))).toMatchObject({
      ok: true,
      data: { reportType: 'scenario-compare', locale: 'en-US' }
    })

    const diffFile = path.join(cwd, 'diff.json')
    writeFileSync(diffFile, JSON.stringify({
      id: 'DIFF-1',
      fromPlanId: 'PLAN-1',
      toPlanId: 'PLAN-2',
      createdAt: '2026-06-05T00:00:00.000Z',
      summary: { added: 0, removed: 0, moved: 1, unchanged: 0, unplanned: 0 },
      movedOperations: [{ operationId: 'op-1', requirementId: 'REQ-1', reasonRuleIds: [] }],
      addedOperations: [],
      removedOperations: [],
      unchangedOperations: [],
      unplannedOperations: [],
      warnings: []
    }))
    expect(await json(await server.fetch(new Request(`http://local/api/diff?file=${encodeURIComponent(diffFile)}`)))).toMatchObject({
      ok: true,
      data: { reportType: 'plan-diff', locale: 'en-US' }
    })
  })

  it('rejects mutation methods', async () => {
    const cwd = tempWorkspace()
    await setup(cwd)
    const server = createReportServer({ cwd, host: '127.0.0.1', port: 0, locale: 'zh-CN' })

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const response = await server.fetch(new Request('http://local/api/plans', { method }))
      expect(response.status).toBe(405)
      expect(await json(response)).toMatchObject({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } })
    }
  })

  it('serves the built report web app and falls back for nested routes', async () => {
    const cwd = tempWorkspace()
    await setup(cwd)
    const webRoot = path.join(cwd, 'web')
    mkdirSync(path.join(webRoot, 'assets'), { recursive: true })
    writeFileSync(path.join(webRoot, 'index.html'), '<html><body>report app</body></html>')
    writeFileSync(path.join(webRoot, 'assets', 'app.js'), 'console.log("ok")')
    const server = createReportServer({ cwd, host: '127.0.0.1', port: 0, locale: 'zh-CN', webRoot })

    const index = await server.fetch(new Request('http://local/'))
    const nested = await server.fetch(new Request('http://local/plans/march-plan/timeline'))
    const asset = await server.fetch(new Request('http://local/assets/app.js'))

    expect(index.status).toBe(200)
    expect(await index.text()).toContain('report app')
    expect(nested.status).toBe(200)
    expect(await nested.text()).toContain('report app')
    expect(asset.headers.get('content-type')).toContain('javascript')
  })

  it('returns a clear error when web build is missing', async () => {
    const cwd = tempWorkspace()
    await setup(cwd)
    const server = createReportServer({ cwd, host: '127.0.0.1', port: 0, locale: 'zh-CN', webRoot: path.join(cwd, 'missing-web') })

    const response = await server.fetch(new Request('http://local/'))

    expect(response.status).toBe(503)
    expect(await json(response)).toMatchObject({ ok: false, error: { code: 'REPORT_WEB_BUILD_MISSING' } })
  })
})
