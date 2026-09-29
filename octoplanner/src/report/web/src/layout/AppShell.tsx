import { BarChart3, Boxes, ClipboardList, GitCompare, ListChecks, Route, ShieldCheck } from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Separator } from '../components/ui/separator'
import { Select } from '../components/ui/select'
import type { WebMessages } from '../lib/i18n'
import { planHref, scenarioHref, type ReportRoute } from '../routes'
import type { Config, PlanListItem, ScenarioListItem } from '../types'
import { ExceptionsPage } from '../pages/ExceptionsPage'
import { DiffPage } from '../pages/DiffPage'
import { PlanListPage } from '../pages/PlanListPage'
import { PlanOverviewPage } from '../pages/PlanOverviewPage'
import { RequirementsPage } from '../pages/RequirementsPage'
import { ResourceTimelinePage } from '../pages/ResourceTimelinePage'
import { RulesPage } from '../pages/RulesPage'
import { ScenarioComparePage } from '../pages/ScenarioComparePage'

type Props = {
  config: Config | null
  error: string | null
  messages: WebMessages
  navigate: (href: string) => void
  plans: PlanListItem[]
  route: ReportRoute
  scenarios: ScenarioListItem[]
}

export function AppShell({ config, error, messages, navigate, plans, route, scenarios }: Props) {
  const selectedPlanId = 'planId' in route ? route.planId : plans[0]?.name ?? plans[0]?.id ?? ''
  const nav = [
    { label: messages.plans, icon: ClipboardList, href: '/' },
    { label: messages.timeline, icon: BarChart3, href: selectedPlanId ? planHref(selectedPlanId, 'timeline') : '/' },
    { label: messages.requirements, icon: Boxes, href: selectedPlanId ? planHref(selectedPlanId, 'requirements') : '/' },
    { label: messages.exceptions, icon: ListChecks, href: selectedPlanId ? planHref(selectedPlanId, 'exceptions') : '/' },
    { label: messages.rules, icon: Route, href: selectedPlanId ? planHref(selectedPlanId, 'rules') : '/' },
    { label: messages.scenarios, icon: GitCompare, href: scenarios[0] ? scenarioHref(scenarios[0].name ?? scenarios[0].id) : '/' }
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-white md:block">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{messages.appTitle}</div>
            <div className="text-xs text-muted">{messages.readOnly}</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => (
            <Button key={item.label} variant="ghost" className="w-full justify-start gap-2" onClick={() => navigate(item.href)}>
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Button>
          ))}
        </nav>
      </aside>
      <div className="md:pl-60">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-sm font-medium">{messages.appTitle}</div>
            <Badge variant="outline">{config?.locale ?? 'zh-CN'}</Badge>
          </div>
          <div className="flex items-center gap-3">
            {plans.length > 0 ? (
              <Select value={selectedPlanId} onChange={(event) => navigate(planHref(event.target.value))} aria-label={messages.selectPlan}>
                {plans.map((plan) => <option key={plan.id} value={plan.name ?? plan.id}>{plan.name}</option>)}
              </Select>
            ) : null}
            <Badge variant="outline">{messages.readOnly}</Badge>
          </div>
        </header>
        <main className="p-4">
          {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <ReportContent messages={messages} navigate={navigate} plans={plans} route={route} scenarios={scenarios} />
        </main>
      </div>
    </div>
  )
}

function ReportContent({ messages, navigate, plans, route, scenarios }: Omit<Props, 'config' | 'error'>) {
  if (route.page === 'plans') return <PlanListPage messages={messages} navigate={navigate} plans={plans} scenarios={scenarios} />
  if (route.page === 'overview') return <PlanOverviewPage messages={messages} navigate={navigate} planId={route.planId} />
  if (route.page === 'timeline') return <ResourceTimelinePage messages={messages} planId={route.planId} />
  if (route.page === 'requirements') return <RequirementsPage messages={messages} planId={route.planId} />
  if (route.page === 'exceptions') return <ExceptionsPage messages={messages} planId={route.planId} />
  if (route.page === 'rules') return <RulesPage messages={messages} planId={route.planId} />
  if (route.page === 'diff') return <DiffPage file={route.file} messages={messages} />
  return (
    <>
      <ScenarioComparePage messages={messages} scenarioId={route.scenarioId} />
      <Separator className="mt-6" />
    </>
  )
}
