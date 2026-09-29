import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { initWorkspace, openWorkspace, workspaceStatus } from '../../src/store/workspace'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

describe('workspace', () => {
  it('initializes sqlite workspace exactly once', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    const initialized = initWorkspace(dir)
    expect(initialized.dbPath.endsWith('.octoplanner/workspace.db')).toBe(true)
    const db = openWorkspace(dir)
    expect(workspaceStatus(db).schemaVersion).toBe(1)
    db.close()
    expect(() => initWorkspace(dir!)).toThrow(/WORKSPACE_EXISTS/)
  })
})
