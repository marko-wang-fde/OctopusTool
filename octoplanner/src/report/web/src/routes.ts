export type ReportRoute =
  | { page: 'plans' }
  | { page: 'overview'; planId: string }
  | { page: 'timeline'; planId: string }
  | { page: 'requirements'; planId: string }
  | { page: 'exceptions'; planId: string }
  | { page: 'rules'; planId: string }
  | { page: 'diff'; file: string }
  | { page: 'scenario'; scenarioId: string }

export function parseRoute(pathname: string, search = ''): ReportRoute {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts.length === 0) return { page: 'plans' }
  if (parts[0] === 'plans' && parts[1]) {
    if (parts.length === 2) return { page: 'overview', planId: parts[1] }
    if (parts[2] === 'timeline') return { page: 'timeline', planId: parts[1] }
    if (parts[2] === 'requirements') return { page: 'requirements', planId: parts[1] }
    if (parts[2] === 'exceptions') return { page: 'exceptions', planId: parts[1] }
    if (parts[2] === 'rules') return { page: 'rules', planId: parts[1] }
  }
  if (parts[0] === 'diff') return { page: 'diff', file: new URLSearchParams(search).get('file') ?? '' }
  if (parts[0] === 'scenarios' && parts[1]) return { page: 'scenario', scenarioId: parts[1] }
  return { page: 'plans' }
}

export function planHref(planId: string, page: 'overview' | 'timeline' | 'requirements' | 'exceptions' | 'rules' = 'overview'): string {
  const encoded = encodeURIComponent(planId)
  if (page === 'overview') return `/plans/${encoded}`
  return `/plans/${encoded}/${page}`
}

export function scenarioHref(scenarioId: string): string {
  return `/scenarios/${encodeURIComponent(scenarioId)}`
}

export function diffHref(file: string): string {
  return `/diff?file=${encodeURIComponent(file)}`
}
