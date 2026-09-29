import type { WorkspaceDb } from './db'

export const SCHEMA_VERSION = 1

export function migrate(db: WorkspaceDb): void {
  db.exec(`
    create table if not exists meta (
      key text primary key,
      value text not null
    );
    create table if not exists model_batches (
      id text primary key,
      kind text not null,
      created_at text not null,
      payload_json text not null
    );
    create table if not exists model_records (
      id text primary key,
      batch_id text not null,
      kind text not null,
      domain_id text not null,
      payload_json text not null
    );
    create table if not exists rules (
      id text primary key,
      enabled integer not null,
      expires_at text,
      created_at text not null,
      payload_json text not null
    );
    create table if not exists cases (
      id text primary key,
      name text not null unique,
      created_at text not null,
      payload_json text not null
    );
    create table if not exists plans (
      id text primary key,
      name text not null unique,
      state text not null,
      created_at text not null,
      archived_at text,
      payload_json text not null
    );
    create table if not exists scenarios (
      id text primary key,
      name text not null unique,
      state text not null,
      created_at text not null,
      payload_json text not null
    );
    create table if not exists audit_logs (
      id text primary key,
      command text not null,
      created_at text not null,
      payload_json text not null
    );
    create index if not exists idx_model_batches_kind on model_batches(kind);
    create index if not exists idx_model_records_kind on model_records(kind);
    create index if not exists idx_model_records_domain on model_records(kind, domain_id);
  `)
  db.query('insert or replace into meta(key, value) values (?, ?)').run('schemaVersion', String(SCHEMA_VERSION))
}
