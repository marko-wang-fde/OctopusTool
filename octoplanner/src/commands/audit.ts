import { fail } from '../core/errors'
import { parseLimit, requireString } from '../core/flags'
import { success } from '../core/result'
import { createRepositories } from '../store/repositories'
import { openWorkspace } from '../store/workspace'
import type { CommandHandler } from './types'

export const auditCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  const db = openWorkspace(context.cwd)
  try {
    const repos = createRepositories(db)
    if (action === 'log') return success({ logs: repos.audit.list({ limit: parseLimit(parsed.flags, 50) }) })
    if (action === 'show') return success(repos.audit.get(requireString(parsed.flags, 'id')))
    fail('UNKNOWN_COMMAND', `Unknown audit command: ${String(action)}`)
  } finally {
    db.close()
  }
}
