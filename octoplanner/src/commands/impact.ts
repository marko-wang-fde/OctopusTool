import { fail } from '../core/errors'
import { optionalString, requireString } from '../core/flags'
import { success } from '../core/result'
import { analyzeImpact, traceImpact } from '../domain/impact-service'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandHandler } from './types'

export const impactCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    const plan = repos.plans.getByNameOrId(requireString(parsed.flags, 'plan'))
    if (action === 'analyze') {
      const ruleId = optionalString(parsed.flags, 'rule')
      const rule = ruleId && ruleId !== 'latest' ? repos.rules.get(ruleId) : repos.rules.list()[0]
      return success(analyzeImpact(plan, rule), { notModeled: plan.notModeled })
    }
    if (action === 'trace') return success(traceImpact(plan, requireString(parsed.flags, 'target')), { notModeled: plan.notModeled })
    fail('UNKNOWN_COMMAND', `Unknown impact command: ${String(action)}`)
  } finally {
    db.close()
  }
}
