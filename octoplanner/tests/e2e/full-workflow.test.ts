import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)
const urgentFixture = (name: string) => path.resolve('examples/revision-urgent-insert', name)

async function ok(argv: string[]) {
  const result = await runCli(argv, { cwd: dir!, env: {} })
  expect(result.exitCode, `${argv.join(' ')} stderr=${result.stderr}`).toBe(0)
  const body = JSON.parse(result.stdout)
  expect(body.ok, argv.join(' ')).toBe(true)
  return body
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('full octoplanner workflow', () => {
  it('runs end to end with JSON envelopes and audit logs', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await ok(['workspace', 'init'])
    await ok(['model', 'requirement', 'load', '--file', fixture('requirements.json')])
    await ok(['model', 'item', 'load', '--file', fixture('items.json')])
    await ok(['model', 'routing', 'load', '--file', fixture('routings.json')])
    await ok(['model', 'resource', 'load', '--file', fixture('resources.json')])
    await ok(['model', 'supply', 'load', '--file', fixture('supplies.json')])
    await ok(['rule', 'add', '--type', 'not-start-until', '--target', 'requirement:REQ-1', '--until', '2026-03-12T00:00:00.000Z'])
    await ok(['case', 'create', '--name', 'e2e-case'])
    await ok(['case', 'summary', '--case', 'e2e-case'])
    await ok(['plan', 'create', '--case', 'e2e-case', '--name', 'e2e-plan'])
    await ok(['impact', 'analyze', '--plan', 'e2e-plan', '--rule', 'latest'])
    await ok(['scenario', 'create', '--from-plan', 'e2e-plan', '--name', 'e2e-scenario'])
    await ok(['scenario', 'simulate', '--scenario', 'e2e-scenario', '--mode', 'repair'])
    await ok(['scenario', 'compare', '--scenario', 'e2e-scenario'])
    await ok(['scenario', 'commit', '--scenario', 'e2e-scenario', '--as-plan', 'e2e-plan-v2'])
    const out = path.join(dir, 'plan.json')
    await ok(['plan', 'export', '--plan', 'e2e-plan-v2', '--out', out])
    expect(existsSync(out)).toBe(true)
    await ok(['explain', 'requirement', '--plan', 'e2e-plan-v2', '--id', 'REQ-1'])
    const audit = await ok(['audit', 'log', '--limit', '20'])
    expect(audit.data.logs.length).toBeGreaterThan(0)
  })

  it('revises an urgent insertion baseline and exports diff report', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-urgent-'))
    await ok(['workspace', 'init'])
    await ok(['model', 'requirement', 'load', '--file', urgentFixture('requirements.json')])
    await ok(['model', 'item', 'load', '--file', urgentFixture('items.json')])
    await ok(['model', 'routing', 'load', '--file', urgentFixture('routings.json')])
    await ok(['model', 'resource', 'load', '--file', urgentFixture('resources.json')])
    await ok(['case', 'create', '--name', 'urgent-case'])
    await ok(['plan', 'load', '--file', urgentFixture('baseline-plan.json'), '--name', 'urgent-baseline'])

    const revised = await ok(['plan', 'revise', '--from-plan', 'urgent-baseline', '--name', 'urgent-after-601277344', '--revision', urgentFixture('revision.json')])
    const ss05 = revised.data.scheduledOperations
      .filter((operation: any) => operation.resourceId === 'RES-SS-05')
      .sort((left: any, right: any) => left.startAt.localeCompare(right.startAt))
    expect(ss05[0]).toMatchObject({
      requirementId: 'REQ-601277344',
      externalRef: { system: 'xlsx', id: '段友!7' }
    })
    expect(revised.data.scheduledOperations.find((operation: any) => operation.operationId === 'REQ-601277676:OP-930002-段友-4')).toMatchObject({
      startAt: '2026-06-06T00:00:00.000Z',
      endAt: '2026-06-11T00:00:00.000Z'
    })

    const diffOut = path.join(dir, 'diff.json')
    const diff = await ok(['plan', 'diff', '--from', 'urgent-baseline', '--to', 'urgent-after-601277344', '--out', diffOut])
    expect(existsSync(diffOut)).toBe(true)
    expect(diff.data.summary.moved).toBeGreaterThan(0)
    expect(diff.data.movedOperations.every((operation: any) => operation.externalRef)).toBe(true)

    const htmlOut = path.join(dir, 'diff.html')
    await ok(['report', 'output', '--format', 'html', '--lang', 'zh-CN', '--diff', diffOut, 'plan-diff', '--out', htmlOut])
    expect(existsSync(htmlOut)).toBe(true)
    expect(readFileSync(htmlOut, 'utf8')).toContain('计划差异')
  })
})
