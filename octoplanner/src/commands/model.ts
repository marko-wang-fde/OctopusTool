import { fail } from '../core/errors'
import { optionalString, requireString } from '../core/flags'
import { success } from '../core/result'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import { parseModelFile, routingCoverage, summarizeModel } from '../domain/model-service'
import type { ModelKind } from '../domain/types'
import type { CommandHandler } from './types'

const modelKinds = new Set(['requirement', 'item', 'routing', 'resource', 'supply'])

function parseKind(value: string | undefined): ModelKind {
  if (!value || !modelKinds.has(value)) fail('UNKNOWN_COMMAND', `Unknown model kind: ${String(value)}`)
  return value as ModelKind
}

export const modelCommand: CommandHandler = (parsed, context) => {
  const kind = parseKind(parsed.positionals[1])
  const action = parsed.positionals[2]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (action === 'load') {
      const payload = parseModelFile(kind, requireString(parsed.flags, 'file'))
      repos.models.saveBatch(kind, payload.id, payload)
      const auditId = repos.audit.write(`model ${kind} load`, { batchId: payload.id })
      return success({ batchId: payload.id }, { auditId })
    }
    if (action === 'list') return success({ batches: repos.models.listBatches(kind) })
    if (action === 'show') {
      const id = requireString(parsed.flags, 'id')
      const batch = repos.models.listBatches(kind).find((item) => item.id === id || item.payload.id === id)
      if (batch) return success(batch.payload)
      const record = repos.models.getRecord(kind, id)
      if (!record) fail('MODEL_RECORD_NOT_FOUND', `MODEL_RECORD_NOT_FOUND: ${kind}:${id}`)
      return success(record)
    }
    if (action === 'validate') {
      const payload = parseModelFile(kind, requireString(parsed.flags, 'file'))
      return success({ valid: true, id: payload.id })
    }
    if (action === 'summary') return success(summarizeModel(kind, repos.models.listBatches(kind)))
    if (kind === 'routing' && action === 'coverage') {
      const reqBatchId = optionalString(parsed.flags, 'requirements')
      const routingBatchId = optionalString(parsed.flags, 'routings')
      const req = reqBatchId ? repos.models.getBatch(reqBatchId) : repos.models.latestBatch('requirement')?.payload
      const routing = routingBatchId ? repos.models.getBatch(routingBatchId) : repos.models.latestBatch('routing')?.payload
      return success(routingCoverage(req?.requirements ?? [], routing?.routings ?? []))
    }
    if (kind === 'resource' && action === 'timeline') return success({ resources: repos.models.listRecords('resource'), timeline: [] })
    if (kind === 'supply' && action === 'availability') return success({ supplies: repos.models.listRecords('supply') })
    fail('UNKNOWN_COMMAND', `Unknown model command: model ${kind} ${String(action)}`)
  } finally {
    db.close()
  }
}
