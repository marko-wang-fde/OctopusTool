import { describe, expect, it } from 'vitest'
import { parseArgs } from '../../src/core/args'

describe('parseArgs', () => {
  it('parses positional command and flags', () => {
    expect(parseArgs(['rule', 'add', '--type', 'not-start-until', '--enabled'])).toEqual({
      positionals: ['rule', 'add'],
      flags: { type: 'not-start-until', enabled: true }
    })
  })

  it('fails on duplicate flags', () => {
    expect(() => parseArgs(['--file', 'a.json', '--file', 'b.json'])).toThrow(/ARGUMENT_DUPLICATE/)
  })
})
