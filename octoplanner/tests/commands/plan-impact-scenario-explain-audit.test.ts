import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

async function setup(cwd: string) {
  await runCli(['workspace', 'init'], { cwd, env: {} })
  await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd, env: {} })
  await runCli(['model', 'item', 'load', '--file', fixture('items.json')], { cwd, env: {} })
  await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd, env: {} })
  await runCli(['model', 'resource', 'load', '--file', fixture('resources.json')], { cwd, env: {} })
  await runCli(['case', 'create', '--name', 'march-case'], { cwd, env: {} })
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('plan, impact, scenario, explain, and audit commands', () => {
  it('runs the planning workflow', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await setup(dir)

    const plan = await runCli(['plan', 'create', '--case', 'march-case', '--name', 'march-plan'], { cwd: dir, env: {} })
    expect(plan.exitCode).toBe(0)
    expect(JSON.parse(plan.stdout).auditId).toBeTruthy()

    expect((await runCli(['plan', 'summary', '--plan', 'march-plan'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['plan', 'timeline', '--plan', 'march-plan'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['plan', 'metrics', '--plan', 'march-plan'], { cwd: dir, env: {} })).exitCode).toBe(0)

    const rule = await runCli(['rule', 'add', '--type', 'not-start-until', '--target', 'requirement:REQ-1', '--until', '2026-03-12T00:00:00.000Z'], { cwd: dir, env: {} })
    expect(rule.exitCode).toBe(0)

    const impact = await runCli(['impact', 'analyze', '--plan', 'march-plan', '--rule', 'latest'], { cwd: dir, env: {} })
    expect(JSON.parse(impact.stdout).data).toHaveProperty('affectedRequirements')

    const scenario = await runCli(['scenario', 'create', '--from-plan', 'march-plan', '--name', 'delay-req1'], { cwd: dir, env: {} })
    expect(scenario.exitCode).toBe(0)
    const simulated = await runCli(['scenario', 'simulate', '--scenario', 'delay-req1', '--mode', 'repair'], { cwd: dir, env: {} })
    expect(simulated.exitCode).toBe(0)
    expect(JSON.parse(simulated.stdout).data.candidates[0]).toMatchObject({
      baselinePlanId: JSON.parse(plan.stdout).data.id
    })
    expect(JSON.parse(simulated.stdout).data.candidates[0].unplannedOperations).toEqual([
      { operationId: 'REQ-2:routing', requirementId: 'REQ-2', reason: 'ROUTING_MISSING' }
    ])
    expect((await runCli(['scenario', 'compare', '--scenario', 'delay-req1'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['scenario', 'commit', '--scenario', 'delay-req1', '--as-plan', 'march-plan-v2'], { cwd: dir, env: {} })).exitCode).toBe(0)

    expect((await runCli(['explain', 'plan', '--plan', 'march-plan-v2'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['explain', 'requirement', '--plan', 'march-plan', '--id', 'REQ-1'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['audit', 'log', '--limit', '20'], { cwd: dir, env: {} })).exitCode).toBe(0)
  })

  it('revises a baseline plan and writes structured diffs', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await setup(dir)

    expect((await runCli(['plan', 'create', '--case', 'march-case', '--name', 'current'], { cwd: dir, env: {} })).exitCode).toBe(0)
    const revisionFile = path.join(dir, 'revision.json')
    writeFileSync(revisionFile, JSON.stringify({
      id: 'REV-REQ-2-URGENT',
      instruction: 'Make REQ-2 urgent',
      fromPlanId: 'current',
      policy: { mode: 'repair', preserveResourceOrder: 'best-effort', preserveLockedOperations: true, moveScope: 'impacted-only' },
      rules: [{
        id: 'RULE-URGENT-REQ-2',
        type: 'priority-boost',
        target: { kind: 'requirement', id: 'REQ-2' },
        priority: 1000,
        enabled: true
      }]
    }))

    const revised = await runCli(['plan', 'revise', '--from-plan', 'current', '--name', 'after-urgent', '--revision', revisionFile], { cwd: dir, env: {} })
    expect(revised.exitCode, revised.stderr).toBe(0)
    const revisedBody = JSON.parse(revised.stdout)
    expect(revisedBody.data.baselinePlanId).toBeTruthy()
    expect(revisedBody.data.appliedRuleIds).toContain('RULE-URGENT-REQ-2')

    const diffFile = path.join(dir, 'diff.json')
    const diff = await runCli(['plan', 'diff', '--from', 'current', '--to', 'after-urgent', '--out', diffFile], { cwd: dir, env: {} })
    expect(diff.exitCode, diff.stderr).toBe(0)
    const diffBody = JSON.parse(diff.stdout)
    expect(diffBody.data.summary).toHaveProperty('moved')
    expect(existsSync(diffFile)).toBe(true)
    expect(JSON.parse(readFileSync(diffFile, 'utf8')).summary).toEqual(diffBody.data.summary)
  })
})
