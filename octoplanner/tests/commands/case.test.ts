import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

async function loadBase(cwd: string) {
  await runCli(['workspace', 'init'], { cwd, env: {} })
  await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd, env: {} })
  await runCli(['model', 'item', 'load', '--file', fixture('items.json')], { cwd, env: {} })
  await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd, env: {} })
  await runCli(['model', 'resource', 'load', '--file', fixture('resources.json')], { cwd, env: {} })
}

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('case commands', () => {
  it('creates, validates, summarizes, and exports a case', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await loadBase(dir)
    const created = await runCli(['case', 'create', '--name', 'march-case'], { cwd: dir, env: {} })
    expect(created.exitCode).toBe(0)

    const validate = await runCli(['case', 'validate', '--case', 'march-case'], { cwd: dir, env: {} })
    expect(validate.exitCode).toBe(2)
    expect(JSON.parse(validate.stderr).error.code).toBe('CASE_INVALID')

    const summary = await runCli(['case', 'summary', '--case', 'march-case'], { cwd: dir, env: {} })
    expect(JSON.parse(summary.stdout).notModeled).toEqual(expect.arrayContaining(['supply_availability', 'shift_calendar']))
  })
})
