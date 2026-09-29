import { fail } from '../core/errors'
import { success } from '../core/result'
import { doctorWorkspace, initWorkspace, openWorkspace, workspaceStatus } from '../store/workspace'
import type { CommandHandler } from './types'

export const workspaceCommand: CommandHandler = (parsed, context) => {
  const action = parsed.positionals[1]
  if (action === 'init') return success(initWorkspace(context.cwd))
  if (action === 'status') {
    const db = openWorkspace(context.cwd)
    try {
      return success(workspaceStatus(db))
    } finally {
      db.close()
    }
  }
  if (action === 'doctor') {
    const db = openWorkspace(context.cwd)
    try {
      return success(doctorWorkspace(db))
    } finally {
      db.close()
    }
  }
  if (action === 'config') return success({ timezone: 'UTC', output: 'json', strategy: 'deterministic' })
  fail('UNKNOWN_COMMAND', `Unknown workspace command: ${String(action)}`)
}
