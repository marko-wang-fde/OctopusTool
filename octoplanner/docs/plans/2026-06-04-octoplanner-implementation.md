# Octoplanner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete `octoplanner` TypeScript CLI for AI Agent-driven production scheduling with a strict domain model, SQLite workspace, Zod validation, deterministic planning, impact analysis, scenario simulation, explanations, and audit logs.

**Architecture:** The CLI is a Bun-first TypeScript application with npm-managed dependencies. It uses Zod as the single validation path, Bun's built-in SQLite as the persistent workspace, a repository layer for all state transitions, and command handlers that always emit the same JSON success/error envelope. The planner engine is deterministic and local: it expands requirements through routings into operations, applies rules and optional supply/resource constraints, creates schedules, computes metrics, supports repair/optimize scenario simulation, and records all mutating operations in audit logs.

**Tech Stack:** TypeScript, Bun runtime, npm scripts, Zod, Bun `bun:sqlite`, Vitest, Node/Bun standard libraries only.

---

## Global Rules For Implementation

- Use `npm` for dependency management. Do not use `pnpm`.
- Default execution path is Bun: `npm run octoplanner -- ...` and `bun src/cli.ts ...`.
- Use Zod for every JSON input and every parsed CLI command payload before it reaches storage or planner logic.
- Use one output envelope everywhere:

```ts
type CliSuccess<T> = {
  ok: true
  data: T
  warnings: Warning[]
  notModeled: string[]
  auditId?: string
}

type CliFailure = {
  ok: false
  error: {
    code: string
    message: string
    issues?: unknown[]
  }
}
```

- Fastfail on invalid command, invalid args, invalid JSON, invalid schema, missing workspace, missing object, conflicting state, or storage errors.
- Do not implement compatibility aliases or fallback parsing.
- Do not parse arbitrary Excel/ERP formats. `octoplanner` only accepts its own JSON schemas.
- All commands default to JSON output. `--format table` can be accepted only where explicitly implemented.
- Use deterministic IDs in tests where practical; production IDs can use timestamp + random suffix.
- Every mutating command writes an audit log row.
- No command should silently create a workspace except `workspace init`.

## Target Command Tree

```text
octoplanner
  workspace init|status|config|doctor
  schema list|show|check|example
  model requirement load|list|show|validate|summary
  model item load|list|show|validate
  model routing load|list|show|validate|coverage
  model resource load|list|show|validate|timeline
  model supply load|list|show|validate|availability
  rule add|load|list|show|remove|enable|disable|expire|validate
  case create|list|show|validate|summary|export
  plan create|load|list|show|summary|timeline|metrics|export|compare|archive
  impact analyze|trace
  scenario create|list|show|simulate|compare|commit|discard
  explain plan|requirement|order|operation|resource|rule|scenario
  audit log|show
```

## Task 0: Commit Current Documentation Baseline

**Files:**
- Existing: `/Users/wanglei/Projects/syngy/octoplanner/docs/design/product-design.md`
- Existing: `/Users/wanglei/Projects/syngy/octoplanner/docs/meeting.md`
- Existing: `/Users/wanglei/Projects/syngy/octoplanner/docs/plans/2026-06-04-octoplanner-implementation.md`

**Step 1: Inspect git status**

Run:

```bash
git status --short --branch
```

Expected: repo has no commits and `docs/` is untracked.

**Step 2: Commit docs baseline**

Run:

```bash
git add docs
git commit -m "docs: add octoplanner product and implementation plans"
```

Expected: initial commit succeeds.

## Task 1: Scaffold Bun-first TypeScript Package

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/package.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/tsconfig.json`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/vitest.config.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/index.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/tests/cli.test.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/.gitignore`

**Step 1: Write failing CLI smoke test**

Create `tests/cli.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'

describe('cli smoke', () => {
  it('prints version envelope', async () => {
    const result = await runCli(['--version'], { cwd: process.cwd(), env: {} })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      data: { name: 'octoplanner' }
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/cli.test.ts
```

Expected: fails because `package.json` and `src/cli.ts` do not exist.

**Step 3: Add package setup**

Create `package.json`:

```json
{
  "name": "@syngy/octoplanner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "octoplanner": "src/cli.ts"
  },
  "scripts": {
    "octoplanner": "bun src/cli.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && npm test"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/bun": "^1.2.0",
    "typescript": "^5.5.4",
    "vitest": "^3.0.8"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["bun", "vitest/globals"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.octoplanner/
*.db
*.db-shm
*.db-wal
.DS_Store
```

**Step 4: Add minimal CLI**

Create `src/index.ts`:

```ts
export const VERSION = '0.1.0'
```

Create `src/cli.ts`:

```ts
#!/usr/bin/env bun
import { VERSION } from './index'

export type CliRunContext = {
  cwd: string
  env: Record<string, string | undefined>
}

export type CliRunResult = {
  exitCode: number
  stdout: string
  stderr: string
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

export async function runCli(argv: string[], _context: CliRunContext): Promise<CliRunResult> {
  if (argv.length === 1 && argv[0] === '--version') {
    return {
      exitCode: 0,
      stdout: json({ ok: true, data: { name: 'octoplanner', version: VERSION }, warnings: [], notModeled: [] }),
      stderr: ''
    }
  }

  return {
    exitCode: 2,
    stdout: '',
    stderr: json({ ok: false, error: { code: 'UNKNOWN_COMMAND', message: 'Unknown command' } })
  }
}

if (import.meta.main) {
  const result = await runCli(Bun.argv.slice(2), { cwd: process.cwd(), env: process.env })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  process.exit(result.exitCode)
}
```

**Step 5: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created. No `pnpm-lock.yaml`.

**Step 6: Run tests and typecheck**

Run:

```bash
npm run check
```

Expected: tests and typecheck pass.

**Step 7: Commit**

Run:

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src tests
git commit -m "chore: scaffold octoplanner cli"
```

## Task 2: Define Output Envelope, Fastfail Errors, Argument Parser

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/core/result.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/core/errors.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/core/args.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/core/args.test.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/cli-errors.test.ts`

**Step 1: Write failing tests**

Create `tests/core/args.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseArgs } from '../../src/core/args'

describe('parseArgs', () => {
  it('parses positional command and flags', () => {
    expect(parseArgs(['rule', 'add', '--type', 'not-start-until', '--enabled'])).toEqual({
      positionals: ['rule', 'add'],
      flags: { type: 'not-start-until', enabled: true }
    })
  })

  it('fails on duplicate flags', () => {
    expect(() => parseArgs(['--file', 'a.json', '--file', 'b.json'])).toThrow(/ARGUMENT_DUPLICATE/)
  })
})
```

Create `tests/cli-errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { runCli } from '../src/cli'

describe('cli errors', () => {
  it('returns JSON fastfail envelope for unknown command', async () => {
    const result = await runCli(['bad'], { cwd: process.cwd(), env: {} })
    expect(result.exitCode).toBe(2)
    expect(JSON.parse(result.stderr)).toEqual({
      ok: false,
      error: { code: 'UNKNOWN_COMMAND', message: 'Unknown command: bad' }
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/core/args.test.ts tests/cli-errors.test.ts
```

Expected: fails because modules do not exist.

**Step 3: Implement result/error/args**

Create `src/core/result.ts`:

```ts
export type Warning = { code: string; message: string; details?: unknown }

export type CliSuccess<T> = {
  ok: true
  data: T
  warnings: Warning[]
  notModeled: string[]
  auditId?: string
}

export type CliFailure = {
  ok: false
  error: {
    code: string
    message: string
    issues?: unknown[]
  }
}

export function success<T>(data: T, input: { warnings?: Warning[]; notModeled?: string[]; auditId?: string } = {}): CliSuccess<T> {
  return {
    ok: true,
    data,
    warnings: input.warnings ?? [],
    notModeled: input.notModeled ?? [],
    ...(input.auditId ? { auditId: input.auditId } : {})
  }
}

export function failure(code: string, message: string, issues?: unknown[]): CliFailure {
  return { ok: false, error: { code, message, ...(issues ? { issues } : {}) } }
}
```

Create `src/core/errors.ts`:

```ts
export class OctoplannerError extends Error {
  readonly code: string
  readonly issues?: unknown[]

  constructor(code: string, message: string, issues?: unknown[]) {
    super(message)
    this.name = 'OctoplannerError'
    this.code = code
    this.issues = issues
  }
}

export function fail(code: string, message: string, issues?: unknown[]): never {
  throw new OctoplannerError(code, message, issues)
}
```

Create `src/core/args.ts`:

```ts
import { fail } from './errors'

export type ParsedArgs = {
  positionals: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = []
  const flags: Record<string, string | boolean> = {}

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) continue
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const key = token.slice(2)
    if (!key) fail('ARGUMENT_INVALID', 'Empty flag name is not allowed')
    if (Object.prototype.hasOwnProperty.call(flags, key)) fail('ARGUMENT_DUPLICATE', `Duplicate flag: --${key}`)

    const next = argv[index + 1]
    if (next && !next.startsWith('--')) {
      flags[key] = next
      index += 1
    } else {
      flags[key] = true
    }
  }

  return { positionals, flags }
}
```

**Step 4: Wire CLI error envelope**

Modify `src/cli.ts` so `runCli` catches `OctoplannerError`, uses `parseArgs`, and emits exact unknown command message:

```ts
import { parseArgs } from './core/args'
import { OctoplannerError } from './core/errors'
import { failure, success } from './core/result'
```

Inside `runCli`, wrap dispatch in `try/catch`. Unknown commands must return stderr JSON with code `UNKNOWN_COMMAND`.

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: all tests pass.

**Step 6: Commit**

Run:

```bash
git add src/core src/cli.ts tests/core tests/cli-errors.test.ts
git commit -m "feat: add cli result and argument contracts"
```

## Task 3: Define Zod Domain Schemas and Schema Registry

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/schemas.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/types.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/examples.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/schema-registry.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/domain/schemas.test.ts`

**Step 1: Write failing schema tests**

Create `tests/domain/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { RequirementBatchSchema, RuleSchema, RoutingBatchSchema } from '../../src/domain/schemas'
import { SCHEMA_REGISTRY } from '../../src/domain/schema-registry'

describe('domain schemas', () => {
  it('validates requirement batches', () => {
    const parsed = RequirementBatchSchema.parse({
      id: 'req_batch_1',
      requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 10, dueAt: '2026-03-12T00:00:00.000Z' }]
    })
    expect(parsed.requirements[0]?.id).toBe('REQ-1')
  })

  it('rejects non-positive quantities', () => {
    expect(() => RequirementBatchSchema.parse({
      id: 'bad',
      requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 0 }]
    })).toThrow()
  })

  it('validates not-start-until rules', () => {
    const parsed = RuleSchema.parse({
      id: 'rule_1',
      type: 'not-start-until',
      target: { kind: 'requirement', id: 'REQ-1' },
      until: '2026-03-12T00:00:00.000Z',
      enabled: true
    })
    expect(parsed.type).toBe('not-start-until')
  })

  it('requires routing operations', () => {
    expect(() => RoutingBatchSchema.parse({ id: 'routing_batch_1', routings: [] })).not.toThrow()
  })

  it('registers public schemas', () => {
    expect(Object.keys(SCHEMA_REGISTRY)).toContain('model.requirement')
    expect(Object.keys(SCHEMA_REGISTRY)).toContain('rule')
  })
})
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --run tests/domain/schemas.test.ts
```

Expected: fails because schema files do not exist.

**Step 3: Implement schemas**

Create `src/domain/schemas.ts` with Zod schemas for:

- `ExternalRefSchema`
- `RequirementSchema`, `RequirementBatchSchema`
- `ItemSchema`, `ItemBatchSchema`
- `RoutingSchema`, `RoutingBatchSchema`
- `ResourceSchema`, `ResourceBatchSchema`
- `SupplySchema`, `SupplyBatchSchema`
- `RuleSchema`, `RuleBatchSchema`
- `CaseSchema`
- `PlanSchema`
- `ScenarioSchema`
- timeline, metric, explanation helper schemas where useful

Important modeling rules:

```ts
import { z } from 'zod'

export const IdSchema = z.string().min(1)
export const IsoDateTimeSchema = z.string().datetime()

export const TargetSchema = z.object({
  kind: z.enum(['requirement', 'item', 'operation', 'resource', 'supply']),
  id: IdSchema
})

export const RequirementSchema = z.object({
  id: IdSchema,
  itemId: IdSchema,
  quantity: z.number().positive(),
  dueAt: IsoDateTimeSchema.optional(),
  priority: z.number().finite().optional(),
  customer: z.string().min(1).optional(),
  vehicleModel: z.string().min(1).optional(),
  attributes: z.record(z.string()).optional(),
  externalRef: z.object({
    system: z.string().min(1),
    id: z.string().min(1),
    payload: z.unknown().optional()
  }).optional()
})
```

Rule types must include:

```ts
export const RuleTypeSchema = z.enum([
  'not-start-until',
  'not-finish-after',
  'resource-unavailable',
  'lock-operation',
  'lock-requirement',
  'avoid-resource',
  'prefer-resource',
  'priority-boost',
  'must-run-before',
  'must-run-after',
  'supply-not-available-until'
])
```

Use `superRefine` on `RuleSchema` to require fields by type:

- `not-start-until`: `until`
- `not-finish-after`: `after`
- `resource-unavailable`: target kind `resource`, `from`, `to`
- `priority-boost`: `priority`
- ordering rules: `before` or `after` target ids as needed

Create `src/domain/types.ts` exporting `z.infer` types.

**Step 4: Implement examples and registry**

Create `src/domain/examples.ts` with valid example objects for every public schema.

Create `src/domain/schema-registry.ts`:

```ts
export const SCHEMA_REGISTRY = {
  'model.requirement': { schema: RequirementBatchSchema, example: RequirementBatchExample },
  'model.item': { schema: ItemBatchSchema, example: ItemBatchExample },
  'model.routing': { schema: RoutingBatchSchema, example: RoutingBatchExample },
  'model.resource': { schema: ResourceBatchSchema, example: ResourceBatchExample },
  'model.supply': { schema: SupplyBatchSchema, example: SupplyBatchExample },
  rule: { schema: RuleBatchSchema, example: RuleBatchExample },
  case: { schema: CaseSchema, example: CaseExample },
  plan: { schema: PlanSchema, example: PlanExample },
  scenario: { schema: ScenarioSchema, example: ScenarioExample }
} as const
```

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 6: Commit**

Run:

```bash
git add src/domain tests/domain
git commit -m "feat: define octoplanner domain schemas"
```

## Task 4: Add Workspace SQLite Migrations and Database Adapter

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/store/db.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/store/migrations.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/store/workspace.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/store/workspace.test.ts`

**Step 1: Write failing workspace tests**

Create `tests/store/workspace.test.ts`:

```ts
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
    expect(() => initWorkspace(dir)).toThrow(/WORKSPACE_EXISTS/)
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/store/workspace.test.ts
```

Expected: fails because store files do not exist.

**Step 3: Implement SQLite migrations**

Use Bun SQLite:

```ts
import { Database } from 'bun:sqlite'
```

Create tables:

- `meta(key text primary key, value text not null)`
- `model_batches(id text primary key, kind text not null, created_at text not null, payload_json text not null)`
- `model_records(id text primary key, batch_id text not null, kind text not null, domain_id text not null, payload_json text not null)`
- `rules(id text primary key, enabled integer not null, expires_at text, created_at text not null, payload_json text not null)`
- `cases(id text primary key, name text not null unique, created_at text not null, payload_json text not null)`
- `plans(id text primary key, name text not null unique, state text not null, created_at text not null, archived_at text, payload_json text not null)`
- `scenarios(id text primary key, name text not null unique, state text not null, created_at text not null, payload_json text not null)`
- `audit_logs(id text primary key, command text not null, created_at text not null, payload_json text not null)`

Set `schemaVersion=1` in `meta`.

**Step 4: Implement workspace functions**

Create:

- `workspaceDir(cwd)`
- `workspaceDbPath(cwd)`
- `initWorkspace(cwd)`
- `openWorkspace(cwd)`
- `workspaceStatus(db)`
- `doctorWorkspace(db)`

Fastfail when workspace is missing outside `init`.

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 6: Commit**

Run:

```bash
git add src/store tests/store
git commit -m "feat: add sqlite workspace"
```

## Task 5: Add Repository Layer and Audit Logging

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/store/repositories.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/core/ids.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/store/repositories.test.ts`

**Step 1: Write failing repository tests**

Create `tests/store/repositories.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { initWorkspace, openWorkspace } from '../../src/store/workspace'
import { createRepositories } from '../../src/store/repositories'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('repositories', () => {
  it('stores and lists model batches with audit logs', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    initWorkspace(dir)
    const repos = createRepositories(openWorkspace(dir))

    repos.models.saveBatch('requirement', 'batch_1', { id: 'batch_1', requirements: [] })
    repos.audit.write('model requirement load', { batchId: 'batch_1' })

    expect(repos.models.listBatches('requirement')).toHaveLength(1)
    expect(repos.audit.list({ limit: 10 })).toHaveLength(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/store/repositories.test.ts
```

Expected: fails because repositories are missing.

**Step 3: Implement repository layer**

Implement repository groups:

- `models.saveBatch(kind, id, payload)`
- `models.listBatches(kind?)`
- `models.getBatch(id)`
- `models.listRecords(kind?)`
- `rules.save(rule)`
- `rules.list({ includeDisabled })`
- `rules.get(id)`
- `rules.updateState(id, patch)`
- `rules.remove(id)`
- `cases.save(casePayload)`
- `cases.list()`
- `cases.getByNameOrId(value)`
- `plans.save(planPayload)`
- `plans.list({ includeArchived })`
- `plans.getByNameOrId(value)`
- `plans.archive(value)`
- `scenarios.save(...)`
- `scenarios.list()`
- `scenarios.getByNameOrId(value)`
- `audit.write(command, payload)`
- `audit.list({ limit })`
- `audit.get(id)`

Use transaction wrappers for multi-table writes.

**Step 4: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add src/store src/core/ids.ts tests/store/repositories.test.ts
git commit -m "feat: add repositories and audit logs"
```

## Task 6: Implement Workspace and Schema Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/workspace.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/schema.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/workspace-schema.test.ts`

**Step 1: Write failing CLI command tests**

Create `tests/commands/workspace-schema.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('workspace and schema commands', () => {
  it('initializes and reports workspace status', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    const init = await runCli(['workspace', 'init'], { cwd: dir, env: {} })
    expect(init.exitCode).toBe(0)
    const status = await runCli(['workspace', 'status'], { cwd: dir, env: {} })
    expect(JSON.parse(status.stdout).data.schemaVersion).toBe(1)
  })

  it('shows schema examples', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    const result = await runCli(['schema', 'example', '--name', 'model.requirement'], { cwd: dir, env: {} })
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(result.stdout).data.id).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/workspace-schema.test.ts
```

Expected: fails because commands are not wired.

**Step 3: Implement commands**

Implement:

- `workspace init`
- `workspace status`
- `workspace config` with no mutation at first except displaying config
- `workspace doctor`
- `schema list`
- `schema show`
- `schema check --name <schema> --file <file>`
- `schema example --name <schema>`

`schema check` must parse JSON from file, Zod-validate it, and fastfail with `VALIDATION_FAILED` on issues.

**Step 4: Wire dispatcher**

Update `src/cli.ts`:

- Parse `positionals[0]` and `positionals[1]`.
- Dispatch to command handlers.
- Unknown command/subcommand fastfails.

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 6: Commit**

Run:

```bash
git add src/commands src/cli.ts tests/commands/workspace-schema.test.ts
git commit -m "feat: add workspace and schema commands"
```

## Task 7: Implement Model Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/model.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/model-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/model.test.ts`
- Test fixtures: `/Users/wanglei/Projects/syngy/octoplanner/tests/fixtures/model/*.json`

**Step 1: Write failing tests**

Create fixtures for valid requirement, item, routing, resource, supply batches.

Create `tests/commands/model.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined
const fixture = (name: string) => path.resolve('tests/fixtures/model', name)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('model commands', () => {
  it('loads, lists, shows, validates, and summarizes requirements', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await runCli(['workspace', 'init'], { cwd: dir, env: {} })

    const load = await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd: dir, env: {} })
    expect(load.exitCode).toBe(0)

    const list = await runCli(['model', 'requirement', 'list'], { cwd: dir, env: {} })
    expect(JSON.parse(list.stdout).data.batches).toHaveLength(1)

    const summary = await runCli(['model', 'requirement', 'summary'], { cwd: dir, env: {} })
    expect(JSON.parse(summary.stdout).data.totalQuantity).toBeGreaterThan(0)
  })

  it('reports routing coverage gaps', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await runCli(['workspace', 'init'], { cwd: dir, env: {} })
    await runCli(['model', 'requirement', 'load', '--file', fixture('requirements.json')], { cwd: dir, env: {} })
    await runCli(['model', 'routing', 'load', '--file', fixture('routings.json')], { cwd: dir, env: {} })

    const coverage = await runCli(['model', 'routing', 'coverage'], { cwd: dir, env: {} })
    expect(JSON.parse(coverage.stdout).data).toHaveProperty('missing')
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/model.test.ts
```

Expected: fails because model commands are missing.

**Step 3: Implement model service**

Implement:

- batch loading with exact schema selection
- per-record expansion into `model_records`
- `list`
- `show --id <domain-id-or-batch-id>`
- `validate --file <json>` for dry validation
- summaries:
  - requirement total quantity, due date range, priority range
  - item count by optional groups
  - routing operation count and missing references
  - resource count
  - supply availability and shortages
- `routing coverage`
- `resource timeline --plan <name>` reading plan operations
- `supply availability --target <item|supply>`

**Step 4: Wire model dispatcher**

`model <kind> <action>` must support only:

- requirement: `load/list/show/validate/summary`
- item: `load/list/show/validate`
- routing: `load/list/show/validate/coverage`
- resource: `load/list/show/validate/timeline`
- supply: `load/list/show/validate/availability`

Fastfail on unsupported action.

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 6: Commit**

Run:

```bash
git add src/commands/model.ts src/domain/model-service.ts tests/commands/model.test.ts tests/fixtures/model
git commit -m "feat: add model commands"
```

## Task 8: Implement Rule Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/rule.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/rule-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/rule.test.ts`

**Step 1: Write failing tests**

Create `tests/commands/rule.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'

let dir: string | undefined

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

describe('rule commands', () => {
  it('adds, lists, disables, enables, expires, and removes a rule', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-'))
    await runCli(['workspace', 'init'], { cwd: dir, env: {} })

    const add = await runCli([
      'rule', 'add',
      '--type', 'not-start-until',
      '--target', 'requirement:REQ-1',
      '--until', '2026-03-12T00:00:00.000Z',
      '--reason', 'manual hold'
    ], { cwd: dir, env: {} })
    expect(add.exitCode).toBe(0)
    const id = JSON.parse(add.stdout).data.id

    expect(JSON.parse((await runCli(['rule', 'list'], { cwd: dir, env: {} })).stdout).data.rules).toHaveLength(1)
    expect((await runCli(['rule', 'disable', '--id', id], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['rule', 'enable', '--id', id], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['rule', 'expire', '--id', id, '--at', '2026-03-13T00:00:00.000Z'], { cwd: dir, env: {} })).exitCode).toBe(0)
    expect((await runCli(['rule', 'remove', '--id', id], { cwd: dir, env: {} })).exitCode).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/rule.test.ts
```

Expected: fails because rule commands are missing.

**Step 3: Implement rule service**

Implement:

- `add` from flags with strict per-type validation
- `load --file <rules.json>`
- `list`
- `show --id <id>`
- `remove --id <id>`
- `enable --id <id>`
- `disable --id <id>`
- `expire --id <id> --at <datetime>`
- `validate --file <rules.json>` and `validate --id <id>`

All rule target strings use exact `kind:id` format. Invalid format fastfails.

**Step 4: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add src/commands/rule.ts src/domain/rule-service.ts tests/commands/rule.test.ts
git commit -m "feat: add rule commands"
```

## Task 9: Implement Case Commands and Validation

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/case.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/case-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/case.test.ts`

**Step 1: Write failing tests**

Create `tests/commands/case.test.ts` that:

- initializes workspace
- loads requirement/item/routing/resource fixtures
- creates a case
- validates case
- checks `notModeled` contains supply/calendar/changeover when omitted
- exports case JSON

Expected assertion:

```ts
expect(JSON.parse(validate.stdout).notModeled).toEqual(expect.arrayContaining([
  'supply_availability',
  'shift_calendar',
  'changeover_cost'
]))
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/case.test.ts
```

Expected: fails because case commands are missing.

**Step 3: Implement case service**

`case create --name <name>` should select latest loaded model batches by default.

Also support explicit:

- `--requirements <batch-id>`
- `--items <batch-id>`
- `--routings <batch-id>`
- `--resources <batch-id>`
- `--supplies <batch-id>`
- `--rules active`
- `--baseline-plan <plan>`

Validation checks:

- every requirement item exists
- every requirement item has routing
- every routing resource reference exists if explicit
- supply references are valid when present
- active rules target known model or plan entities where possible
- missing optional domains produce `notModeled`, not errors

**Step 4: Implement commands**

- `case create`
- `case list`
- `case show`
- `case validate`
- `case summary`
- `case export`

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 6: Commit**

Run:

```bash
git add src/commands/case.ts src/domain/case-service.ts tests/commands/case.test.ts
git commit -m "feat: add case commands"
```

## Task 10: Implement Planner Engine

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/expand.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/constraints.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/schedule.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/metrics.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/planner/timeline.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/planner/planner.test.ts`

**Step 1: Write failing planner tests**

Create `tests/planner/planner.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createPlanFromCase } from '../../src/planner/schedule'

describe('planner engine', () => {
  it('creates deterministic operation schedule with precedence and resource no-overlap', () => {
    const plan = createPlanFromCase({
      id: 'case_1',
      name: 'case',
      model: {
        requirements: [{ id: 'REQ-1', itemId: 'ITEM-1', quantity: 1, dueAt: '2026-03-12T00:00:00.000Z' }],
        items: [{ id: 'ITEM-1', name: 'Item 1' }],
        routings: [{
          itemId: 'ITEM-1',
          operations: [
            { id: 'op10', sequence: 10, name: 'A', durationMinutes: 60, eligibleResourceIds: ['R1'] },
            { id: 'op20', sequence: 20, name: 'B', durationMinutes: 60, eligibleResourceIds: ['R1'] }
          ]
        }],
        resources: [{ id: 'R1', name: 'Machine 1' }],
        supplies: []
      },
      rules: [],
      createdAt: '2026-03-01T00:00:00.000Z'
    }, { now: '2026-03-01T08:00:00.000Z', mode: 'create' })

    expect(plan.scheduledOperations).toHaveLength(2)
    expect(plan.scheduledOperations[1]!.startAt >= plan.scheduledOperations[0]!.endAt).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/planner/planner.test.ts
```

Expected: fails because planner engine is missing.

**Step 3: Implement expansion**

Expand requirements into operations:

- operation id: `${requirement.id}:${routingOperation.id}`
- resource candidates from routing operation
- duration = routing operation duration
- precedence from sequence and explicit links

If duration is missing, mark operation unplanned with reason `DURATION_MISSING`.

**Step 4: Implement constraints**

Hard constraints:

- resource no-overlap
- operation precedence
- `not-start-until`
- `not-finish-after`
- `resource-unavailable`
- `lock-operation`
- `lock-requirement`
- `supply-not-available-until`
- avoid/prefer resource where possible

Unsupported optional constraints produce warnings or `notModeled`, not hidden behavior.

**Step 5: Implement deterministic scheduler**

Algorithm:

1. Sort requirements by priority descending, dueAt ascending, id ascending.
2. Expand operations.
3. Keep resource availability cursors.
4. Schedule operations in precedence order.
5. Choose earliest feasible resource.
6. Apply rules.
7. Record unplanned operations with reasons.
8. Compute metrics.

Repair mode should preserve locked/baseline operations and reschedule affected unlocked operations.

Optimize mode can reorder unlocked requirements by score profile.

**Step 6: Implement metrics and timeline**

Metrics:

- total requirements
- scheduled operations
- unplanned operations
- late requirements
- total lateness minutes
- resource utilization by scheduled window
- moved operations when baseline exists
- applied rule count

Timeline items:

```ts
{
  operationId,
  requirementId,
  itemId,
  resourceId,
  startAt,
  endAt,
  locked,
  labels
}
```

**Step 7: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 8: Commit**

Run:

```bash
git add src/planner tests/planner/planner.test.ts
git commit -m "feat: add deterministic planner engine"
```

## Task 11: Implement Plan Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/plan.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/plan-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/plan.test.ts`

**Step 1: Write failing tests**

Create `tests/commands/plan.test.ts` covering:

- `plan create --case <name> --name <name>`
- `plan load --file <plan.json> --name manual-plan`
- `plan list`
- `plan show`
- `plan summary`
- `plan timeline`
- `plan metrics`
- `plan export`
- `plan compare --left <plan> --right <plan>`
- `plan archive`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/plan.test.ts
```

Expected: fails because plan commands are missing.

**Step 3: Implement plan service**

Rules:

- `plan create` requires valid case.
- `plan load` requires valid `PlanSchema`.
- duplicate plan names fastfail.
- archived plans are excluded by default from `list`.
- `compare` reports added/removed/moved operations and metrics deltas.

**Step 4: Implement commands and wire dispatcher**

Implement all target plan subcommands.

**Step 5: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 6: Commit**

Run:

```bash
git add src/commands/plan.ts src/domain/plan-service.ts tests/commands/plan.test.ts
git commit -m "feat: add plan commands"
```

## Task 12: Implement Impact Analysis

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/impact.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/impact-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/impact.test.ts`

**Step 1: Write failing tests**

Create tests that:

- load a plan
- add a `not-start-until` rule
- run `impact analyze --plan <plan> --rule <id>`
- assert affected requirements/operations are listed
- run `impact trace --plan <plan> --target requirement:REQ-1`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/impact.test.ts
```

Expected: fails because impact commands are missing.

**Step 3: Implement impact service**

Impact graph:

- nodes: requirements, operations, resources, rules
- edges: requirement -> operation, operation -> operation precedence, operation -> resource, rule -> target

`analyze` should output:

- affectedRequirements
- affectedOperations
- affectedResources
- blockedChains
- candidatePullForwardOperations
- disruptionEstimate
- appliedRule

`trace` should output why a target is affected.

**Step 4: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add src/commands/impact.ts src/domain/impact-service.ts tests/commands/impact.test.ts
git commit -m "feat: add impact analysis"
```

## Task 13: Implement Scenario Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/scenario.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/scenario-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/scenario.test.ts`

**Step 1: Write failing tests**

Create `tests/commands/scenario.test.ts` covering:

- `scenario create --from-plan <plan> --name <name>`
- `scenario show`
- `scenario simulate --mode repair`
- `scenario simulate --mode optimize`
- `scenario compare`
- `scenario commit --as-plan <name>`
- `scenario discard`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/scenario.test.ts
```

Expected: fails because scenario commands are missing.

**Step 3: Implement scenario service**

Rules:

- scenarios start from a plan
- scenarios can include active rules at creation time
- `simulate repair` uses baseline and minimizes moved operations
- `simulate optimize` can reorder unlocked operations
- candidates are stored inside scenario payload
- `commit` writes a new formal plan
- `discard` marks scenario state discarded

**Step 4: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add src/commands/scenario.ts src/domain/scenario-service.ts tests/commands/scenario.test.ts
git commit -m "feat: add scenario simulation"
```

## Task 14: Implement Explain Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/explain.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/domain/explain-service.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/explain.test.ts`

**Step 1: Write failing tests**

Create tests for:

- `explain plan --plan <plan>`
- `explain requirement --plan <plan> --id <id>`
- `explain order` as equivalent user-facing target, not a compatibility fallback; document as explicit command
- `explain operation --plan <plan> --id <id>`
- `explain resource --plan <plan> --id <id>`
- `explain rule --id <id>`
- `explain scenario --scenario <name>`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/explain.test.ts
```

Expected: fails because explain commands are missing.

**Step 3: Implement explain service**

Explanations should be structured JSON, not prose only:

```ts
{
  subject: { kind: 'requirement', id: 'REQ-1' },
  summary: 'Requirement REQ-1 is scheduled on time.',
  factors: [
    { kind: 'rule', id: 'rule_1', effect: 'not-start-until applied' },
    { kind: 'resource', id: 'R1', effect: 'earliest feasible resource' }
  ],
  warnings: [],
  notModeled: []
}
```

**Step 4: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add src/commands/explain.ts src/domain/explain-service.ts tests/commands/explain.test.ts
git commit -m "feat: add explanation commands"
```

## Task 15: Implement Audit Commands

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/src/commands/audit.ts`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/src/cli.ts`
- Test: `/Users/wanglei/Projects/syngy/octoplanner/tests/commands/audit.test.ts`

**Step 1: Write failing tests**

Create tests for:

- mutating command produces `auditId`
- `audit log --limit 20`
- `audit show --id <auditId>`

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run tests/commands/audit.test.ts
```

Expected: fails because audit commands are missing or auditId is incomplete.

**Step 3: Implement audit command**

Audit payload should include:

- command
- args summary
- createdAt
- result summary
- referenced ids

Do not store secrets. Since the CLI does not connect to external systems, raw external credentials should never enter audit.

**Step 4: Run tests**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add src/commands/audit.ts src/cli.ts tests/commands/audit.test.ts
git commit -m "feat: add audit commands"
```

## Task 16: Add End-to-End CLI Workflow Tests

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/tests/e2e/full-workflow.test.ts`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/tests/fixtures/e2e/README.md`

**Step 1: Write failing E2E test**

Create one full workflow test:

1. `workspace init`
2. load all model batches
3. add `not-start-until` rule
4. create case
5. validate case
6. create plan
7. analyze impact
8. create scenario
9. simulate repair
10. compare scenario
11. commit scenario
12. export plan
13. explain requirement
14. audit log

Assert every command returns `ok: true`, and every mutating command includes `auditId`.

**Step 2: Run test to verify it fails where coverage is incomplete**

Run:

```bash
npm test -- --run tests/e2e/full-workflow.test.ts
```

Expected: either fail on missing behavior, or pass if previous tasks are complete. Any failure must be fixed here.

**Step 3: Fix integration gaps**

Patch only the modules responsible for the failing behavior. Do not add alternate command paths.

**Step 4: Run full checks**

Run:

```bash
npm run check
```

Expected: pass.

**Step 5: Commit**

Run:

```bash
git add tests/e2e tests/fixtures src
git commit -m "test: add full octoplanner workflow"
```

## Task 17: Add README and CLI Reference

**Files:**
- Create: `/Users/wanglei/Projects/syngy/octoplanner/README.md`
- Create: `/Users/wanglei/Projects/syngy/octoplanner/docs/cli-reference.md`
- Modify: `/Users/wanglei/Projects/syngy/octoplanner/docs/design/product-design.md` if implementation reveals necessary wording corrections

**Step 1: Write documentation**

`README.md` must include:

- product positioning
- install with `npm install`
- run with `npm run octoplanner -- ...`
- workspace quickstart
- JSON output contract
- fastfail behavior
- no ERP/Excel parsing boundary

`docs/cli-reference.md` must include every implemented command and required flags.

**Step 2: Verify command examples**

Run the README quickstart commands in a temp directory:

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
npm --prefix /Users/wanglei/Projects/syngy/octoplanner run octoplanner -- workspace init
```

Expected: JSON success envelope.

**Step 3: Run full checks**

Run:

```bash
npm run check
```

Expected: pass.

**Step 4: Commit**

Run:

```bash
git add README.md docs/cli-reference.md docs/design/product-design.md
git commit -m "docs: add octoplanner cli reference"
```

## Task 18: Final Verification

**Files:**
- Verify all project files.

**Step 1: Run full test/typecheck suite**

Run:

```bash
npm run check
```

Expected: typecheck passes and all Vitest tests pass.

**Step 2: Verify no pnpm artifacts**

Run:

```bash
find . -name 'pnpm-lock.yaml' -o -name '.pnpm'
```

Expected: no output.

**Step 3: Verify CLI can run with Bun through npm**

Run:

```bash
npm run octoplanner -- --version
```

Expected: JSON success envelope with `data.name = "octoplanner"`.

**Step 4: Verify workspace fastfail**

Run:

```bash
tmpdir=$(mktemp -d)
cd "$tmpdir"
npm --prefix /Users/wanglei/Projects/syngy/octoplanner run octoplanner -- model requirement list
```

Expected: exit code `2`, JSON failure envelope with `WORKSPACE_NOT_FOUND`.

**Step 5: Verify git status**

Run:

```bash
git status --short
```

Expected: clean working tree.

**Step 6: Final commit if needed**

If final verification required small fixes:

```bash
git add <changed-files>
git commit -m "fix: complete octoplanner verification"
```

