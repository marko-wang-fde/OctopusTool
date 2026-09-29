import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'

describe('cli smoke', () => {
  it('prints version envelope', async () => {
    const result = await runCli(['--version'], { cwd: process.cwd(), env: {} })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      data: { name: 'octoplanner' }
    })
  })
})
