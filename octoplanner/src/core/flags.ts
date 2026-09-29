import { fail } from './errors'

export function requireString(flags: Record<string, string | boolean>, name: string): string {
  const value = flags[name]
  if (typeof value !== 'string' || value.length === 0) fail('ARGUMENT_REQUIRED', `ARGUMENT_REQUIRED: --${name} is required`)
  return value
}

export function optionalString(flags: Record<string, string | boolean>, name: string): string | undefined {
  const value = flags[name]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) fail('ARGUMENT_INVALID', `ARGUMENT_INVALID: --${name} must have a value`)
  return value
}

export function parseLimit(flags: Record<string, string | boolean>, defaultValue: number): number {
  const raw = optionalString(flags, 'limit')
  if (!raw) return defaultValue
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) fail('ARGUMENT_INVALID', 'ARGUMENT_INVALID: --limit must be a positive integer')
  return value
}
