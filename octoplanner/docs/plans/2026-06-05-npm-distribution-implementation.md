# npm Distribution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a publish-time npm distribution flow for `@syngy/octoplanner` that generates a clean package directory containing Bun-executable CLI output, TypeScript declaration files, curated docs, examples, and JSON schemas.

**Architecture:** Keep the repository source layout unchanged and generate all publish artifacts into ignored `dist/` and `package/` directories. TypeScript emits runtime JavaScript and declaration files into `dist/`; a Bun script assembles `package/`, writes the publish-facing `package.json`, copies curated assets, and fastfails on missing required files.

**Tech Stack:** TypeScript, Bun runtime, npm scripts only, Bun file APIs, `tsc`, existing Vitest test suite.

---

### Task 1: Add Build Configuration

**Files:**
- Create: `tsconfig.build.json`
- Modify: `tsconfig.json`
- Modify: `package.json`
- Test: `npm run build`

**Step 1: Write the build config**

Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": false,
    "sourceMap": false,
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests", "vitest.config.ts"]
}
```

**Step 2: Keep dev typecheck no-emit**

Modify `tsconfig.json` so normal typechecking remains no-emit and still includes tests:

```json
{
  "compilerOptions": {
    "noEmit": true
  }
}
```

Keep the existing strict compiler options.

**Step 3: Add build script**

Modify `package.json`:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json"
  }
}
```

Do not remove existing `check`, `test`, or `octoplanner` scripts.

**Step 4: Run build**

Run:

```bash
npm run build
```

Expected: command succeeds and creates `dist/cli.js`, `dist/index.js`, and `dist/index.d.ts`.

**Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.build.json package-lock.json
git commit -m "build: add npm distribution TypeScript build"
```

### Task 2: Add Curated npm Documentation

**Files:**
- Create: `docs/agent-integration.md`
- Create: `docs/model-contract.md`
- Create: `docs/rule-contract.md`
- Create: `docs/scheduling-semantics.md`
- Create: `docs/examples.md`
- Modify: `docs/cli-reference.md` if needed

**Step 1: Add agent integration documentation**

`docs/agent-integration.md` should cover:

- install expectations: Bun runtime required
- workspace lifecycle: `workspace init`, then model/rule/case/plan commands
- single success path: parse JSON result envelope, fail on `ok: false`
- recommended agent loop: validate inputs, create case, create plan, inspect `notModeled`, export or commit

**Step 2: Add model contract documentation**

`docs/model-contract.md` should explain:

- `requirement`
- `item`
- `routing`
- `resource`
- `supply`
- reference relationships
- optional fields and project-specific omissions

**Step 3: Add rule contract documentation**

`docs/rule-contract.md` should explain:

- `not-start-until`
- `resource-unavailable`
- locks
- priority or business override rules
- how user-provided coarse rules differ from inferred constraints

**Step 4: Add scheduling semantics documentation**

`docs/scheduling-semantics.md` should explain:

- deterministic ordering
- precedence constraints
- resource capacity approximation
- what is and is not modeled
- why `notModeled` is part of successful output

**Step 5: Add examples documentation**

`docs/examples.md` should map the files under `examples/` to commands.

**Step 6: Commit**

```bash
git add docs/agent-integration.md docs/model-contract.md docs/rule-contract.md docs/scheduling-semantics.md docs/examples.md docs/cli-reference.md
git commit -m "docs: add npm package usage documentation"
```

### Task 3: Add Publish Examples

**Files:**
- Create: `examples/minimal/requirements.json`
- Create: `examples/minimal/items.json`
- Create: `examples/minimal/routings.json`
- Create: `examples/minimal/resources.json`
- Create: `examples/minimal/supplies.json`
- Create: `examples/reschedule/requirements.json`
- Create: `examples/reschedule/items.json`
- Create: `examples/reschedule/routings.json`
- Create: `examples/reschedule/resources.json`
- Create: `examples/reschedule/rules.json`
- Test: `tests/package/examples.test.ts`

**Step 1: Write failing examples test**

Create a test that loads every example JSON file and validates it with the current Zod schemas.

Expected validations:

- `minimal/requirements.json` validates as a requirement array
- `minimal/items.json` validates as an item array
- `minimal/routings.json` validates as a routing array
- `minimal/resources.json` validates as a resource array
- `minimal/supplies.json` validates as a supply array
- `reschedule/rules.json` validates as a rule array

Run:

```bash
npm test -- tests/package/examples.test.ts
```

Expected: FAIL because example files do not exist yet.

**Step 2: Add minimal examples**

Use compact records that cover one requirement, one item, one routing with one or two operations, one resource, and one supply entry.

**Step 3: Add reschedule examples**

Use compact records that demonstrate a `not-start-until` or `resource-unavailable` rule.

**Step 4: Run example tests**

Run:

```bash
npm test -- tests/package/examples.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add examples tests/package/examples.test.ts
git commit -m "test: add publish example fixtures"
```

### Task 4: Add JSON Schema Assets

**Files:**
- Create: `schemas/requirement.schema.json`
- Create: `schemas/item.schema.json`
- Create: `schemas/routing.schema.json`
- Create: `schemas/resource.schema.json`
- Create: `schemas/supply.schema.json`
- Create: `schemas/rule.schema.json`
- Create: `schemas/case.schema.json`
- Test: `tests/package/schemas.test.ts`

**Step 1: Write failing schema asset test**

Create a test that verifies all required schema files exist, parse as JSON, and expose:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "...",
  "type": "object"
}
```

For array-loadable model files, schema assets may either describe one object or the object inside an array, but the documentation must state the convention.

Run:

```bash
npm test -- tests/package/schemas.test.ts
```

Expected: FAIL because schema files do not exist yet.

**Step 2: Add schema files**

Start with manually curated JSON Schema files matching the required fields in `src/domain/schemas.ts`.

**Step 3: Run schema tests**

Run:

```bash
npm test -- tests/package/schemas.test.ts
```

Expected: PASS.

**Step 4: Commit**

```bash
git add schemas tests/package/schemas.test.ts
git commit -m "test: add published JSON schema assets"
```

### Task 5: Add Package Preparation Script

**Files:**
- Create: `scripts/prepare-package.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Test: `tests/package/prepare-package.test.ts`

**Step 1: Write failing package preparation test**

The test should run the preparation script against the current repository and assert:

- `package/package.json` exists
- `package/dist/cli.js` exists
- `package/dist/index.d.ts` exists
- `package/docs/cli-reference.md` exists
- `package/docs/agent-integration.md` exists
- `package/examples/minimal/requirements.json` exists
- `package/schemas/requirement.schema.json` exists
- `package/package.json` has `bin.octoplanner === "./dist/cli.js"`
- `package/package.json` has `types === "./dist/index.d.ts"`
- `package/package.json` has `engines.bun`
- `package/package.json` does not have `private: true`

Run:

```bash
npm test -- tests/package/prepare-package.test.ts
```

Expected: FAIL because the script does not exist.

**Step 2: Implement `scripts/prepare-package.ts`**

Script behavior:

- remove existing `package/`
- create `package/`
- copy `dist/` into `package/dist/`
- copy curated docs into `package/docs/`
- copy `examples/` into `package/examples/`
- copy `schemas/` into `package/schemas/`
- copy `README.md`
- copy `LICENSE` and `CHANGELOG.md` if present
- write publish-facing `package/package.json`
- verify every required file exists
- set executable mode on `package/dist/cli.js`

Fastfail with a clear error message on any missing required file.

**Step 3: Add npm scripts**

Modify `package.json`:

```json
{
  "scripts": {
    "clean": "rm -rf dist package",
    "package:prepare": "npm run clean && npm run check && npm run build && bun scripts/prepare-package.ts",
    "prepack": "npm run package:prepare",
    "pack:dry": "npm pack ./package --dry-run"
  }
}
```

Keep npm only. Do not add pnpm commands.

**Step 4: Update `.gitignore`**

Add:

```gitignore
dist/
package/
```

**Step 5: Run package preparation test**

Run:

```bash
npm test -- tests/package/prepare-package.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add scripts/prepare-package.ts package.json package-lock.json .gitignore tests/package/prepare-package.test.ts
git commit -m "build: assemble npm publish package"
```

### Task 6: Verify Published Package Shape

**Files:**
- Modify: `README.md`
- Modify: `docs/cli-reference.md` if command examples need package-specific notes

**Step 1: Run full package preparation**

Run:

```bash
npm run package:prepare
```

Expected: PASS and creates `package/`.

**Step 2: Dry-run npm pack**

Run:

```bash
npm pack ./package --dry-run
```

Expected output includes:

- `package/dist/cli.js`
- `package/dist/index.d.ts`
- `package/docs/cli-reference.md`
- `package/docs/agent-integration.md`
- `package/examples/minimal/requirements.json`
- `package/schemas/requirement.schema.json`

Expected output does not include:

- `src/`
- `tests/`
- `docs/design/`
- `docs/plans/`
- `docs/meeting.md`

**Step 3: Test executable package CLI**

Run:

```bash
bun package/dist/cli.js --version
```

Expected: JSON result with `ok: true`.

**Step 4: Run final verification**

Run:

```bash
npm run check
find . -name 'pnpm-lock.yaml' -o -name '.pnpm'
git status --short --branch
```

Expected:

- `npm run check` passes
- find command prints nothing
- git status shows only intentional files before commit, then clean after commit

**Step 5: Commit**

```bash
git add README.md docs/cli-reference.md
git commit -m "docs: document npm distribution workflow"
```

### Task 7: Final Release Notes

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Add changelog entry**

Add an unreleased or `0.1.0` entry documenting:

- Bun CLI npm package shape
- TypeScript declaration files
- curated docs in package
- examples and JSON schemas
- publish command

**Step 2: Run final dry run**

Run:

```bash
npm run package:prepare
npm pack ./package --dry-run
```

Expected: both pass.

**Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add npm distribution release notes"
```

### Task 8: Completion Check

**Files:**
- No file changes expected

**Step 1: Verify complete workflow**

Run:

```bash
npm run package:prepare
npm pack ./package --dry-run
bun package/dist/cli.js --version
npm run check
```

Expected: all commands pass.

**Step 2: Verify repository cleanliness**

Run:

```bash
git status --short --branch
```

Expected: clean except ignored generated `dist/` and `package/`.

**Step 3: Report**

Report:

- package directory generated successfully
- dry-run pack contents verified
- CLI executable verified
- tests passed
- no pnpm artifacts found
