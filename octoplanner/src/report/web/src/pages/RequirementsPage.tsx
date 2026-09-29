import { useEffect, useState } from 'react'
import { api } from '../api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { WebMessages } from '../lib/i18n'
import type { RequirementTraceReport } from '../types'

export function RequirementsPage({ messages, planId }: { messages: WebMessages; planId: string }) {
  const [report, setReport] = useState<RequirementTraceReport | null>(null)
  useEffect(() => { api.requirements(planId).then(setReport).catch(() => setReport(null)) }, [planId])
  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold tracking-normal">{report.title}</h1>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>{messages.requirement}</TableHead><TableHead>{messages.item}</TableHead><TableHead>{messages.operation}</TableHead><TableHead>{messages.resource}</TableHead><TableHead>{messages.start}</TableHead><TableHead>{messages.end}</TableHead></TableRow></TableHeader>
          <TableBody>
            {report.requirements.flatMap((requirement) => requirement.operations.map((operation) => (
              <TableRow key={operation.operationId}><TableCell>{requirement.requirementId}</TableCell><TableCell>{requirement.itemId}</TableCell><TableCell>{operation.operationId}</TableCell><TableCell>{operation.resourceId}</TableCell><TableCell>{operation.startAt}</TableCell><TableCell>{operation.endAt}</TableCell></TableRow>
            )))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
