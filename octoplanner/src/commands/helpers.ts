import { success, type CliSuccess } from '../core/result'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandContext } from './types'

export function withWorkspace<T>(
  context: CommandContext,
  command: string,
  action: (repos: ReturnType<typeof createRepositories>) => T,
  auditPayload?: unknown
): CliSuccess<T> {
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    const data = action(repos)
    const auditId = auditPayload === undefined ? undefined : repos.audit.write(command, auditPayload)
    return success(data, auditId ? { auditId } : {})
  } finally {
    db.close()
  }
}
