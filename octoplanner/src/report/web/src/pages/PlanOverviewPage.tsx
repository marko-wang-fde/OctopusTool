import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { WebMessages } from '../lib/i18n'
import { planHref } from '../routes'
import type { PlanOverviewReport } from '../types'

export function PlanOverviewPage({ messages, navigate, planId }: { messages: WebMessages; navigate: (href: string) => void; planId: string }) {
  const [report, setReport] = useState<PlanOverviewReport | null>(null)
  useEffect(() => { api.overview(planId).then(setReport).catch(() => setReport(null)) }, [planId])
  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <Header title={report.title} subtitle={report.source.name} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={messages.planned} value={report.scheduledOperationCount} />
        <Metric label={messages.unplanned} value={report.unplannedOperations.length} />
        <Metric label={messages.warnings} value={report.warnings.length} />
        <Metric label={messages.notModeled} value={report.notModeled.length} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => navigate(planHref(planId, 'timeline'))}>{messages.timeline}</Button>
        <Button variant="outline" onClick={() => navigate(planHref(planId, 'exceptions'))}>{messages.exceptions}</Button>
      </div>
      <h2 className="mb-2 text-sm font-semibold">{messages.unplanned}</h2>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>{messages.operation}</TableHead><TableHead>{messages.requirement}</TableHead><TableHead>{messages.reason}</TableHead></TableRow></TableHeader>
          <TableBody>
            {report.unplannedOperations.map((item) => <TableRow key={item.operationId}><TableCell>{item.operationId}</TableCell><TableCell>{item.requirementId}</TableCell><TableCell>{item.reason}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
      <pre className="mt-4 overflow-auto rounded-md border border-border bg-white p-3 text-xs">{JSON.stringify(report.metrics, null, 2)}</pre>
    </section>
  )
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-4"><h1 className="text-xl font-semibold tracking-normal">{title}</h1><p className="text-sm text-muted">{subtitle}</p></div>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-border bg-white p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>
}
