import type {
  Config,
  Envelope,
  ExceptionReviewReport,
  FailureEnvelope,
  PlanListItem,
  PlanOverviewReport,
  RequirementTraceReport,
  ResourceTimelineReport,
  RuleImpactReport,
  ScenarioCompareReport,
  ScenarioListItem,
  PlanDiffReport
} from './types'

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  const payload = (await response.json()) as Envelope<T> | FailureEnvelope
  if (!payload.ok) throw new Error(`${payload.error.code}: ${payload.error.message}`)
  return payload.data
}

export const api = {
  config: () => fetchJson<Config>('/api/config'),
  plans: () => fetchJson<{ plans: PlanListItem[] }>('/api/plans'),
  overview: (planId: string) => fetchJson<PlanOverviewReport>(`/api/plans/${encodeURIComponent(planId)}/overview`),
  timeline: (planId: string) => fetchJson<ResourceTimelineReport>(`/api/plans/${encodeURIComponent(planId)}/timeline`),
  requirements: (planId: string) => fetchJson<RequirementTraceReport>(`/api/plans/${encodeURIComponent(planId)}/requirements`),
  exceptions: (planId: string) => fetchJson<ExceptionReviewReport>(`/api/plans/${encodeURIComponent(planId)}/exceptions`),
  rules: (planId: string) => fetchJson<RuleImpactReport>(`/api/plans/${encodeURIComponent(planId)}/rules`),
  diff: (file: string) => fetchJson<PlanDiffReport>(`/api/diff?file=${encodeURIComponent(file)}`),
  scenarios: () => fetchJson<{ scenarios: ScenarioListItem[] }>('/api/scenarios'),
  scenarioCompare: (scenarioId: string) => fetchJson<ScenarioCompareReport>(`/api/scenarios/${encodeURIComponent(scenarioId)}/compare`)
}
