import { fail } from '../core/errors'
import { optionalString, requireString } from '../core/flags'
import { writeJsonFile } from '../core/json'
import { success } from '../core/result'
import { buildCase, validateCase } from '../domain/case-service'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { ModelKind } from '../domain/types'
import type { CommandHandler } from './types'

const kinds: ModelKind[] = ['requirement', 'item', 'routing', 'resource', 'supply']

export const caseCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (action === 'create') {
      const modelBatchIds: Record<string, string | undefined> = {}
      for (const kind of kinds) modelBatchIds[kind] = optionalString(parsed.flags, `${kind}s`) ?? repos.models.latestBatch(kind)?.id
      const baselinePlanId = optionalString(parsed.flags, 'baseline-plan')
      const payload = buildCase({
        name: requireString(parsed.flags, 'name'),
        modelBatchIds,
        ruleIds: repos.rules.list().map((rule) => rule.id),
        ...(baselinePlanId ? { baselinePlanId } : {})
      })
      repos.cases.save(payload)
      const auditId = repos.audit.write('case create', { id: payload.id, name: payload.name })
      return success(payload, { auditId })
    }
    if (action === 'list') return success({ cases: repos.cases.list() })
    if (action === 'show') return success(repos.cases.getByNameOrId(requireString(parsed.flags, 'case')))
    if (action === 'validate' || action === 'summary' || action === 'export') {
      const payload = repos.cases.getByNameOrId(requireString(parsed.flags, 'case'))
      const materialized = materializeCase(repos, payload)
      const validation = validateCase(materialized)
      if (action === 'validate') {
        if (!validation.valid) fail('CASE_INVALID', 'CASE_INVALID: case validation failed', validation.errors)
        return success({ valid: true, errors: [], summary: validation.summary }, { notModeled: validation.notModeled })
      }
      if (action === 'summary') return success(validation.summary, { notModeled: validation.notModeled })
      const out = optionalString(parsed.flags, 'out')
      const exported = { ...payload, materialized: materializedForExport(materialized), validation }
      if (out) writeJsonFile(out, exported)
      return success(exported, { notModeled: validation.notModeled })
    }
    fail('UNKNOWN_COMMAND', `Unknown case command: ${String(action)}`)
  } finally {
    db.close()
  }
}

export function materializeCase(repos: ReturnType<typeof createRepositories>, casePayload: any) {
  const batch = (kind: ModelKind) => casePayload.modelBatchIds[kind] ? repos.models.getBatch(casePayload.modelBatchIds[kind]) : undefined
  return {
    casePayload,
    requirements: batch('requirement')?.requirements ?? [],
    items: batch('item')?.items ?? [],
    routings: batch('routing')?.routings ?? [],
    resources: batch('resource')?.resources ?? [],
    supplies: batch('supply')?.supplies ?? [],
    rules: casePayload.ruleIds.map((id: string) => repos.rules.get(id))
  }
}

function materializedForExport(materialized: ReturnType<typeof materializeCase>) {
  return {
    requirements: materialized.requirements,
    items: materialized.items,
    routings: materialized.routings,
    resources: materialized.resources,
    supplies: materialized.supplies,
    rules: materialized.rules
  }
}
