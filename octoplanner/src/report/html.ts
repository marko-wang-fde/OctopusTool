import type { ReportViewModel } from '../domain/report-types'
import type { ReportMessages } from './messages'

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderReportHtml(report: ReportViewModel, messages: ReportMessages): string {
  return `<!doctype html>
<html lang="${escapeHtml(report.locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.title)} - ${escapeHtml(messages.app.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f8fafc; color: #111827; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px; }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
    h1 { margin: 0 0 8px; font-size: 28px; line-height: 1.2; letter-spacing: 0; }
    h2 { margin: 28px 0 12px; font-size: 18px; letter-spacing: 0; }
    .muted { color: #6b7280; font-size: 13px; }
    .badge { display: inline-flex; align-items: center; border: 1px solid #d1d5db; border-radius: 999px; padding: 2px 8px; font-size: 12px; background: #fff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
    .metric { font-size: 22px; font-weight: 650; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 9px 10px; text-align: left; font-size: 13px; vertical-align: top; }
    th { color: #374151; background: #f3f4f6; font-weight: 600; }
    tr:last-child td { border-bottom: 0; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 6px 0; }
    pre { overflow: auto; padding: 12px; background: #0f172a; color: #f8fafc; border-radius: 8px; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>${escapeHtml(report.title)}</h1>
        <div class="muted">${escapeHtml(reportSourceLabel(report))}</div>
      </div>
      <div>
        <span class="badge">${escapeHtml(messages.app.readOnly)}</span>
        <div class="muted" style="margin-top:8px">${escapeHtml(messages.app.generatedAt)}: ${escapeHtml(report.generatedAt)}</div>
      </div>
    </header>
    ${renderBody(report, messages)}
  </main>
</body>
</html>`
}

function reportSourceLabel(report: ReportViewModel): string {
  if (report.reportType === 'scenario-compare') return `${report.scenario.name} (${report.scenario.id})`
  return `${report.source.name} (${report.source.id})`
}

function renderBody(report: ReportViewModel, messages: ReportMessages): string {
  if (report.reportType === 'plan-overview') return renderPlanOverview(report, messages)
  if (report.reportType === 'resource-timeline') return renderResourceTimeline(report, messages)
  if (report.reportType === 'requirement-trace') return renderRequirementTrace(report, messages)
  if (report.reportType === 'exception-review') return renderExceptionReview(report, messages)
  if (report.reportType === 'rule-impact') return renderRuleImpact(report, messages)
  if (report.reportType === 'plan-diff') return renderPlanDiff(report, messages)
  return renderScenarioCompare(report, messages)
}

function renderPlanOverview(report: Extract<ReportViewModel, { reportType: 'plan-overview' }>, messages: ReportMessages): string {
  return `
    <section class="grid">
      <div class="card"><div class="muted">${escapeHtml(messages.tableHeaders.state)}</div><div class="metric">${escapeHtml(statusLabel(report.source.state, messages))}</div></div>
      <div class="card"><div class="muted">${escapeHtml(messages.status.planned)}</div><div class="metric">${report.scheduledOperationCount}</div></div>
      <div class="card"><div class="muted">${escapeHtml(messages.status.unplanned)}</div><div class="metric">${report.unplannedOperations.length}</div></div>
      <div class="card"><div class="muted">${escapeHtml(messages.tableHeaders.ruleId)}</div><div class="metric">${report.appliedRuleIds.length}</div></div>
    </section>
    <h2>${escapeHtml(messages.reportTitles.exceptionReview)}</h2>
    ${renderUnplanned(report.unplannedOperations, messages)}
    <h2>notModeled</h2>
    ${renderList(report.notModeled, messages.empty.noExceptions)}
    <h2>metrics</h2>
    <pre>${escapeHtml(JSON.stringify(report.metrics, null, 2))}</pre>`
}

function renderResourceTimeline(report: Extract<ReportViewModel, { reportType: 'resource-timeline' }>, messages: ReportMessages): string {
  const rows = report.resources.flatMap((resource) => resource.operations.map((operation) => `
    <tr>
      <td>${escapeHtml(resource.resourceId)}</td>
      <td>${escapeHtml(operation.operationId)}</td>
      <td>${escapeHtml(operation.requirementId)}</td>
      <td>${escapeHtml(operation.startAt)}</td>
      <td>${escapeHtml(operation.endAt)}</td>
      <td>${operation.locked ? escapeHtml(messages.status.locked) : ''}</td>
    </tr>`)).join('')
  return renderTable([
    messages.tableHeaders.resourceId,
    messages.tableHeaders.operationId,
    messages.tableHeaders.requirementId,
    messages.tableHeaders.startAt,
    messages.tableHeaders.endAt,
    messages.status.locked
  ], rows, messages.empty.noOperations)
}

function renderRequirementTrace(report: Extract<ReportViewModel, { reportType: 'requirement-trace' }>, messages: ReportMessages): string {
  const rows = report.requirements.flatMap((requirement) => requirement.operations.map((operation) => `
    <tr>
      <td>${escapeHtml(requirement.requirementId)}</td>
      <td>${escapeHtml(requirement.itemId)}</td>
      <td>${escapeHtml(operation.operationId)}</td>
      <td>${escapeHtml(operation.resourceId)}</td>
      <td>${escapeHtml(operation.startAt)}</td>
      <td>${escapeHtml(operation.endAt)}</td>
    </tr>`)).join('')
  return renderTable([
    messages.tableHeaders.requirementId,
    messages.tableHeaders.itemId,
    messages.tableHeaders.operationId,
    messages.tableHeaders.resourceId,
    messages.tableHeaders.startAt,
    messages.tableHeaders.endAt
  ], rows, messages.empty.noRequirements)
}

function renderExceptionReview(report: Extract<ReportViewModel, { reportType: 'exception-review' }>, messages: ReportMessages): string {
  const rows = report.exceptions.map((item) => `
    <tr>
      <td>${escapeHtml(item.type)}</td>
      <td>${escapeHtml(statusLabel(item.severity, messages))}</td>
      <td>${escapeHtml(item.requirementId ?? '')}</td>
      <td>${escapeHtml(item.operationId ?? '')}</td>
      <td>${escapeHtml(item.reason)}</td>
      <td>${escapeHtml(item.nextAction)}</td>
    </tr>`).join('')
  return renderTable([
    messages.tableHeaders.type,
    messages.tableHeaders.severity,
    messages.tableHeaders.requirementId,
    messages.tableHeaders.operationId,
    messages.tableHeaders.reason,
    messages.tableHeaders.nextAction
  ], rows, messages.empty.noExceptions)
}

function renderRuleImpact(report: Extract<ReportViewModel, { reportType: 'rule-impact' }>, messages: ReportMessages): string {
  return `<h2>${escapeHtml(messages.tableHeaders.ruleId)}</h2>${renderList(report.appliedRuleIds, messages.empty.noRules)}`
}

function renderPlanDiff(report: Extract<ReportViewModel, { reportType: 'plan-diff' }>, messages: ReportMessages): string {
  return `
    <section class="grid">
      <div class="card"><div class="muted">${escapeHtml(messages.tableHeaders.changeType)}</div><div class="metric">${report.diff.summary.moved}</div><div class="muted">${escapeHtml(messages.reportTitles.planDiff)}</div></div>
      <div class="card"><div class="muted">added</div><div class="metric">${report.diff.summary.added}</div></div>
      <div class="card"><div class="muted">removed</div><div class="metric">${report.diff.summary.removed}</div></div>
      <div class="card"><div class="muted">${escapeHtml(messages.status.unplanned)}</div><div class="metric">${report.diff.summary.unplanned}</div></div>
    </section>
    <h2>${escapeHtml(messages.reportTitles.planDiff)}</h2>
    ${renderDiffChanges('moved', report.diff.movedOperations, messages)}
    <h2>added</h2>
    ${renderDiffChanges('added', report.diff.addedOperations, messages)}
    <h2>removed</h2>
    ${renderDiffChanges('removed', report.diff.removedOperations, messages)}
    <h2>${escapeHtml(messages.status.unplanned)}</h2>
    ${renderUnplanned(report.diff.unplannedOperations, messages)}`
}

function renderDiffChanges(type: string, changes: Extract<ReportViewModel, { reportType: 'plan-diff' }>['diff']['movedOperations'], messages: ReportMessages): string {
  const rows = changes.map((change) => `
    <tr>
      <td>${escapeHtml(type)}</td>
      <td>${escapeHtml(change.operationId)}</td>
      <td>${escapeHtml(change.requirementId)}</td>
      <td>${escapeHtml(`${change.resourceIdBefore ?? ''} ${change.startBefore ?? ''} ${change.endBefore ?? ''}`)}</td>
      <td>${escapeHtml(`${change.resourceIdAfter ?? ''} ${change.startAfter ?? ''} ${change.endAfter ?? ''}`)}</td>
      <td>${escapeHtml(change.reasonRuleIds.join(', '))}</td>
      <td>${escapeHtml(change.externalRef ? `${change.externalRef.system}:${change.externalRef.id}` : '')}</td>
    </tr>`).join('')
  return renderTable([
    messages.tableHeaders.changeType,
    messages.tableHeaders.operationId,
    messages.tableHeaders.requirementId,
    messages.tableHeaders.before,
    messages.tableHeaders.after,
    messages.tableHeaders.ruleId,
    messages.tableHeaders.externalRef
  ], rows, messages.empty.noOperations)
}

function renderScenarioCompare(report: Extract<ReportViewModel, { reportType: 'scenario-compare' }>, messages: ReportMessages): string {
  const rows = report.candidates.map((candidate) => `
    <tr>
      <td>${escapeHtml(candidate.planId)}</td>
      <td>${escapeHtml(candidate.planName)}</td>
      <td><pre>${escapeHtml(JSON.stringify(candidate.comparison, null, 2))}</pre></td>
    </tr>`).join('')
  return renderTable([messages.tableHeaders.id, messages.tableHeaders.name, messages.reportTitles.scenarioCompare], rows, messages.empty.noScenarios)
}

function renderUnplanned(items: Array<{ operationId: string; requirementId: string; reason: string }>, messages: ReportMessages): string {
  const rows = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.operationId)}</td>
      <td>${escapeHtml(item.requirementId)}</td>
      <td>${escapeHtml(item.reason)}</td>
    </tr>`).join('')
  return renderTable([messages.tableHeaders.operationId, messages.tableHeaders.requirementId, messages.tableHeaders.reason], rows, messages.empty.noExceptions)
}

function renderTable(headers: string[], rows: string, empty: string): string {
  if (!rows) return `<div class="card muted">${escapeHtml(empty)}</div>`
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`
}

function renderList(items: string[], empty: string): string {
  if (items.length === 0) return `<div class="card muted">${escapeHtml(empty)}</div>`
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function statusLabel(value: string | undefined, messages: ReportMessages): string {
  if (value === 'active') return messages.status.active
  if (value === 'archived') return messages.status.archived
  if (value === 'blocked') return messages.status.blocked
  if (value === 'warning') return messages.status.warning
  if (value === 'info') return messages.status.info
  return value ?? ''
}
