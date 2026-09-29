import { existsSync } from 'node:fs'
import path from 'node:path'
import { readJsonFile } from '../core/json'
import { OctoplannerError } from '../core/errors'
import { failure, success } from '../core/result'
import {
  buildExceptionReviewReport,
  buildPlanOverviewReport,
  buildPlanDiffReport,
  buildRequirementTraceReport,
  buildResourceTimelineReport,
  buildRuleImpactReport,
  buildScenarioCompareReport
} from '../domain/report-service'
import { PlanDiffSchema } from '../domain/schemas'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import { SUPPORTED_REPORT_LOCALES, type ReportLocale } from './locale'
import { getReportMessages } from './messages'

export type ReportServerOptions = {
  cwd: string
  host: string
  port: number
  locale: ReportLocale
  webRoot?: string
}

export type ReportServer = {
  fetch(request: Request): Promise<Response>
  start(): ReturnType<typeof Bun.serve>
}

export function createReportServer(options: ReportServerOptions): ReportServer {
  const fetch = async (request: Request) => handleReportRequest(request, options)
  return {
    fetch,
    start() {
      return Bun.serve({
        hostname: options.host,
        port: options.port,
        fetch
      })
    }
  }
}

async function handleReportRequest(request: Request, options: ReportServerOptions): Promise<Response> {
  try {
    if (request.method !== 'GET') return json(failure('METHOD_NOT_ALLOWED', `Method not allowed: ${request.method}`), 405)
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
    if (parts[0] !== 'api') return serveStatic(url.pathname, options)

    if (parts.length === 2 && parts[1] === 'config') {
      return json(success({ locale: options.locale, supportedLocales: SUPPORTED_REPORT_LOCALES, readOnly: true }))
    }
    if (parts.length === 2 && parts[1] === 'health') {
      return json(success({ status: 'ok', locale: options.locale }))
    }
    if (parts.length === 2 && parts[1] === 'diff') {
      const file = url.searchParams.get('file')
      if (!file) return json(failure('ARGUMENT_REQUIRED', 'ARGUMENT_REQUIRED: --diff file is required'), 400)
      const result = PlanDiffSchema.safeParse(readJsonFile(file))
      if (!result.success) return json(failure('VALIDATION_FAILED', 'VALIDATION_FAILED: invalid plan diff', result.error.issues), 400)
      return json(success(buildPlanDiffReport({ diff: result.data, locale: options.locale, messages: getReportMessages(options.locale) })))
    }

    return withRepos(options.cwd, (repos) => {
      const messages = getReportMessages(options.locale)

      if (parts.length === 2 && parts[1] === 'plans') {
        return json(success({ plans: repos.plans.list() }))
      }

      if (parts.length === 4 && parts[1] === 'plans') {
        const plan = repos.plans.getByNameOrId(parts[2]!)
        const section = parts[3]
        if (section === 'overview') return json(success(buildPlanOverviewReport({ plan, locale: options.locale, messages }), { notModeled: plan.notModeled }))
        if (section === 'timeline') return json(success(buildResourceTimelineReport({ plan, locale: options.locale, messages }), { notModeled: plan.notModeled }))
        if (section === 'requirements') return json(success(buildRequirementTraceReport({ plan, locale: options.locale, messages }), { notModeled: plan.notModeled }))
        if (section === 'exceptions') return json(success(buildExceptionReviewReport({ plan, locale: options.locale, messages }), { notModeled: plan.notModeled }))
        if (section === 'rules') return json(success(buildRuleImpactReport({ plan, locale: options.locale, messages }), { notModeled: plan.notModeled }))
      }

      if (parts.length === 2 && parts[1] === 'scenarios') {
        return json(success({ scenarios: repos.scenarios.list() }))
      }

      if (parts.length === 4 && parts[1] === 'scenarios' && parts[3] === 'compare') {
        const scenario = repos.scenarios.getByNameOrId(parts[2]!)
        let baselinePlan
        try {
          baselinePlan = repos.plans.getByNameOrId(scenario.fromPlanId)
        } catch {
          baselinePlan = undefined
        }
        return json(success(buildScenarioCompareReport({ scenario, ...(baselinePlan ? { baselinePlan } : {}), locale: options.locale, messages })))
      }

      return json(failure('NOT_FOUND', `Route not found: ${url.pathname}`), 404)
    })
  } catch (error) {
    if (error instanceof OctoplannerError) return json(failure(error.code, error.message, error.issues), 400)
    return json(failure('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error'), 500)
  }
}

async function serveStatic(pathname: string, options: ReportServerOptions): Promise<Response> {
  const webRoot = options.webRoot ?? path.resolve(import.meta.dir, '../../dist/report-web')
  const indexPath = path.join(webRoot, 'index.html')
  if (!existsSync(indexPath)) {
    return json(failure('REPORT_WEB_BUILD_MISSING', 'Report web build is missing. Run npm run build:report-web first.'), 503)
  }

  const safePath = normalizeStaticPath(pathname)
  const candidate = path.resolve(webRoot, safePath)
  const file = safePath ? Bun.file(candidate) : Bun.file(indexPath)
  if (safePath && candidate.startsWith(path.resolve(webRoot)) && existsSync(candidate)) {
    return new Response(file, { headers: { 'content-type': contentType(candidate) } })
  }
  return new Response(Bun.file(indexPath), { headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function normalizeStaticPath(pathname: string): string {
  const normalized = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  return normalized === '/' || normalized === '.' ? '' : normalized.replace(/^[/\\]/, '')
}

function contentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  return 'application/octet-stream'
}

function withRepos(cwd: string, fn: (repos: ReturnType<typeof createRepositories>) => Response): Response {
  const db = openWorkspace(cwd)
  try {
    return fn(createRepositories(db))
  } finally {
    db.close()
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(value)}\n`, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  })
}
