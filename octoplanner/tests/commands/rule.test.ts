import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('rule commands', () => {
  it('adds, lists, disables, enables, expires, and removes a rule', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await runCli(['workspace', 'init'], { cwd: dir, env: {} })

    const add = await runCli([
      'rule', 'add',
      '--type', 'not-start-until',
      '--target', 'requirement:REQ-1',
      '--until', '2026-03-12T00:00:00.000Z',
      '--reason', 'manual hold'
    ], { cwd: dir, env: {} })
    expect(add.exitCode).toBe(0)
    const id = JSON.parse(add.stdout).data.id

    expect(JSON.parse((await runCli(['rule', 'list'], { cwd: dir, env: {} })).stdout).data.rules).toHaveLength(1)
    expect((await runCli(['rule', 'disable', '--id', id], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['rule', 'enable', '--id', id], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['rule', 'expire', '--id', id, '--at', '2026-03-13T00:00:00.000Z'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['rule', 'remove', '--id', id], { cwd: dir, env: {} })).exitCode).toBe(0)
  })
})
