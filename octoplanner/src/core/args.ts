import { fail } from './errors'

export type ParsedArgs = {
  positionals: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) continue
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const key = token.slice(2)
    if (!key) fail('ARGUMENT_INVALID', 'ARGUMENT_INVALID: Empty flag name is not allowed')
    if (Object.prototype.hasOwnProperty.call(flags, key)) {
      fail('ARGUMENT_DUPLICATE', `ARGUMENT_DUPLICATE: Duplicate flag: --${key}`)
    }

    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      index += 1
    } else {
      flags[key] = true
    }
  }

  return { positionals, flags }
}
