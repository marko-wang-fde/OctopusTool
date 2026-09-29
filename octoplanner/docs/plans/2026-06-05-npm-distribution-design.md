# npm Distribution Directory Design

**Goal:** Define the npm package shape for `@syngy/octoplanner` so AI agents can install the CLI, execute it with Bun, and read local type contracts and usage documentation from the published package.

## Decision

`octoplanner` should keep the source repository optimized for development and generate the npm distribution directory during the publish or pack flow.

The repository should not treat the publish directory as hand-maintained source. Instead, a build script should create a clean `package/` directory that contains only runtime JavaScript, TypeScript declaration files, curated documentation, examples, and machine-readable schemas.

## Repository Layout

```text
octoplanner/
  src/
  docs/
  tests/
  package.json
  tsconfig.json
  tsconfig.build.json
  scripts/

  dist/      # generated TypeScript build output, gitignored
  package/   # generated npm publish directory, gitignored
```

## Publish Directory Layout

```text
package/
  package.json
  README.md
  LICENSE
  CHANGELOG.md

  dist/
    cli.js
    index.js
    index.d.ts
    commands/
    core/
    domain/
    planner/
    store/

  docs/
    cli-reference.md
    agent-integration.md
    model-contract.md
    rule-contract.md
    scheduling-semantics.md
    examples.md

  examples/
    minimal/
      requirements.json
      items.json
      routings.json
      resources.json
      supplies.json

    reschedule/
      requirements.json
      items.json
      routings.json
      resources.json
      rules.json

  schemas/
    requirement.schema.json
    item.schema.json
    routing.schema.json
    resource.schema.json
    supply.schema.json
    rule.schema.json
    case.schema.json
```

## Package Semantics

The published package is a Bun CLI package, not a Node-compatible CLI package. The generated `package/package.json` should expose:

```json
{
  "name": "@syngy/octoplanner",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "octoplanner": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schemas": {
      "types": "./dist/domain/schemas.d.ts",
      "import": "./dist/domain/schemas.js"
    },
    "./docs/*": "./docs/*",
    "./examples/*": "./examples/*",
    "./json-schemas/*": "./schemas/*"
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "engines": {
    "bun": ">=1.1.0"
  }
}
```

The CLI entry file must keep a Bun shebang:

```js
#!/usr/bin/env bun
```

## Documentation Boundary

Only user-facing documentation should be included in the npm package. Internal design notes, implementation plans, meeting notes, tests, and source maps should not be published unless explicitly needed later.

The minimum documentation set is:

- `cli-reference.md`: all commands and flags
- `agent-integration.md`: how an AI agent should call the CLI
- `model-contract.md`: model object semantics and required references
- `rule-contract.md`: rule semantics such as `not-start-until`, shortages, and locks
- `scheduling-semantics.md`: deterministic scheduling behavior and not-modeled boundaries
- `examples.md`: executable example walkthroughs

## Examples Boundary

Examples should be small and stable. They are not tests, although tests may reuse them. They should demonstrate:

- a minimal normal planning flow
- a rescheduling flow caused by shortage or upstream process blockage

## Schema Boundary

Zod remains the runtime validation source in code. JSON Schema files are distributed for external adapters, ERP mappings, and AI agent pre-validation.

If generated schema quality is not sufficient in the first implementation, manually curated JSON Schema files are acceptable as long as tests verify they remain synchronized with required model fields.

## Build And Publish Flow

The recommended release commands are:

```bash
npm run package:prepare
npm pack ./package --dry-run
npm publish ./package
```

`package:prepare` should fastfail if:

- tests fail
- typecheck fails
- `dist/cli.js` is missing
- `dist/index.d.ts` is missing
- required docs are missing
- required examples are missing
- required schemas are missing
- generated `package/package.json` points to missing files

## Non-Goals

- Do not publish `src/` as the runtime entry.
- Do not support Node execution until the SQLite dependency is changed away from `bun:sqlite`.
- Do not publish internal planning docs.
- Do not make format conversion part of this package; external systems should adapt into the model contracts before calling `octoplanner`.
