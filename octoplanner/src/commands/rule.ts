import { fail } from '../core/errors'
import { requireString } from '../core/flags'
import { success } from '../core/result'
import { buildRuleFromFlags, parseRuleFile } from '../domain/rule-service'
import { RuleSchema } from '../domain/schemas'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandHandler } from './types'

export const ruleCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (action === 'add') {
      const rule = buildRuleFromFlags(parsed.flags)
      repos.rules.save(rule)
      const auditId = repos.audit.write('rule add', { id: rule.id })
      return success(rule, { auditId })
    }
    if (action === 'load') {
      const batch = parseRuleFile(requireString(parsed.flags, 'file'))
      for (const rule of batch.rules) repos.rules.save(rule)
      const auditId = repos.audit.write('rule load', { id: batch.id, count: batch.rules.length })
      return success({ batchId: batch.id, count: batch.rules.length }, { auditId })
    }
    if (action === 'list') return success({ rules: repos.rules.list({ includeDisabled: parsed.flags.all === true }) })
    if (action === 'show') return success(repos.rules.get(requireString(parsed.flags, 'id')))
    if (action === 'remove') {
      const id = requireString(parsed.flags, 'id')
      repos.rules.remove(id)
      const auditId = repos.audit.write('rule remove', { id })
      return success({ id, removed: true }, { auditId })
    }
    if (action === 'enable' || action === 'disable') {
      const id = requireString(parsed.flags, 'id')
      const rule = repos.rules.update(id, { enabled: action === 'enable' })
      const auditId = repos.audit.write(`rule ${action}`, { id })
      return success(rule, { auditId })
    }
    if (action === 'expire') {
      const id = requireString(parsed.flags, 'id')
      const at = requireString(parsed.flags, 'at')
      const rule = repos.rules.update(id, { expiresAt: at })
      const auditId = repos.audit.write('rule expire', { id, at })
      return success(rule, { auditId })
    }
    if (action === 'validate') {
      if (typeof parsed.flags.file === 'string') {
        const batch = parseRuleFile(parsed.flags.file)
        return success({ valid: true, id: batch.id })
      }
      const rule = repos.rules.get(requireString(parsed.flags, 'id'))
      const result = RuleSchema.safeParse(rule)
      if (!result.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid rule', result.error.issues)
      return success({ valid: true, id: rule.id })
    }
    fail('UNKNOWN_COMMAND', `Unknown rule command: ${String(action)}`)
  } finally {
    db.close()
  }
}
