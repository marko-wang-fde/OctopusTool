# Changelog

## 0.1.0

- Added Bun-first npm distribution packaging for `@syngy/octoplanner`.
- Added TypeScript declaration output under `dist/**/*.d.ts`.
- Added curated package documentation for CLI usage, agent integration, model contracts, rule contracts, scheduling semantics, and examples.
- Added published example datasets for minimal planning and rescheduling scenarios.
- Added published JSON Schema assets for external adapters and AI agent pre-validation.
- Added `npm run package:prepare` to generate the publish directory and `npm pack ./package --dry-run` for package content verification.
- Added baseline-aware revision planning with `plan revise`, including structured `revision` input and `moveScope: impacted-only` repair behavior.
- Added structured `plan diff` output with moved, unchanged, added, removed, unplanned, rule reason, and external source reference fields.
- Added `plan-diff` HTML report output and report server API support for loading diff files.
- Added React/Vite report web assets to the npm package, including interactive resource timeline support.
- Added urgent insertion example data for order `601277344`, covering baseline load, revision, diff, and report generation.
- Improved repair scheduling so unaffected baseline operations are preserved while impacted resource queues and downstream operations are recalculated.
