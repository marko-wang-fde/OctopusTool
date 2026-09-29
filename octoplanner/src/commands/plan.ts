import { fail } from '../core/errors'
import { optionalString, requireString } from '../core/flags'
import { writeJsonFile } from '../core/json'
import { success } from '../core/result'
import { materializeCase } from './case'
import { comparePlans, diffPlans, parsePlanFile, parseRevisionFile } from '../domain/plan-service'
import { parseRuleFile } from '../domain/rule-service'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import { createPlanFromCase } from '../planner/schedule'
import { timelineForPlan } from '../planner/timeline'
import type { CommandHandler } from './types'

export const planCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (action === 'create') {
      const casePayload = repos.cases.getByNameOrId(requireString(parsed.flags, 'case'))
      const name = requireString(parsed.flags, 'name')
      const plan = createPlanFromCase(materializeCase(repos, casePayload), { name })
      repos.plans.save(plan)
      const auditId = repos.audit.write('plan create', { id: plan.id, name })
      return success(plan, { auditId, notModeled: plan.notModeled })
    }
    if (action === 'revise') {
      const baseline = repos.plans.getByNameOrId(requireString(parsed.flags, 'from-plan'))
      if (!baseline.caseId) fail('BASELINE_CASE_MISSING', `BASELINE_CASE_MISSING: plan has no caseId: ${baseline.id}`)
      const casePayload = repos.cases.getByNameOrId(baseline.caseId)
      const name = requireString(parsed.flags, 'name')
      const revision = typeof parsed.flags.revision === 'string' ? parseRevisionFile(parsed.flags.revision) : undefined
      if (revision?.fromPlanId && revision.fromPlanId !== baseline.id && revision.fromPlanId !== baseline.name) {
        fail('REVISION_BASELINE_MISMATCH', `REVISION_BASELINE_MISMATCH: revision ${revision.id} targets ${revision.fromPlanId}, not ${baseline.id}`)
      }
      const rulesFromFile = typeof parsed.flags.rules === 'string' ? parseRuleFile(parsed.flags.rules).rules : []
      const revisionRules = revision?.rules ?? []
      const materialized = materializeCase(repos, casePayload)
      const plan = createPlanFromCase({
        ...materialized,
        rules: [...materialized.rules, ...rulesFromFile, ...revisionRules]
      }, {
        name,
        mode: revision?.policy?.mode === 'full' ? 'create' : revision?.policy?.mode ?? 'repair',
        baseline,
        moveScope: revision?.policy?.moveScope ?? 'impacted-only'
      })
      repos.plans.save(plan)
      const auditId = repos.audit.write('plan revise', { id: plan.id, name, baselinePlanId: baseline.id, revisionId: revision?.id })
      return success(plan, { auditId, notModeled: plan.notModeled })
    }
    if (action === 'load') {
      const name = optionalString(parsed.flags, 'name')
      const plan = parsePlanFile(requireString(parsed.flags, 'file'), name)
      repos.plans.save(plan)
      const auditId = repos.audit.write('plan load', { id: plan.id, name: plan.name })
      return success(plan, { auditId, notModeled: plan.notModeled })
    }
    if (action === 'list') return success({ plans: repos.plans.list({ includeArchived: parsed.flags.all === true }) })
    if (action === 'show') return success(repos.plans.getByNameOrId(requireString(parsed.flags, 'plan')))
    if (action === 'summary') {
      const plan = repos.plans.getByNameOrId(requireString(parsed.flags, 'plan'))
      return success({ id: plan.id, name: plan.name, metrics: plan.metrics, unplannedOperations: plan.unplannedOperations, appliedRuleIds: plan.appliedRuleIds }, { notModeled: plan.notModeled })
    }
    if (action === 'timeline') {
      const plan = repos.plans.getByNameOrId(requireString(parsed.flags, 'plan'))
      return success({ timeline: timelineForPlan(plan) }, { notModeled: plan.notModeled })
    }
    if (action === 'metrics') {
      const plan = repos.plans.getByNameOrId(requireString(parsed.flags, 'plan'))
      return success(plan.metrics, { notModeled: plan.notModeled })
    }
    if (action === 'export') {
      const plan = repos.plans.getByNameOrId(requireString(parsed.flags, 'plan'))
      const out = optionalString(parsed.flags, 'out')
      if (out) writeJsonFile(out, plan)
      return success(plan, { notModeled: plan.notModeled })
    }
    if (action === 'compare') return success(comparePlans(repos.plans.getByNameOrId(requireString(parsed.flags, 'left')), repos.plans.getByNameOrId(requireString(parsed.flags, 'right'))))
    if (action === 'diff') {
      const diff = diffPlans(repos.plans.getByNameOrId(requireString(parsed.flags, 'from')), repos.plans.getByNameOrId(requireString(parsed.flags, 'to')))
      const out = optionalString(parsed.flags, 'out')
      if (out) writeJsonFile(out, diff)
      const auditId = repos.audit.write('plan diff', { id: diff.id, fromPlanId: diff.fromPlanId, toPlanId: diff.toPlanId })
      return success(diff, { auditId })
    }
    if (action === 'archive') {
      const plan = repos.plans.archive(requireString(parsed.flags, 'plan'))
      const auditId = repos.audit.write('plan archive', { id: plan.id })
      return success(plan, { auditId, notModeled: plan.notModeled })
    }
    fail('UNKNOWN_COMMAND', `Unknown plan command: ${String(action)}`)
  } finally {
    db.close()
  }
}
