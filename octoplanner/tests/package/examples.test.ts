import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ItemSchema,
  RequirementSchema,
  ResourceSchema,
  RoutingSchema,
  RuleSchema,
  SupplySchema
} from '../../src/domain/schemas'

const loadJson = (file: string): unknown => JSON.parse(readFileSync(path.resolve(file), 'utf8'))

describe('published examples', () => {
  it('validates minimal model examples', () => {
    const requirements = loadJson('examples/minimal/requirements.json') as unknown[]
    const items = loadJson('examples/minimal/items.json') as unknown[]
    const routings = loadJson('examples/minimal/routings.json') as unknown[]
    const resources = loadJson('examples/minimal/resources.json') as unknown[]
    const supplies = loadJson('examples/minimal/supplies.json') as unknown[]

    expect(requirements.map((record) => RequirementSchema.parse(record))).toHaveLength(1)
    expect(items.map((record) => ItemSchema.parse(record))).toHaveLength(1)
    expect(routings.map((record) => RoutingSchema.parse(record))).toHaveLength(1)
    expect(resources.map((record) => ResourceSchema.parse(record))).toHaveLength(1)
    expect(supplies.map((record) => SupplySchema.parse(record))).toHaveLength(1)
  })

  it('validates reschedule model and rule examples', () => {
    const requirements = loadJson('examples/reschedule/requirements.json') as unknown[]
    const items = loadJson('examples/reschedule/items.json') as unknown[]
    const routings = loadJson('examples/reschedule/routings.json') as unknown[]
    const resources = loadJson('examples/reschedule/resources.json') as unknown[]
    const rules = loadJson('examples/reschedule/rules.json') as unknown[]

    expect(requirements.map((record) => RequirementSchema.parse(record))).toHaveLength(2)
    expect(items.map((record) => ItemSchema.parse(record))).toHaveLength(2)
    expect(routings.map((record) => RoutingSchema.parse(record))).toHaveLength(2)
    expect(resources.map((record) => ResourceSchema.parse(record))).toHaveLength(2)
    expect(rules.map((record) => RuleSchema.parse(record))).toHaveLength(2)
  })
})
