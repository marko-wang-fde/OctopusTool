import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataItem, TimelineGroup } from 'vis-timeline'
import 'vis-timeline/styles/vis-timeline-graph2d.css'
import { api } from '../api'
import { Badge } from '../components/ui/badge'
import { Select } from '../components/ui/select'
import type { WebMessages } from '../lib/i18n'
import type { ResourceTimelineReport, ScheduledOperation } from '../types'

type TimelineInstance = {
  destroy(): void
  fit(options: { animation: boolean }): void
  on(event: 'select', callback: (event: { items: Array<string | number> }) => void): void
  redraw(): void
}

export function ResourceTimelinePage({ messages, planId }: { messages: WebMessages; planId: string }) {
  const [report, setReport] = useState<ResourceTimelineReport | null>(null)
  const [selected, setSelected] = useState<ScheduledOperation | null>(null)
  const [requirementFilter, setRequirementFilter] = useState('all')
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const operationByIdRef = useRef(new Map<string, ScheduledOperation>())
  useEffect(() => { api.timeline(planId).then(setReport).catch(() => setReport(null)) }, [planId])

  const requirementIds = useMemo(() => {
    if (!report) return []
    return [...new Set(report.resources.flatMap((resource) => resource.operations.map((operation) => operation.requirementId)))].sort()
  }, [report])

  const resources = useMemo(() => {
    if (!report) return []
    return report.resources
    .map((resource) => ({
      ...resource,
      operations: requirementFilter === 'all' ? resource.operations : resource.operations.filter((operation) => operation.requirementId === requirementFilter)
    }))
    .filter((resource) => resource.operations.length > 0)
  }, [report, requirementFilter])

  useEffect(() => {
    if (!timelineRef.current || !report) return undefined
    let disposed = false
    let timeline: TimelineInstance | undefined
    operationByIdRef.current = new Map(resources.flatMap((resource) => resource.operations.map((operation) => [operation.operationId, operation])))

    Promise.all([import('vis-data/peer'), import('vis-timeline/peer')]).then(([visData, visTimeline]) => {
      if (disposed || !timelineRef.current) return
      const groups = new visData.DataSet<TimelineGroup>(
        resources.map((resource) => ({
          id: resource.resourceId,
          content: `<div class="timeline-group"><strong>${escapeHtml(resource.resourceId)}</strong></div>`
        }))
      )
      const items = new visData.DataSet<DataItem>(
        resources.flatMap((resource) => resource.operations.map((operation) => ({
          id: operation.operationId,
          group: resource.resourceId,
          start: operation.startAt,
          end: operation.endAt,
          content: `<div class="timeline-item"><strong>${escapeHtml(operation.requirementId)}</strong><br><span>${escapeHtml(operation.routingOperationId)}</span></div>`,
          title: `${operation.operationId}\n${operation.requirementId}\n${operation.startAt} - ${operation.endAt}`,
          className: operation.locked ? 'operation-locked' : 'operation-normal'
        })))
      )
      timeline = new visTimeline.Timeline(timelineRef.current, items, groups, {
        stack: false,
        groupHeightMode: 'fitItems',
        editable: false,
        selectable: true,
        multiselect: false,
        orientation: 'top',
        margin: { item: { horizontal: 0, vertical: 8 }, axis: 8 },
        zoomMin: 1000 * 60 * 15,
        zoomMax: 1000 * 60 * 60 * 24 * 366,
        height: Math.max(260, resources.length * 74 + 72),
        tooltip: { followMouse: true },
        horizontalScroll: true,
        verticalScroll: true
      })
      timeline.on('select', (event: { items: Array<string | number> }) => {
        const id = String(event.items[0] ?? '')
        setSelected(operationByIdRef.current.get(id) ?? null)
      })
      if (items.length > 0) {
        timeline.fit({ animation: false })
        requestAnimationFrame(() => {
          if (disposed || !timeline) return
          timeline.redraw()
          timeline.fit({ animation: false })
        })
      }
    })

    return () => {
      disposed = true
      timeline?.destroy()
    }
  }, [report, resources])

  if (!report) return <div className="text-sm text-muted">{messages.loading}</div>

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-normal">{report.title}</h1>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{messages.orderFilter}</span>
          <Select value={requirementFilter} onChange={(event) => setRequirementFilter(event.target.value)} aria-label={messages.orderFilter}>
            <option value="all">{messages.allOrders}</option>
            {requirementIds.map((requirementId) => <option key={requirementId} value={requirementId}>{requirementId}</option>)}
          </Select>
        </label>
      </div>
      <div ref={timelineRef} className="report-timeline rounded-md border border-border bg-white" />
      {selected ? <pre className="mt-4 overflow-auto rounded-md border border-border bg-white p-3 text-xs">{JSON.stringify(selected, null, 2)}</pre> : null}
    </section>
  )
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
