# Octoplanner Report Design

## Decision

`report` is a read-only reporting subsystem for `octoplanner`. It turns existing scheduling facts into human-readable and interactive views. It does not create, edit, approve, commit, or optimize schedules.

The selected stack is:

- React
- Vite
- Tailwind CSS
- shadcn/ui component source
- Bun native HTTP server
- Existing SQLite workspace and TypeScript domain services

Dependency management must use `npm` only.

## Product Boundary

The web app is report-only.

Allowed:

- View plans.
- View plan metrics.
- View resource timelines.
- View requirement operation chains.
- View exceptions and unplanned operations.
- View rules and explanations.
- View scenario comparisons.
- Export HTML reports from the CLI.
- Select report language with `--lang`.

Not allowed in the web app:

- Add, edit, enable, disable, or expire rules.
- Trigger scenario simulation.
- Commit scenarios into plans.
- Drag operations to reschedule.
- Write model data.

All scheduling decisions remain in CLI/API/Agent workflows. The web surface explains what exists.

## Language Contract

Both static reports and the served web app support an explicit language option:

```bash
octoplanner report output --format html --lang zh-CN --plan <plan> plan-overview --out report.html
octoplanner report serve --lang zh-CN --host 127.0.0.1 --port 5177
```

Supported languages for the first version:

- `zh-CN`
- `en-US`

Default:

- `zh-CN`

Language affects UI labels, table headers, status labels, empty states, generated report headings, and suggested next-action text. It does not translate model payload values such as customer names, item names, resource names, rule reasons, or external references.

Unsupported language values fastfail with `UNSUPPORTED_LANGUAGE`.

The report view model carries `locale` and `messages`-derived display labels where server-side rendering needs them. The React app receives the selected locale through both bootstrapped server config and API responses.

## Mobbin References

Mobbin references used for the UI direction:

- [Asana operations screen](https://mobbin.com/screens/6959e583-bb0f-4cc5-a59e-addbb3bec6b6): app shell, sidebar navigation, workspace context.
- [ClickUp workspace screen](https://mobbin.com/screens/41e2b803-107e-44ad-95bf-63c11f49a411): dense list views, filters, view switching.
- [Jira issue list screen](https://mobbin.com/screens/f950f8ac-245f-4521-970d-7ef5ccd3dd58): status-driven table scanning and issue detail entry.
- [Wrike timeline screen](https://mobbin.com/screens/9a517513-869c-4d4a-a662-b7db60511a86): split layout with object list and horizontal timeline.
- [Linear issue screen](https://mobbin.com/screens/64119b7d-8337-4873-8794-1ead1cba2618): restrained density and fast scanning.
- [Coda review table screen](https://mobbin.com/screens/0d26fe11-de85-4d20-83f1-baafcb79db7b): structured exception review.
- [Neon console screen](https://mobbin.com/screens/926541e1-1d12-4677-8faf-54193a709b17): technical status layout and clear control zones.
- [Hex analysis screen](https://mobbin.com/screens/6aa08e33-4ae8-4468-a85e-ba367cc78dbe): analytical workspace composition.

The UI should borrow the information architecture patterns, not copy visual styling.

## Command Shape

```bash
octoplanner report output --format html [--lang zh-CN|en-US] --plan <plan> <report-type> [--out <file>]
octoplanner report output --format html [--lang zh-CN|en-US] --scenario <scenario> scenario-compare [--out <file>]
octoplanner report serve [--lang zh-CN|en-US] [--host 127.0.0.1] [--port 0]
```

Supported report types:

- `plan-overview`
- `resource-timeline`
- `requirement-trace`
- `exception-review`
- `rule-impact`
- `scenario-compare`

`report output` writes static HTML or prints the success envelope with the output path.

`report serve` starts a local read-only web server and prints the URL in the success envelope.

## Architecture

```text
octoplanner CLI
  -> report command
     -> locale parser
     -> report service
        -> repositories
        -> existing plan, timeline, impact, explain services
     -> report output renderer
     -> report server
        -> API routes
        -> Vite-built React app
```

The report service owns view-model creation. The React app consumes view-model APIs. Static HTML output consumes the same view-models.

No report code should reimplement scheduling decisions.

## View Models

The report layer should expose stable view models:

- `PlanOverviewReport`
- `ResourceTimelineReport`
- `RequirementTraceReport`
- `ExceptionReviewReport`
- `RuleImpactReport`
- `ScenarioCompareReport`

Each view model includes:

- `generatedAt`
- `locale`
- `workspace`
- `reportType`
- source object metadata
- display-ready records
- warnings
- `notModeled`

The view model is intentionally separate from raw `Plan`, because report pages need grouped, sorted, display-ready structures.

## API Shape

Read-only API routes:

- `GET /api/config`
- `GET /api/health`
- `GET /api/plans`
- `GET /api/plans/:planId/overview`
- `GET /api/plans/:planId/timeline`
- `GET /api/plans/:planId/requirements`
- `GET /api/plans/:planId/exceptions`
- `GET /api/plans/:planId/rules`
- `GET /api/scenarios`
- `GET /api/scenarios/:scenarioId/compare`

`GET /api/config` returns the active `locale`, supported languages, and read-only mode.

API failures use the existing JSON failure envelope. The server must reject unsupported methods with fastfail-style errors. Mutation methods should return `405`.

## UI Layout

```text
App Shell
  Left Sidebar
    Plans
    Resource Timeline
    Requirements
    Exceptions
    Rules
    Scenarios
  Top Bar
    Plan selector
    Language indicator
    Plan state
    Time range
    Export affordance
  Main Workspace
    Summary strip
    Filters
    Primary report view
    Detail sheet
```

The first screen should be a usable report workspace, not a landing page.

## Pages

`/`

- Plan list.
- Latest active plan highlighted.
- Quick links to overview, timeline, exceptions.

`/plans/:planId`

- Plan overview.
- KPI strip.
- Unplanned operations.
- Warnings and not-modeled facts.

`/plans/:planId/timeline`

- Resource split view.
- Sticky resource list.
- Horizontally scrollable time grid.
- Operation blocks with status badges.

`/plans/:planId/requirements`

- Requirement table.
- Operation chain detail sheet.
- Due date and priority scanning.

`/plans/:planId/exceptions`

- Exception triage table.
- Filters by type, severity, requirement, resource.
- Suggested next action text from report service.

`/plans/:planId/rules`

- Applied rules.
- Rule target and explanation.
- Links to impacted requirements or resources when available.

`/scenarios/:scenarioId`

- Candidate comparison.
- Metric deltas.
- Moved, added, and removed operations.

## Visual Direction

Use a light, dense, production-operations workspace:

- Background: `#f8fafc`
- Surface: `#ffffff`
- Border: `#e5e7eb`
- Text: `#111827`
- Muted text: `#6b7280`
- Primary: blue
- Success: green
- Risk: amber
- Blocked: red
- Locked/archived: neutral gray

Avoid:

- Marketing hero pages.
- Decorative gradient backgrounds.
- Oversized cards.
- Nested cards.
- One-note purple or dark dashboard themes.

## shadcn/ui Component Use

Recommended components:

- `Table` for requirements, exceptions, rules.
- `Tabs` for plan sections.
- `Select` for plan, resource, and time range selectors.
- `Badge` for state, severity, rule type, locked state.
- `Sheet` for operation and requirement details.
- `Tooltip` for field explanations.
- `ScrollArea` for timeline scrolling.
- `Separator` for dense layout separation.
- `Button` with lucide icons for refresh, export, filter, zoom.

## Testing Strategy

Tests should cover:

- CLI command routing for `report`.
- Language parsing and unsupported language fastfail.
- HTML output generation in `zh-CN` and `en-US`.
- Report view-model correctness.
- Server API read-only behavior.
- Server config API returns selected language.
- Server static app fallback.
- React app smoke render.
- No mutation endpoints.
- Existing `npm run check`.

Visual verification should include desktop and mobile screenshots after implementation.

## Success Criteria

- `report output --format html` creates useful static HTML for each report type.
- `report output --lang zh-CN|en-US` changes report UI labels.
- `report serve --lang zh-CN|en-US` starts a local report site in the selected language.
- The site can browse plans, timelines, requirements, exceptions, rules, and scenario comparisons.
- The site has no write actions.
- All structured inputs and route params are validated.
- All failures fastfail with existing JSON envelopes.
- Existing CLI behavior remains unchanged.
