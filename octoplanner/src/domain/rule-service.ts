import { fail } from '../core/errors'
import { createId, nowIso } from '../core/ids'
import { readJsonFile } from '../core/json'
import { RuleBatchSchema, RuleSchema, TargetSchema } from './schemas'
import type { Rule, Target } from './types'

export function parseTarget(raw: string): Target {
  const [kind, ...rest] = raw.split(':')
  const id = rest.join(':')
  const result = TargetSchema.safeParse({ kind, id })
  if (!result.success) fail('ARGUMENT_INVALID', `ARGUMENT_INVALID: invalid target ${raw}`, result.error.issues)
  return result.data
}

export function parseRuleFile(file: string): any {
  const result = RuleBatchSchema.safeParse(readJsonFile(file))
  if (!result.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid rule batch', result.error.issues)
  return result.data
}

export function buildRuleFromFlags(flags: Record<string, string | boolean>): Rule {
  const type = typeof flags.type === 'string' ? flags.type : undefined
  const target = typeof flags.target === 'string' ? parseTarget(flags.target) : undefined
  const candidate = {
    id: typeof flags.id === 'string' ? flags.id : createId('rule'),
    type,
    target,
    enabled: flags.enabled === undefined ? true : flags.enabled === true,
    reason: typeof flags.reason === 'string' ? flags.reason : undefined,
    until: typeof flags.until === 'string' ? flags.until : undefined,
    after: typeof flags.after === 'string' ? flags.after : undefined,
    from: typeof flags.from === 'string' ? flags.from : undefined,
    to: typeof flags.to === 'string' ? flags.to : undefined,
    priority: typeof flags.priority === 'string' ? Number(flags.priority) : undefined,
    resourceId: typeof flags.resource === 'string' ? flags.resource : undefined,
    relatedTarget: typeof flags.relatedTarget === 'string' ? parseTarget(flags.relatedTarget) : undefined,
    createdAt: nowIso()
  }
  const result = RuleSchema.safeParse(candidate)
  if (!result.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid rule', result.error.issues)
  return result.data
}
