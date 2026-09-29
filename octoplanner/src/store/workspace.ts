import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fail } from '../core/errors'
import { openDb, type WorkspaceDb } from './db'
import { migrate, SCHEMA_VERSION } from './migrations'

export function workspaceDir(cwd: string): string {
  return path.join(cwd, '.octoplanner')
}

export function workspaceDbPath(cwd: string): string {
  return path.join(workspaceDir(cwd), 'workspace.db')
}

export function initWorkspace(cwd: string): { dbPath: string; schemaVersion: number } {
  const dir = workspaceDir(cwd)
  const dbPath = workspaceDbPath(cwd)
  if (existsSync(dbPath)) fail('WORKSPACE_EXISTS', `WORKSPACE_EXISTS: Workspace already exists: ${dbPath}`)
  mkdirSync(dir, { recursive: true })
  const db = openDb(dbPath)
  migrate(db)
  db.close()
  return { dbPath, schemaVersion: SCHEMA_VERSION }
}

export function openWorkspace(cwd: string): WorkspaceDb {
  const dbPath = workspaceDbPath(cwd)
  if (!existsSync(dbPath)) fail('WORKSPACE_NOT_FOUND', `Workspace not found: ${dbPath}`)
  return openDb(dbPath)
}

export function workspaceStatus(db: WorkspaceDb): { schemaVersion: number; modelBatches: number; rules: number; plans: number; scenarios: number } {
  const schemaVersion = Number((db.query('select value from meta where key = ?').get('schemaVersion') as { value: string } | null)?.value ?? 0)
  const count = (table: string) => Number((db.query(`select count(*) as count from ${table}`).get() as { count: number }).count)
  return {
    schemaVersion,
    modelBatches: count('model_batches'),
    rules: count('rules'),
    plans: count('plans'),
    scenarios: count('scenarios')
  }
}

export function doctorWorkspace(db: WorkspaceDb): { ok: true; schemaVersion: number } {
  const status = workspaceStatus(db)
  if (status.schemaVersion !== SCHEMA_VERSION) fail('SCHEMA_VERSION_UNSUPPORTED', `Unsupported schema version: ${status.schemaVersion}`)
  return { ok: true, schemaVersion: status.schemaVersion }
}
