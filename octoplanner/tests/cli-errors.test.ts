import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'

describe('cli errors', () => {
  it('returns JSON fastfail envelope for unknown command', async () => {
    const result = await runCli(['bad'], { cwd: process.cwd(), env: {} })
    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      error: { code: 'UNKNOWN_COMMAND', message: 'Unknown command: bad' }
    })
  })
})
