import { useEffect, useState } from 'react'
import { api } from '../api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { WebMessages } from '../lib/i18n'
import type { PlanDiffReport } from '../types'

export function DiffPage({ file, messages }: { file: string; messages: WebMessages }) {
  const [report, setReport] = useState<PlanDiffReport | null>(null)
  useEffect(() => {
    if (!file) return
    api.diff(file).then(setReport).catch(() => setReport(null))
  }, [file])
  if (!file) return <div className="text-sm text-muted">{messages.error}</div>
  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold tracking-normal">{report.title}</h1>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={messages.moved} value={report.diff.summary.moved} />
        <Metric label={messages.added} value={report.diff.summary.added} />
        <Metric label={messages.removed} value={report.diff.summary.removed} />
        <Metric label={messages.unplanned} value={report.diff.summary.unplanned} />
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{messages.operation}</TableHead>
              <TableHead>{messages.requirement}</TableHead>
              <TableHead>{messages.before}</TableHead>
              <TableHead>{messages.after}</TableHead>
              <TableHead>{messages.externalRef}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.diff.movedOperations.map((change) => (
              <TableRow key={change.operationId}>
                <TableCell>{change.operationId}</TableCell>
                <TableCell>{change.requirementId}</TableCell>
                <TableCell>{change.resourceIdBefore} {change.startBefore}</TableCell>
                <TableCell>{change.resourceIdAfter} {change.startAfter}</TableCell>
                <TableCell>{change.externalRef ? `${change.externalRef.system}:${change.externalRef.id}` : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-border bg-white p-3"><div className="text-xs text-muted">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></div>
}
