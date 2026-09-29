import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const schemaFiles = [
  'requirement.schema.json',
  'item.schema.json',
  'routing.schema.json',
  'resource.schema.json',
  'supply.schema.json',
  'rule.schema.json',
  'case.schema.json',
  'revision.schema.json',
  'plan-diff.schema.json'
] as const

describe('published JSON schema assets', () => {
  it.each(schemaFiles)('%s is a draft 2020-12 object schema', (file) => {
    const schemaPath = path.resolve('schemas', file)
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as {
      $schema?: string
      title?: string
      type?: string
    }

    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.title).toEqual(expect.any(String))
    expect(schema.title?.length).toBeGreaterThan(0)
    expect(schema.type).toBe('object')
  })
})
