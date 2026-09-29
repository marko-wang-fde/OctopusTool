import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { WebMessages } from '../lib/i18n'
import { planHref, scenarioHref } from '../routes'
import type { PlanListItem, ScenarioListItem } from '../types'

export function PlanListPage({ messages, navigate, plans, scenarios }: { messages: WebMessages; navigate: (href: string) => void; plans: PlanListItem[]; scenarios: ScenarioListItem[] }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-normal">{messages.plans}</h1>
        <Badge variant="outline">{plans.length}</Badge>
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow><TableHead>{messages.plans}</TableHead><TableHead>{messages.state}</TableHead><TableHead>{messages.latest}</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan, index) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>{plan.state}</TableCell>
                <TableCell>{index === 0 ? <Badge>{messages.latest}</Badge> : null}</TableCell>
                <TableCell className="text-right"><Button variant="outline" onClick={() => navigate(planHref(plan.name ?? plan.id))}>{messages.plans}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {scenarios.length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold">{messages.scenarios}</h2>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((scenario) => <Button key={scenario.id} variant="outline" onClick={() => navigate(scenarioHref(scenario.name ?? scenario.id))}>{scenario.name}</Button>)}
          </div>
        </div>
      ) : null}
    </section>
  )
}
