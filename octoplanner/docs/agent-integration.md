# Agent Integration

`octoplanner` is a Bun-first CLI for AI agents that need deterministic production scheduling operations over a local SQLite workspace.

The package does not connect to ERP, MES, spreadsheets, or custom customer systems directly. Adapters must convert external data into the `octoplanner` model JSON contracts before calling the CLI.

## Runtime

The CLI requires Bun because the workspace uses `bun:sqlite`.

```bash
npm install @syngy/octoplanner
bunx octoplanner --version
```

When working from this repository, use:

```bash
npm run octoplanner -- --version
```

## Result Envelope

Every command returns a single JSON envelope.

Success:

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "notModeled": []
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "..."
  }
}
```

Agents should treat `ok: false` as a hard stop. Do not continue by guessing missing state.

## Workspace Lifecycle

Create the workspace explicitly:

```bash
octoplanner workspace init
```

Load model data:

```bash
octoplanner model requirement load --file requirements.json
octoplanner model item load --file items.json
octoplanner model routing load --file routings.json
octoplanner model resource load --file resources.json
octoplanner model supply load --file supplies.json
```

Load rules when the user or upstream system has coarse planning directives:

```bash
octoplanner rule load --file rules.json
```

Create a planning case and generate a plan:

```bash
octoplanner case create --name daily-plan
octoplanner case validate --case daily-plan
octoplanner plan create --case daily-plan --name daily-plan-v1
```

If the user is modifying an existing schedule, load the current schedule as a baseline and revise it:

```bash
octoplanner plan load --file baseline-plan.json --name current
octoplanner plan revise --from-plan current --name current-v2 --revision revision.json
octoplanner plan diff --from current --to current-v2 --out diff.json
```

Inspect the plan:

```bash
octoplanner plan summary --plan daily-plan-v1
octoplanner plan timeline --plan daily-plan-v1
octoplanner explain plan --plan daily-plan-v1
```

## Recommended Agent Loop

1. Validate every input file with `schema check`.
2. Load model files into a fresh or selected workspace.
3. Load user-provided rules instead of inferring hidden business intent.
4. Create and validate a case.
5. Create a plan.
6. Read `warnings` and `notModeled` before presenting results.
7. Use `plan revise` when a shortage, insertion, outage, or manual directive changes an existing schedule.
8. Use `plan diff` to identify the exact moved, added, removed, and unchanged operations.
9. Apply `externalRef` from diff rows to update Excel, ERP, MES, or other external artifacts outside `octoplanner`.
10. Export the accepted plan for the downstream executor.

## Spreadsheet Adapter Boundary

For spreadsheet workflows, the agent or adapter owns workbook parsing and writing:

```text
xlsx -> adapter -> baseline plan + source mapping
user utterance -> agent -> revision/rules
baseline + revision -> octoplanner -> new plan + diff
diff + source mapping -> adapter -> new xlsx
```

`octoplanner` should never be treated as a generic Excel parser.

## Single Success Path

Agents should avoid fallback flows such as creating a workspace implicitly or repairing malformed input silently. The correct behavior is to fastfail, report the exact error envelope, and ask the caller or adapter to provide valid data.

## Coarse Human Directives

When a human already knows that a requirement cannot start before a date, use a rule such as `not-start-until`. The agent does not need to model every upstream reason. This keeps integration cost low while preserving a clear planning contract.
