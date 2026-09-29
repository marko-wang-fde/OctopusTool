import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge } from '../components/ui/badge'
import type { WebMessages } from '../lib/i18n'
import type { RuleImpactReport } from '../types'

export function RulesPage({ messages, planId }: { messages: WebMessages; planId: string }) {
  const [report, setReport] = useState<RuleImpactReport | null>(null)
  useEffect(() => { api.rules(planId).then(setReport).catch(() => setReport(null)) }, [planId])
  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold tracking-normal">{report.title}</h1>
      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-white p-3">
        {report.appliedRuleIds.length ? report.appliedRuleIds.map((id) => <Badge key={id}>{id}</Badge>) : <span className="text-sm text-muted">{messages.rules}</span>}
      </div>
    </section>
  )
}
