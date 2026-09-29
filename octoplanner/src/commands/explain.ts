import { fail } from '../core/errors'
import { requireString } from '../core/flags'
import { success } from '../core/result'
import { explainOperation, explainPlan, explainRequirement, explainResource, explainRule, explainScenario } from '../domain/explain-service'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandHandler } from './types'

export const explainCommand: CommandHandler = (parsed, context) => {
  const subject = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (subject === 'plan') return success(explainPlan(repos.plans.getByNameOrId(requireString(parsed.flags, 'plan'))))
    if (subject === 'requirement' || subject === 'order') return success(explainRequirement(repos.plans.getByNameOrId(requireString(parsed.flags, 'plan')), requireString(parsed.flags, 'id')))
    if (subject === 'operation') return success(explainOperation(repos.plans.getByNameOrId(requireString(parsed.flags, 'plan')), requireString(parsed.flags, 'id')))
    if (subject === 'resource') return success(explainResource(repos.plans.getByNameOrId(requireString(parsed.flags, 'plan')), requireString(parsed.flags, 'id')))
    if (subject === 'rule') return success(explainRule(repos.rules.get(requireString(parsed.flags, 'id'))))
    if (subject === 'scenario') return success(explainScenario(repos.scenarios.getByNameOrId(requireString(parsed.flags, 'scenario'))))
    fail('UNKNOWN_COMMAND', `Unknown explain command: ${String(subject)}`)
  } finally {
    db.close()
  }
}
