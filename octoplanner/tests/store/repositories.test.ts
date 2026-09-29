import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createRepositories } from '../../src/store/repositories'
import { initWorkspace, openWorkspace } from '../../src/store/workspace'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('repositories', () => {
  it('stores and lists model batches with audit logs', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    initWorkspace(dir)
    const db = openWorkspace(dir)
    const repos = createRepositories(db)

    repos.models.saveBatch('requirement', 'batch_1', { id: 'batch_1', requirements: [] })
    repos.audit.write('model requirement load', { batchId: 'batch_1' })

    expect(repos.models.listBatches('requirement')).toHaveLength(1)
    expect(repos.audit.list({ limit: 10 })).toHaveLength(1)
    db.close()
  })
})
