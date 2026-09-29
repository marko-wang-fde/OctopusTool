import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { AppShell } from './layout/AppShell'
import { getMessages } from './lib/i18n'
import { parseRoute, type ReportRoute } from './routes'
import type { Config, PlanListItem, ScenarioListItem } from './types'

export function App() {
  const [config, setConfig] = useState<Config | null>(null)
  const [plans, setPlans] = useState<PlanListItem[]>([])
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [route, setRoute] = useState<ReportRoute>(() => parseRoute(window.location.pathname, window.location.search))
  const [error, setError] = useState<string | null>(null)
  const messages = useMemo(() => getMessages(config?.locale), [config?.locale])

  useEffect(() => {
    Promise.all([api.config(), api.plans(), api.scenarios()])
      .then(([nextConfig, planData, scenarioData]) => {
        setConfig(nextConfig)
        setPlans(planData.plans)
        setScenarios(scenarioData.scenarios)
      })
      .catch((nextError: unknown) => setError(nextError instanceof Error ? nextError.message : messages.error))
  }, [messages.error])

  useEffect(() => {
    const onPopState = () => setRoute(parseRoute(window.location.pathname, window.location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (href: string) => {
    window.history.pushState({}, '', href)
    setRoute(parseRoute(window.location.pathname, window.location.search))
  }

  return <AppShell config={config} error={error} messages={messages} navigate={navigate} plans={plans} route={route} scenarios={scenarios} />
}
