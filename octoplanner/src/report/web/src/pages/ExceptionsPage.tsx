import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge } from '../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { WebMessages } from '../lib/i18n'
import type { ExceptionReviewReport } from '../types'

export function ExceptionsPage({ messages, planId }: { messages: WebMessages; planId: string }) {
  const [report, setReport] = useState<ExceptionReviewReport | null>(null)
  useEffect(() => { api.exceptions(planId).then(setReport).catch(() => setReport(null)) }, [planId])
  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold tracking-normal">{report.title}</h1>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>{messages.severity}</TableHead><TableHead>{messages.requirement}</TableHead><TableHead>{messages.operation}</TableHead><TableHead>{messages.reason}</TableHead><TableHead>{messages.nextAction}</TableHead></TableRow></TableHeader>
          <TableBody>
            {report.exceptions.map((item) => <TableRow key={item.id}><TableCell><Badge>{item.severity}</Badge></TableCell><TableCell>{item.requirementId ?? ''}</TableCell><TableCell>{item.operationId ?? ''}</TableCell><TableCell>{item.reason}</TableCell><TableCell>{item.nextAction}</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
