import { fail } from '../core/errors'
import { requireString } from '../core/flags'
import { success } from '../core/result'
import { materializeCase } from './case'
import { buildScenario } from '../domain/scenario-service'
import { comparePlans } from '../domain/plan-service'
import { createPlanFromCase } from '../planner/schedule'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandHandler } from './types'

export const scenarioCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (action === 'create') {
      const fromPlan = repos.plans.getByNameOrId(requireString(parsed.flags, 'from-plan'))
      const scenario = buildScenario({ name: requireString(parsed.flags, 'name'), fromPlanId: fromPlan.id, ruleIds: repos.rules.list().map((rule) => rule.id) })
      repos.scenarios.save(scenario)
      const auditId = repos.audit.write('scenario create', { id: scenario.id, name: scenario.name })
      return success(scenario, { auditId })
    }
    if (action === 'list') return success({ scenarios: repos.scenarios.list() })
    if (action === 'show') return success(repos.scenarios.getByNameOrId(requireString(parsed.flags, 'scenario')))
    if (action === 'simulate') {
      const scenario = repos.scenarios.getByNameOrId(requireString(parsed.flags, 'scenario'))
      const baseline = repos.plans.getByNameOrId(scenario.fromPlanId)
      if (!baseline.caseId) fail('BASELINE_CASE_MISSING', `BASELINE_CASE_MISSING: plan has no caseId: ${baseline.id}`)
      const casePayload = repos.cases.getByNameOrId(baseline.caseId)
      const candidate = createPlanFromCase({
        ...materializeCase(repos, casePayload),
        rules: scenario.ruleIds.map((id: string) => repos.rules.get(id))
      }, { name: `${scenario.name}-${String(parsed.flags.mode ?? 'repair')}`, mode: parsed.flags.mode === 'optimize' ? 'optimize' : 'repair', baseline })
      const next = { ...scenario, candidates: [...scenario.candidates, candidate] }
      repos.scenarios.update(next)
      const auditId = repos.audit.write('scenario simulate', { id: scenario.id, candidateId: candidate.id })
      return success(next, { auditId, notModeled: candidate.notModeled })
    }
    if (action === 'compare') {
      const scenario = repos.scenarios.getByNameOrId(requireString(parsed.flags, 'scenario'))
      const baseline = repos.plans.getByNameOrId(scenario.fromPlanId)
      return success({ comparisons: scenario.candidates.map((candidate: any) => comparePlans(baseline, candidate)) })
    }
    if (action === 'commit') {
      const scenario = repos.scenarios.getByNameOrId(requireString(parsed.flags, 'scenario'))
      const candidate = scenario.candidates.at(-1)
      if (!candidate) fail('SCENARIO_CANDIDATE_MISSING', 'SCENARIO_CANDIDATE_MISSING: simulate scenario before commit')
      const plan = { ...candidate, id: candidate.id, name: requireString(parsed.flags, 'as-plan'), state: 'active' }
      repos.plans.save(plan)
      const next = { ...scenario, state: 'committed', committedPlanId: plan.id }
      repos.scenarios.update(next)
      const auditId = repos.audit.write('scenario commit', { scenarioId: scenario.id, planId: plan.id })
      return success(plan, { auditId, notModeled: plan.notModeled })
    }
    if (action === 'discard') {
      const scenario = repos.scenarios.getByNameOrId(requireString(parsed.flags, 'scenario'))
      const next = { ...scenario, state: 'discarded' }
      repos.scenarios.update(next)
      const auditId = repos.audit.write('scenario discard', { id: scenario.id })
      return success(next, { auditId })
    }
    fail('UNKNOWN_COMMAND', `Unknown scenario command: ${String(action)}`)
  } finally {
    db.close()
  }
}
