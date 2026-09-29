import { fail } from '../core/errors'
import { requireString } from '../core/flags'
import { readJsonFile } from '../core/json'
import { success } from '../core/result'
import { SCHEMA_REGISTRY, type SchemaName } from '../domain/schema-registry'
import type { CommandHandler } from './types'

function getSchemaName(raw: string): SchemaName {
  if (!(raw in SCHEMA_REGISTRY)) fail('SCHEMA_NOT_FOUND', `SCHEMA_NOT_FOUND: ${raw}`)
  return raw as SchemaName
}

export const schemaCommand: CommandHandler = (parsed) => {
  const action = parsed.positionals[1]
  if (action === 'list') return success({ schemas: Object.keys(SCHEMA_REGISTRY) })
  if (action === 'show') {
    const name = getSchemaName(requireString(parsed.flags, 'name'))
    return success({ name, schema: SCHEMA_REGISTRY[name].schema._def })
  }
  if (action === 'example') {
    const name = getSchemaName(requireString(parsed.flags, 'name'))
    return success(SCHEMA_REGISTRY[name].example)
  }
  if (action === 'check') {
    const name = getSchemaName(requireString(parsed.flags, 'name'))
    const file = requireString(parsed.flags, 'file')
    const parsedJson = SCHEMA_REGISTRY[name].schema.safeParse(readJsonFile(file))
    if (!parsedJson.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: schema check failed', parsedJson.error.issues)
    return success({ name, valid: true })
  }
  fail('UNKNOWN_COMMAND', `Unknown schema command: ${String(action)}`)
}
