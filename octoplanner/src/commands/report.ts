import { writeFileSync } from 'node:fs'
import { fail } from '../core/errors'
import { optionalString, requireString } from '../core/flags'
import { readJsonFile } from '../core/json'
import { success } from '../core/result'
import {
  buildExceptionReviewReport,
  buildPlanDiffReport,
  buildPlanOverviewReport,
  buildRequirementTraceReport,
  buildResourceTimelineReport,
  buildRuleImpactReport,
  buildScenarioCompareReport
} from '../domain/report-service'
import { PlanDiffSchema } from '../domain/schemas'
import { renderReportHtml } from '../report/html'
import { parseReportLocale } from '../report/locale'
import { getReportMessages } from '../report/messages'
import { createReportServer } from '../report/server'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandHandler } from './types'
import type { ReportMessages } from '../report/messages'
import type { ReportLocale } from '../report/locale'
import type { ReportViewModel } from '../domain/report-types'

function parsePort(value: string | undefined): number {
  if (value === undefined) return 0
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail('VALIDATION_FAILED', `Invalid port: ${value}`)
  return port
}

export const reportCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const locale = parseReportLocale(optionalString(parsed.flags, 'lang'))

  if (action === 'output') {
    const reportType = parsed.positionals[2]
    if (!reportType) fail('VALIDATION_FAILED', 'Report type is required')
    const format = optionalString(parsed.flags, 'format') ?? 'html'
    if (format !== 'html') fail('UNSUPPORTED_FORMAT', `Unsupported report format: ${format}`)
    validateOutputArguments(reportType, parsed.flags)
    const out = optionalString(parsed.flags, 'out')
    const messages = getReportMessages(locale)
    if (reportType === 'plan-diff') {
      const diff = parseDiffFile(requireString(parsed.flags, 'diff'))
      const report = buildPlanDiffReport({ diff, locale, messages })
      const html = renderReportHtml(report, messages)
      if (out) writeFileSync(out, html)
      return success({ locale, reportType, format, out, html })
    }
    const db = openWorkspace(context.cwd)
    try {
      const repos = createRepositories(db)
      const report = buildReport(repos, reportType, locale, messages, parsed.flags)
      const html = renderReportHtml(report, messages)
      if (out) writeFileSync(out, html)
      return success({ locale, reportType, format, out, html })
    } finally {
      db.close()
    }
  }

  if (action === 'serve') {
    const host = optionalString(parsed.flags, 'host') ?? '127.0.0.1'
    const port = parsePort(optionalString(parsed.flags, 'port'))
    if (context.env.OCTOPLANNER_REPORT_SERVE_DRY_RUN === '1') {
      return success({ action, locale, host, port, dryRun: true })
    }
    const server = createReportServer({ cwd: context.cwd, host, port, locale }).start()
    const actualPort = server.port
    return success({ action, locale, host, port: actualPort, url: `http://${host}:${actualPort}` })
  }

  fail('UNKNOWN_COMMAND', `Unknown report command: ${String(action)}`)
}

function validateOutputArguments(reportType: string, flags: Record<string, string | boolean>): void {
  if (reportType === 'plan-diff') {
    requireString(flags, 'diff')
    return
  }
  if (reportType === 'scenario-compare') {
    requireString(flags, 'scenario')
    return
  }
  if (['plan-overview', 'resource-timeline', 'requirement-trace', 'exception-review', 'rule-impact'].includes(reportType)) {
    requireString(flags, 'plan')
    return
  }
  fail('REPORT_TYPE_UNSUPPORTED', `Unsupported report type: ${reportType}`)
}

function parseDiffFile(file: string) {
  const result = PlanDiffSchema.safeParse(readJsonFile(file))
  if (!result.success) fail('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid plan diff', result.error.issues)
  return result.data
}

function buildReport(
  repos: ReturnType<typeof createRepositories>,
  reportType: string,
  locale: ReportLocale,
  messages: ReportMessages,
  flags: Record<string, string | boolean>
): ReportViewModel {
  if (reportType === 'scenario-compare') {
    const scenario = repos.scenarios.getByNameOrId(requireString(flags, 'scenario'))
    let baselinePlan
    try {
      baselinePlan = repos.plans.getByNameOrId(scenario.fromPlanId)
    } catch {
      baselinePlan = undefined
    }
    return buildScenarioCompareReport({ scenario, baselinePlan, locale, messages })
  }

  const plan = repos.plans.getByNameOrId(requireString(flags, 'plan'))
  if (reportType === 'plan-overview') return buildPlanOverviewReport({ plan, locale, messages })
  if (reportType === 'resource-timeline') return buildResourceTimelineReport({ plan, locale, messages })
  if (reportType === 'requirement-trace') return buildRequirementTraceReport({ plan, locale, messages })
  if (reportType === 'exception-review') return buildExceptionReviewReport({ plan, locale, messages })
  if (reportType === 'rule-impact') return buildRuleImpactReport({ plan, locale, messages })
  fail('REPORT_TYPE_UNSUPPORTED', `Unsupported report type: ${reportType}`)
}
