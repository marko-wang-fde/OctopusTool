# Octoplanner Report

`octoplanner report` converts existing scheduling state into read-only reports.

It supports two modes:

- `report output`: export a static HTML report.
- `report serve`: start a local interactive report website.

The web app is report-only. It does not add rules, edit model data, simulate scenarios, commit scenarios, or reschedule operations.

## Language

Use `--lang` to select UI/report language:

```bash
npm run octoplanner -- report output --format html --lang zh-CN --plan march-plan plan-overview --out report.html
npm run octoplanner -- report output --format html --lang en-US --plan march-plan exception-review --out exceptions.html
npm run octoplanner -- report serve --lang zh-CN --port 5177
```

Supported values:

- `zh-CN`
- `en-US`

Default: `zh-CN`.

The language option translates UI labels, table headers, report titles, empty states, status labels, and suggested next actions. It does not translate business payload values such as item names, customer names, resource names, external references, or rule reasons.

## Static HTML

Supported report types:

- `plan-overview`
- `resource-timeline`
- `requirement-trace`
- `exception-review`
- `rule-impact`
- `plan-diff`
- `scenario-compare`

Examples:

```bash
npm run octoplanner -- report output --format html --lang zh-CN --plan march-plan plan-overview --out report.html
npm run octoplanner -- report output --format html --lang en-US --scenario delay scenario-compare --out scenario.html
npm run octoplanner -- report output --format html --lang zh-CN --diff diff.json plan-diff --out diff.html
```

If `--out` is omitted, the HTML is returned inside the JSON success envelope.

## Web App

When running from source, build the report web app first:

```bash
npm run build:report-web
```

Then start the server:

```bash
npm run octoplanner -- report serve --lang zh-CN --host 127.0.0.1 --port 5177
```

The server exposes read-only APIs under `/api/*` and serves the React app for browser routes.

Read-only API routes:

- `GET /api/config`
- `GET /api/health`
- `GET /api/plans`
- `GET /api/plans/:planId/overview`
- `GET /api/plans/:planId/timeline`
- `GET /api/plans/:planId/requirements`
- `GET /api/plans/:planId/exceptions`
- `GET /api/plans/:planId/rules`
- `GET /api/diff?file=/absolute/path/to/diff.json`
- `GET /api/scenarios`
- `GET /api/scenarios/:scenarioId/compare`

Mutation methods return `405 METHOD_NOT_ALLOWED`.

## Local Probe Without Browser Login

If browser login, MCP browser access, or Chrome automation fails, use the Python probe to verify the local report server directly:

```bash
python3 scripts/probe-report.py --url http://127.0.0.1:5177
python3 scripts/probe-report.py --url http://127.0.0.1:5177 --plan report-complex-plan
```

The probe uses Python standard library HTTP requests. It checks:

- `/api/config`
- `/api/health`
- `/api/plans`
- `/api/plans/:plan/overview`
- `/api/plans/:plan/timeline`
- `/api/plans/:plan/exceptions`
- `/`
- `/plans/:plan/timeline`
- `POST /api/plans` returns `405`

## Complex Demo

Use `examples/report-complex` to see multiple orders sharing the same Gantt-style resource timeline:

```bash
npm run octoplanner -- workspace init
npm run octoplanner -- model requirement load --file examples/report-complex/requirements.json
npm run octoplanner -- model item load --file examples/report-complex/items.json
npm run octoplanner -- model routing load --file examples/report-complex/routings.json
npm run octoplanner -- model resource load --file examples/report-complex/resources.json
npm run octoplanner -- model supply load --file examples/report-complex/supplies.json
npm run octoplanner -- case create --name report-complex
npm run octoplanner -- plan create --case report-complex --name report-complex-plan
npm run build:report-web
npm run octoplanner -- report serve --lang zh-CN --port 5177
```

Open:

```text
http://127.0.0.1:5177/plans/report-complex-plan/timeline
```

The resource timeline has an order filter above the Gantt area. Select one order to hide unrelated operation blocks.
