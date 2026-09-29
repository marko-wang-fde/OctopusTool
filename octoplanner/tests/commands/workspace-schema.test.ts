import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('workspace and schema commands', () => {
  it('initializes and reports workspace status', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    const init = await runCli(['workspace', 'init'], { cwd: dir, env: {} })
    expect(init.exitCode).toBe(0)
    const status = await runCli(['workspace', 'status'], { cwd: dir, env: {} })
    expect(JSON.parse(status.stdout).data.schemaVersion).toBe(1)
  })

  it('shows schema examples', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    const result = await runCli(['schema', 'example', '--name', 'model.requirement'], { cwd: dir, env: {} })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).data.id).toBeTruthy()
  })
})
