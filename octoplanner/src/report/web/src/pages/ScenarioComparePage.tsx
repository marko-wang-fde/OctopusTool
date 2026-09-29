import { useEffect, useState } from 'react'
import { api } from '../api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { WebMessages } from '../lib/i18n'
import type { ScenarioCompareReport } from '../types'

export function ScenarioComparePage({ messages, scenarioId }: { messages: WebMessages; scenarioId: string }) {
  const [report, setReport] = useState<ScenarioCompareReport | null>(null)
  useEffect(() => { api.scenarioCompare(scenarioId).then(setReport).catch(() => setReport(null)) }, [scenarioId])
  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold tracking-normal">{report.title}</h1>
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>{messages.candidates}</TableHead><TableHead>{messages.metrics}</TableHead></TableRow></TableHeader>
          <TableBody>
            {report.candidates.map((candidate) => <TableRow key={candidate.planId}><TableCell>{candidate.planName}</TableCell><TableCell><pre className="max-w-3xl overflow-auto text-xs">{JSON.stringify(candidate.comparison, null, 2)}</pre></TableCell></TableRow>)}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
