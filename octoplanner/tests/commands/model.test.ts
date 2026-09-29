import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('model commands', () => {
  it('loads, lists, shows, validates, and summarizes requirements', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await runCli(['workspace', 'init'], { cwd: dir, env: {} })

    const load = await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd: dir, env: {} })
    expect(load.exitCode).toBe(0)

    const list = await runCli(['model', 'requirement', 'list'], { cwd: dir, env: {} })
    expect(JSON.parse(list.stdout).data.batches).toHaveLength(1)

    const summary = await runCli(['model', 'requirement', 'summary'], { cwd: dir, env: {} })
    expect(JSON.parse(summary.stdout).data.totalQuantity).toBeGreaterThan(0)
  })

  it('reports routing coverage gaps', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await runCli(['workspace', 'init'], { cwd: dir, env: {} })
    await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd: dir, env: {} })
    await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd: dir, env: {} })

    const coverage = await runCli(['model', 'routing', 'coverage'], { cwd: dir, env: {} })
    expect(JSON.parse(coverage.stdout).data).toHaveProperty('missing')
  })
})
