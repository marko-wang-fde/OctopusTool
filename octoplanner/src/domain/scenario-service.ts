import { createId, nowIso } from '../core/ids'
import { ScenarioSchema } from './schemas'

export function buildScenario(input: { name: string; fromPlanId: string; ruleIds: string[] }): any {
  return ScenarioSchema.parse({
    id: createId('scenario'),
    name: input.name,
    fromPlanId: input.fromPlanId,
    state: 'open',
    createdAt: nowIso(),
    ruleIds: input.ruleIds,
    candidates: []
  })
}
