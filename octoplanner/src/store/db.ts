import { Database } from 'bun:sqlite'

export type WorkspaceDb = Database

export function openDb(path: string): WorkspaceDb {
  return new Database(path, { create: true })
}
