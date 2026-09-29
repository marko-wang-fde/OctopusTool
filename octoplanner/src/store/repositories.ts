import { fail } from '../core/errors'
import { createId, nowIso } from '../core/ids'
import type { ModelKind } from '../domain/types'
import type { WorkspaceDb } from './db'

function stringify(value: unknown): string {
  return JSON.stringify(value)
}

function parse<T>(value: string): T {
  return JSON.parse(value) as T
}

type Row = Record<string, unknown>

function getPayload<T>(row: Row | null | undefined, code: string, message: string): T {
  if (!row) fail(code, message)
  return parse<T>(String(row.payload_json))
}

export function createRepositories(db: WorkspaceDb) {
  return {
    models: {
      saveBatch(kind: ModelKind, id: string, payload: any): void {
        const createdAt = nowIso()
        db.transaction(() => {
          db.query('insert into model_batches(id, kind, created_at, payload_json) values (?, ?, ?, ?)').run(id, kind, createdAt, stringify(payload))
          const records = recordsForBatch(kind, id, payload)
          const stmt = db.query('insert into model_records(id, batch_id, kind, domain_id, payload_json) values (?, ?, ?, ?, ?)')
          for (const record of records) stmt.run(`${id}:${record.domainId}`, id, kind, record.domainId, stringify(record.payload))
        })()
      },
      listBatches(kind?: ModelKind): any[] {
        const rows = kind
          ? db.query('select * from model_batches where kind = ? order by created_at desc').all(kind)
          : db.query('select * from model_batches order by created_at desc').all()
        return rows.map((row) => ({ ...(row as Row), payload: parse(String((row as Row).payload_json)) }))
      },
      latestBatch(kind: ModelKind): any | undefined {
        const row = db.query('select * from model_batches where kind = ? order by created_at desc limit 1').get(kind) as Row | null
        return row ? { ...row, payload: parse(String(row.payload_json)) } : undefined
      },
      getBatch(id: string): any {
        const row = db.query('select * from model_batches where id = ?').get(id) as Row | null
        return getPayload(row, 'MODEL_BATCH_NOT_FOUND', `Model batch not found: ${id}`)
      },
      listRecords(kind?: ModelKind): any[] {
        const rows = kind
          ? db.query('select * from model_records where kind = ? order by id').all(kind)
          : db.query('select * from model_records order by kind, id').all()
        return rows.map((row) => ({ ...(row as Row), payload: parse(String((row as Row).payload_json)) }))
      },
      getRecord(kind: ModelKind, domainId: string): any | undefined {
        const row = db.query('select * from model_records where kind = ? and domain_id = ? order by id desc limit 1').get(kind, domainId) as Row | null
        return row ? parse(String(row.payload_json)) : undefined
      }
    },
    rules: {
      save(rule: any): void {
        db.query('insert into rules(id, enabled, expires_at, created_at, payload_json) values (?, ?, ?, ?, ?)').run(
          rule.id,
          rule.enabled === false ? 0 : 1,
          rule.expiresAt ?? null,
          rule.createdAt ?? nowIso(),
          stringify(rule)
        )
      },
      list(input: { includeDisabled?: boolean } = {}): any[] {
        const rows = input.includeDisabled
          ? db.query('select * from rules order by created_at desc').all()
          : db.query('select * from rules where enabled = 1 order by created_at desc').all()
        return rows.map((row) => parse(String((row as Row).payload_json)))
      },
      get(id: string): any {
        const row = db.query('select * from rules where id = ?').get(id) as Row | null
        return getPayload(row, 'RULE_NOT_FOUND', `Rule not found: ${id}`)
      },
      update(id: string, patch: Record<string, unknown>): any {
        const current = this.get(id)
        const next = { ...current, ...patch }
        db.query('update rules set enabled = ?, expires_at = ?, payload_json = ? where id = ?').run(next.enabled === false ? 0 : 1, next.expiresAt ?? null, stringify(next), id)
        return next
      },
      remove(id: string): void {
        const result = db.query('delete from rules where id = ?').run(id)
        if (result.changes === 0) fail('RULE_NOT_FOUND', `Rule not found: ${id}`)
      }
    },
    cases: namedRepo(db, 'cases', 'CASE_NOT_FOUND'),
    plans: {
      ...namedRepo(db, 'plans', 'PLAN_NOT_FOUND'),
      archive(value: string): any {
        const plan = this.getByNameOrId(value)
        const next = { ...plan, state: 'archived' }
        db.query('update plans set state = ?, archived_at = ?, payload_json = ? where id = ?').run('archived', nowIso(), stringify(next), plan.id)
        return next
      }
    },
    scenarios: namedRepo(db, 'scenarios', 'SCENARIO_NOT_FOUND'),
    audit: {
      write(command: string, payload: unknown): string {
        const id = createId('audit')
        db.query('insert into audit_logs(id, command, created_at, payload_json) values (?, ?, ?, ?)').run(id, command, nowIso(), stringify(payload))
        return id
      },
      list(input: { limit?: number } = {}): any[] {
        return db.query('select * from audit_logs order by created_at desc limit ?').all(input.limit ?? 50).map((row) => ({
          id: (row as Row).id,
          command: (row as Row).command,
          createdAt: (row as Row).created_at,
          payload: parse(String((row as Row).payload_json))
        }))
      },
      get(id: string): any {
        const row = db.query('select * from audit_logs where id = ?').get(id) as Row | null
        if (!row) fail('AUDIT_NOT_FOUND', `Audit log not found: ${id}`)
        return { id: row.id, command: row.command, createdAt: row.created_at, payload: parse(String(row.payload_json)) }
      }
    }
  }
}

function recordsForBatch(kind: ModelKind, batchId: string, payload: any): Array<{ domainId: string; payload: unknown }> {
  if (kind === 'requirement') return payload.requirements.map((item: any) => ({ domainId: item.id, payload: item }))
  if (kind === 'item') return payload.items.map((item: any) => ({ domainId: item.id, payload: item }))
  if (kind === 'routing') return payload.routings.map((item: any) => ({ domainId: item.id ?? item.itemId, payload: { ...item, id: item.id ?? `${batchId}:${item.itemId}` } }))
  if (kind === 'resource') return payload.resources.map((item: any) => ({ domainId: item.id, payload: item }))
  return payload.supplies.map((item: any) => ({ domainId: item.id, payload: item }))
}

function namedRepo(db: WorkspaceDb, table: 'cases' | 'plans' | 'scenarios', notFoundCode: string) {
  return {
    save(payload: any): void {
      const state = payload.state ?? 'active'
      db.query(`insert into ${table}(id, name, ${table === 'cases' ? '' : 'state,'} created_at, payload_json) values (${table === 'cases' ? '?, ?, ?, ?' : '?, ?, ?, ?, ?'})`)
        .run(...(table === 'cases' ? [payload.id, payload.name, payload.createdAt, stringify(payload)] : [payload.id, payload.name, state, payload.createdAt, stringify(payload)]))
    },
    update(payload: any): void {
      if (table === 'cases') {
        db.query(`update ${table} set payload_json = ? where id = ?`).run(stringify(payload), payload.id)
      } else {
        db.query(`update ${table} set state = ?, payload_json = ? where id = ?`).run(payload.state ?? 'active', stringify(payload), payload.id)
      }
    },
    list(input: { includeArchived?: boolean } = {}): any[] {
      const rows = table === 'plans' && !input.includeArchived
        ? db.query(`select * from ${table} where state != 'archived' order by created_at desc`).all()
        : db.query(`select * from ${table} order by created_at desc`).all()
      return rows.map((row) => parse(String((row as Row).payload_json)))
    },
    getByNameOrId(value: string): any {
      const row = db.query(`select * from ${table} where id = ? or name = ?`).get(value, value) as Row | null
      return getPayload(row, notFoundCode, `${table.slice(0, -1)} not found: ${value}`)
    }
  }
}
