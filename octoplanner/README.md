# Octoplanner

`octoplanner` is a Bun-first TypeScript CLI for AI Agent-driven production scheduling. It owns a strict scheduling domain model, SQLite workspace state, rule-based planning control, deterministic scheduling, impact analysis, scenario simulation, explanations, and audit logs.

It does not parse arbitrary ERP, SAP, MES, or Excel formats. External systems and Agents must convert data into `octoplanner` JSON schemas before loading it.

## Setup

```bash
npm install
```

## npm Distribution

The published package is assembled at pack or publish time. It contains compiled JavaScript, TypeScript declarations, curated docs, examples, and JSON Schema assets.

```bash
npm run package:prepare
npm pack ./package --dry-run
npm publish ./package
```

The generated package is Bun-first. The CLI entrypoint is `dist/cli.js` with a Bun shebang, and the published package declares `engines.bun`.

## Run

```bash
npm run octoplanner -- --version
npm run octoplanner -- workspace init
```

All commands default to JSON envelopes:

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "notModeled": []
}
```

Failures fastfail:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "..."
  }
}
```

## Quickstart

```bash
npm run octoplanner -- workspace init
npm run octoplanner -- schema example --name model.requirement
npm run octoplanner -- model requirement load --file requirements.json
npm run octoplanner -- model item load --file items.json
npm run octoplanner -- model routing load --file routings.json
npm run octoplanner -- model resource load --file resources.json
npm run octoplanner -- rule add --type not-start-until --target requirement:REQ-1 --until 2026-03-12T00:00:00.000Z
npm run octoplanner -- case create --name march-case
npm run octoplanner -- plan create --case march-case --name march-plan
npm run build:report-web
npm run octoplanner -- report output --format html --lang zh-CN --plan march-plan plan-overview --out report.html
npm run octoplanner -- report serve --lang zh-CN --port 5177
```

For a larger multi-order timeline demo, see [examples/report-complex/README.md](/Users/wanglei/Projects/syngy/octoplanner/examples/report-complex/README.md).

For baseline revision and urgent insertion, see [examples/revision-urgent-insert/README.md](/Users/wanglei/Projects/syngy/octoplanner/examples/revision-urgent-insert/README.md).

## Baseline Revision Flow

Baseline empty means full scheduling:

```bash
npm run octoplanner -- plan create --case daily-case --name daily-plan
```

Baseline present means repair scheduling:

```bash
npm run octoplanner -- plan load --file baseline-plan.json --name current
npm run octoplanner -- plan revise --from-plan current --name after-urgent --revision revision.json
npm run octoplanner -- plan diff --from current --to after-urgent --out diff.json
npm run octoplanner -- report output --format html --lang zh-CN --diff diff.json plan-diff --out diff.html
```

Excel parsing and workbook writing remain adapter responsibilities. The agent should convert workbook rows into a baseline plan with `externalRef`, call `octoplanner`, then apply `plan diff` back to the workbook.

## Principles

- Use `npm` only for dependency management.
- Default runtime is Bun.
- All structured inputs are validated with Zod.
- Invalid state fastfails with a JSON error.
- No fallback command paths.
- No implicit workspace creation outside `workspace init`.

## Reports

`octoplanner report` is read-only. It explains existing plans, scenarios, rules, exceptions, and timelines. It does not edit rules, trigger simulation, commit scenarios, or reschedule operations.

Supported languages:

- `zh-CN` default
- `en-US`

Build the report web app before serving from source:

```bash
npm run build:report-web
```

Examples:

```bash
npm run octoplanner -- report output --format html --lang zh-CN --plan march-plan plan-overview --out report.html
npm run octoplanner -- report output --format html --lang en-US --plan march-plan exception-review --out exceptions.html
npm run octoplanner -- report output --format html --lang zh-CN --diff diff.json plan-diff --out diff.html
npm run octoplanner -- report serve --lang zh-CN --port 5177
```
