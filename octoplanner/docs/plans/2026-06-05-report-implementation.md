# Report Subsystem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a read-only `report` CLI subsystem with localized HTML export and a localized React/Vite/Tailwind/shadcn web report app served by Bun.

**Architecture:** The report layer builds display-ready view models from existing SQLite repositories and domain services. `report output` renders static HTML from the same view models, while `report serve` exposes read-only API routes and serves the Vite-built React app. The web app is strictly report-only, supports `--lang`, and never mutates workspace state.

**Tech Stack:** TypeScript, Bun, SQLite, Zod, React, Vite, Tailwind CSS, shadcn/ui source components, lucide-react, Vitest, npm.

---

### Task 1: Add Report Command Routing and Locale Tests

**Files:**

- Modify: `tests/cli.test.ts`
- Create: `tests/commands/report.test.ts`
- Modify: `src/cli.ts`
- Create: `src/commands/report.ts`
- Create: `src/report/locale.ts`

**Step 1: Write failing tests**

Add tests for:

- `report output --format html --lang zh-CN --plan <plan> plan-overview --out <file>`
- `report output --format html --lang en-US --plan <plan> plan-overview --out <file>`
- `report serve --lang zh-CN --port 0`
- missing `--lang` defaults to `zh-CN`
- unsupported `--lang` fastfails with `UNSUPPORTED_LANGUAGE`
- unknown report action fastfails.

**Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/commands/report.test.ts
```

Expected: FAIL because `report` command is not registered.

**Step 3: Add command stub and locale parser**

Create:

- `parseReportLocale(value?: unknown): 'zh-CN' | 'en-US'`
- `SUPPORTED_REPORT_LOCALES`
- command dispatch for `output` and `serve`

Register `report: reportCommand` in `src/cli.ts`.

**Step 4: Run focused tests**

Run:

```bash
npm test -- tests/commands/report.test.ts
```

Expected: route-level and locale tests pass or fail only on missing report service behavior.

**Step 5: Commit**

```bash
git add src/cli.ts src/commands/report.ts src/report/locale.ts tests/cli.test.ts tests/commands/report.test.ts
git commit -m "feat: add report command routing"
```

### Task 2: Add Report Messages

**Files:**

- Create: `src/report/messages.ts`
- Create: `tests/report/messages.test.ts`

**Step 1: Write failing tests**

Cover:

- `zh-CN` returns Chinese labels for navigation, table headers, report titles, status labels, empty states.
- `en-US` returns English labels for the same keys.
- all supported locales have the same message keys.

**Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/report/messages.test.ts
```

Expected: FAIL because messages module does not exist.

**Step 3: Implement messages**

Implement:

- `getReportMessages(locale)`
- typed `ReportMessages`
- shared keys for static HTML and React API config.

Do not translate model payload values.

**Step 4: Run focused tests**

Run:

```bash
npm test -- tests/report/messages.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/report/messages.ts tests/report/messages.test.ts
git commit -m "feat: add report localization messages"
```

### Task 3: Add Report Domain Types and View Models

**Files:**

- Create: `src/domain/report-types.ts`
- Create: `src/domain/report-service.ts`
- Create: `tests/domain/report-service.test.ts`

**Step 1: Write failing tests**

Cover:

- View models include `locale`.
- Plan overview includes metrics, unplanned operations, warnings, notModeled, applied rules.
- Resource timeline groups operations by resource and sorts by start time.
- Requirement trace groups operations by requirement and preserves operation order.
- Exception review emits records for unplanned operations, warnings, and notModeled.
- Exception suggested next-action text changes by locale.
- Scenario compare wraps existing plan comparison output.

**Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/domain/report-service.test.ts
```

Expected: FAIL because report service does not exist.

**Step 3: Implement view-model builders**

Create pure functions:

- `buildPlanOverviewReport(input)`
- `buildResourceTimelineReport(input)`
- `buildRequirementTraceReport(input)`
- `buildExceptionReviewReport(input)`
- `buildRuleImpactReport(input)`
- `buildScenarioCompareReport(input)`

Use existing `timelineForPlan`, `comparePlans`, and explain/impact helpers where applicable.

**Step 4: Run focused tests**

Run:

```bash
npm test -- tests/domain/report-service.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/domain/report-types.ts src/domain/report-service.ts tests/domain/report-service.test.ts
git commit -m "feat: add report view models"
```

### Task 4: Implement Static HTML Report Output

**Files:**

- Create: `src/report/html.ts`
- Create: `tests/report/html.test.ts`
- Modify: `src/commands/report.ts`
- Modify: `docs/cli-reference.md`

**Step 1: Write failing tests**

Cover:

- HTML output escapes unsafe text.
- Output includes report title, generated time, source plan/scenario metadata.
- `zh-CN` HTML includes Chinese UI labels.
- `en-US` HTML includes English UI labels.
- `--out` writes a file.
- Missing `--plan` for plan report fastfails.
- Missing `--scenario` for `scenario-compare` fastfails.
- Unsupported format fastfails.

**Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/report/html.test.ts tests/commands/report.test.ts
```

Expected: FAIL because renderer is missing.

**Step 3: Implement HTML renderer**

Implement:

- `renderReportHtml(report, messages): string`
- report-specific sections for all supported report types
- small inline CSS
- no external assets

Wire `report output` to:

- parse `--lang`
- open workspace
- build selected view model
- render HTML
- write `--out` when provided
- return success envelope with report type, locale, and output path

**Step 4: Run focused tests**

Run:

```bash
npm test -- tests/report/html.test.ts tests/commands/report.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/report/html.ts src/commands/report.ts tests/report/html.test.ts tests/commands/report.test.ts docs/cli-reference.md
git commit -m "feat: add static report output"
```

### Task 5: Add Report Server API

**Files:**

- Create: `src/report/server.ts`
- Create: `tests/report/server.test.ts`
- Modify: `src/commands/report.ts`

**Step 1: Write failing tests**

Cover:

- `GET /api/config` returns `locale`, `supportedLocales`, `readOnly: true`.
- `GET /api/health`
- `GET /api/plans`
- `GET /api/plans/:planId/overview`
- `GET /api/plans/:planId/timeline`
- `GET /api/plans/:planId/requirements`
- `GET /api/plans/:planId/exceptions`
- `GET /api/plans/:planId/rules`
- `GET /api/scenarios`
- `GET /api/scenarios/:scenarioId/compare`
- report APIs include the active locale.
- `POST`, `PUT`, `PATCH`, `DELETE` return `405`.

**Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/report/server.test.ts
```

Expected: FAIL because server module is missing.

**Step 3: Implement Bun server**

Implement:

- `createReportServer({ cwd, host, port, locale })`
- JSON API routing
- route param parsing and validation
- static file fallback for web app
- no mutation handlers

Use existing success/failure result envelopes.

**Step 4: Run focused tests**

Run:

```bash
npm test -- tests/report/server.test.ts tests/commands/report.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/report/server.ts src/commands/report.ts tests/report/server.test.ts tests/commands/report.test.ts
git commit -m "feat: add report server api"
```

### Task 6: Add Vite, React, Tailwind, and shadcn Foundation

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Create: `src/report/web/index.html`
- Create: `src/report/web/vite.config.ts`
- Create: `src/report/web/tsconfig.json`
- Create: `src/report/web/tailwind.config.ts`
- Create: `src/report/web/postcss.config.js`
- Create: `src/report/web/src/main.tsx`
- Create: `src/report/web/src/App.tsx`
- Create: `src/report/web/src/styles.css`
- Create: `src/report/web/src/lib/utils.ts`
- Create: `src/report/web/src/lib/i18n.ts`
- Create: `src/report/web/src/components/ui/button.tsx`
- Create: `src/report/web/src/components/ui/badge.tsx`
- Create: `src/report/web/src/components/ui/table.tsx`
- Create: `src/report/web/src/components/ui/tabs.tsx`
- Create: `src/report/web/src/components/ui/select.tsx`
- Create: `src/report/web/src/components/ui/sheet.tsx`
- Create: `src/report/web/src/components/ui/tooltip.tsx`
- Create: `src/report/web/src/components/ui/scroll-area.tsx`
- Create: `src/report/web/src/components/ui/separator.tsx`

**Step 1: Install dependencies**

Run with npm only:

```bash
npm install react react-dom lucide-react class-variance-authority clsx tailwind-merge
npm install -D vite @vitejs/plugin-react tailwindcss postcss autoprefixer @types/react @types/react-dom
```

**Step 2: Add build scripts**

Add scripts:

```json
{
  "build:report-web": "vite build --config src/report/web/vite.config.ts",
  "check:report-web": "vite build --config src/report/web/vite.config.ts"
}
```

Keep existing `npm run check` and extend it only if build time remains reasonable.

**Step 3: Add shadcn-style components**

Add minimal shadcn-compatible component source directly under `src/report/web/src/components/ui`.

Use lucide icons in buttons. Avoid adding decorative icons where no meaning exists.

**Step 4: Add frontend i18n**

Implement `src/report/web/src/lib/i18n.ts` using API config locale. Support only `zh-CN` and `en-US`, with `zh-CN` fallback.

**Step 5: Run build**

Run:

```bash
npm run build:report-web
```

Expected: PASS and output to `dist/report-web`.

**Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/report/web
git commit -m "feat: add report web app foundation"
```

### Task 7: Build Report Web App Pages

**Files:**

- Create: `src/report/web/src/api.ts`
- Create: `src/report/web/src/types.ts`
- Create: `src/report/web/src/layout/AppShell.tsx`
- Create: `src/report/web/src/pages/PlanListPage.tsx`
- Create: `src/report/web/src/pages/PlanOverviewPage.tsx`
- Create: `src/report/web/src/pages/ResourceTimelinePage.tsx`
- Create: `src/report/web/src/pages/RequirementsPage.tsx`
- Create: `src/report/web/src/pages/ExceptionsPage.tsx`
- Create: `src/report/web/src/pages/RulesPage.tsx`
- Create: `src/report/web/src/pages/ScenarioComparePage.tsx`
- Modify: `src/report/web/src/App.tsx`

**Step 1: Write UI smoke tests or route map tests**

Cover:

- App fetches config and plans.
- Plan selector changes route state.
- Exception page renders localized rows.
- Timeline page renders resource rows and operation blocks.

**Step 2: Implement API client**

Implement `fetchJson` with failure envelope handling.

**Step 3: Implement shell**

Build a dense app shell:

- left sidebar
- top plan selector
- language indicator
- main report workspace
- no landing hero

**Step 4: Implement pages**

Implement read-only pages from design:

- plan list
- overview
- timeline
- requirements
- exceptions
- rules
- scenario compare

Use shadcn tables for table-like data and localized labels for UI chrome.

**Step 5: Run build**

Run:

```bash
npm run build:report-web
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/report/web
git commit -m "feat: add report web pages"
```

### Task 8: Wire Server Static App Serving

**Files:**

- Modify: `src/report/server.ts`
- Modify: `src/commands/report.ts`
- Modify: `tests/report/server.test.ts`

**Step 1: Write failing tests**

Cover:

- `/` returns `index.html` when build output exists.
- nested paths fall back to `index.html`.
- app bootstrap/config path exposes selected locale.
- missing web build returns a clear fastfail response or development hint.

**Step 2: Run tests and verify failure**

Run:

```bash
npm test -- tests/report/server.test.ts
```

Expected: FAIL until static serving is wired.

**Step 3: Implement static file serving**

Serve from `dist/report-web`.

Do not start Vite dev server from `octoplanner report serve`.

**Step 4: Run focused tests**

Run:

```bash
npm test -- tests/report/server.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/report/server.ts src/commands/report.ts tests/report/server.test.ts
git commit -m "feat: serve report web app"
```

### Task 9: Update Documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/cli-reference.md`
- Create: `docs/report.md`

**Step 1: Document commands**

Add examples:

```bash
npm run octoplanner -- report output --format html --lang zh-CN --plan march-plan plan-overview --out report.html
npm run octoplanner -- report output --format html --lang en-US --plan march-plan exception-review --out exceptions.html
npm run octoplanner -- report serve --lang zh-CN --port 5177
```

Document that the web app is report-only and read-only.

**Step 2: Document build requirement**

Explain:

```bash
npm run build:report-web
```

before using `report serve` from source.

**Step 3: Commit**

```bash
git add README.md docs/cli-reference.md docs/report.md
git commit -m "docs: document report commands"
```

### Task 10: End-to-End Verification

**Files:**

- Create: `tests/e2e/report-workflow.test.ts`

**Step 1: Write e2e test**

Create a workspace, load existing fixtures, create a case and plan, export `zh-CN` and `en-US` HTML reports, start the report server on an ephemeral port, and verify API responses include the selected locale.

**Step 2: Run full verification**

Run:

```bash
npm run check
npm run build:report-web
npm test -- tests/e2e/report-workflow.test.ts
find . -name 'pnpm-lock.yaml' -o -name '.pnpm'
```

Expected:

- all tests pass
- report web build passes
- no pnpm files found

**Step 3: Manual browser verification**

Start:

```bash
npm run octoplanner -- report serve --lang zh-CN --port 5177
```

Open `http://127.0.0.1:5177`.

Verify:

- no blank screen
- plan list loads
- overview loads
- timeline loads
- exception table loads
- details sheet opens
- Chinese UI labels display
- mobile and desktop layouts do not overlap

Repeat with:

```bash
npm run octoplanner -- report serve --lang en-US --port 5178
```

Verify English UI labels display.

**Step 4: Commit**

```bash
git add tests/e2e/report-workflow.test.ts
git commit -m "test: add report workflow verification"
```

### Task 11: Final Quality Check

**Files:**

- All touched files.

**Step 1: Run complete checks**

Run:

```bash
npm run check
npm run build
npm run build:report-web
git status --short --branch
```

Expected:

- TypeScript passes.
- Vitest passes.
- Distribution build passes.
- Report web build passes.
- Git status only shows intended changes before final commit, then clean after commit.

**Step 2: Inspect command outputs**

Run:

```bash
npm run octoplanner -- --version
npm run octoplanner -- report output --format html --lang zh-CN --plan <fixture-plan> plan-overview --out /tmp/octoplanner-report-zh.html
npm run octoplanner -- report output --format html --lang en-US --plan <fixture-plan> plan-overview --out /tmp/octoplanner-report-en.html
```

Expected:

- version returns success envelope.
- report output returns success envelope and writes localized HTML.

**Step 3: Final commit if needed**

```bash
git add .
git commit -m "chore: complete report subsystem"
```

Only commit if there are uncommitted intended changes.
