---
name: design-aiworker-solutions
description: Use when designing an AIWorker digital employee or team FDE project, producing validated delivery packages, running octopus-cli assembly, or resuming an AIWorker FDE project.
---

# Design AIWorker Solutions

## Operating boundary

Produce a reviewable, validated FDE delivery package that can be directly assembled through `octopus-cli` after an explicit live-assembly gate. Prefer the smallest coherent solution: start with one employee, one self-contained Skill, and one data table when that covers the confirmed workflow. Add employees, Skills, tables, or conditional topics only when distinct responsibilities or evidence require them.

Do not execute live platform writes until the user confirms the target Profile, target Team, and delivery package hash for the current project. V1 supports direct `octopus-cli` assembly for cataloged operations only; unsupported multipart Skill package upload, Arcubase, or platform actions remain manual-required.

## Choose an entry mode

- Use `new` when the first source is a requirement stated in conversation.
- Use `materials` when user-selected files are the primary sources. Inventory them before designing.
- Use `resume` only when entering an existing FDE project. Validate its manifest and preserve user edits; do not rebuild it by default.

Before creating or changing a project, propose a project display name, lowercase ASCII directory slug, absolute target path, and entry mode. Ask the user to confirm all four. If the directory exists, offer resume, a different slug, or cancel; never overwrite it.

## Run the seven stable stages

Keep these stage IDs and order. At each stage, record inputs, outputs, assumptions, issues, and status in the project manifest.

### 1. `initialize`

Input: confirmed project display name, ASCII directory slug, absolute target path, and entry mode; for `new`, the user request or conversation requirement; for `materials`, selected source files; for `resume`, the existing project directory and `fde-project.yaml` when present, or the import-proposal path when the manifest is missing.

After the project creation gate, create or import the project skeleton and source inventory. For resume, stop on an unparseable manifest; preview migrations and imports before changing files. Read [FDE methodology](references/fde-methodology.md) and the [project transaction contract](references/transaction-contract.md).

Output: project manifest, initialized project skeleton, source inventory with recorded portability state, and stage state.

### 2. `discover`

Input: project manifest and the user request or source inventory selected by the entry mode.

Extract evidence as facts, assumptions, conflicts, exclusions, actors, business objects, workflow, and human-in-the-loop points. Ask one highest-impact question at a time. Read [FDE methodology](references/fde-methodology.md) and [acceptance](references/acceptance.md).

Output: facts, assumptions, open questions, scenario model, scope, and requirements-baseline decision.

### 3. `team-design`

Input: confirmed discovery baseline with scenarios, actors, business objects, scope, and human-in-the-loop points.

Design the minimum employee set with cohesive responsibilities, handoffs, Skills, channels, identities, and acceptance ownership. Read [worker model](references/worker-model.md), [platform capabilities](references/platform-capabilities.md), and [identity and access](references/identity-and-access.md).

Output: team design, workflow and collaboration/dataflow, employee boundaries, capability and identity baseline.

### 4. `foundation-design`

Input: confirmed discovery/requirements baseline plus team-design outputs: team, workflow, business objects, capability proposal, and identity constraints.

Choose no structured store, lightweight memory, a new dedicated Arcubase app, an existing app without modification, or an explicitly approved extension. Complete this stage with `mode: none` when no Arcubase is needed. Read [Arcubase design](references/arcubase-design.md) and [identity and access](references/identity-and-access.md).

Output: Arcubase decision, applicable schema, access design, finalized capability and identity design, derived-field ownership, and manual-provisioning plan.

**Solution baseline gate:** confirm worker count and responsibilities, workflow, data foundation, capability and identity design, permissions, human-in-the-loop controls, and conditional topics before `author`.

### 5. `author`

Input: solution-baseline-approved worker contracts, Skill contracts, capability contracts, identity contracts, and data contracts.

Write each employee definition and a self-contained Skill package. Keep stable facts aligned across promptSpec, toolkit selection, Skill behavior, data references, and Station boundaries. Read [worker model](references/worker-model.md) and [Skill authoring](references/skill-authoring.md).

Output: employee definitions, promptSpecs, quick starts, toolkit selections, and self-contained Skill packages.

### 6. `assemble`

Input: approved artifacts, versioned operation catalog, and current CLI evidence.

Create the structured assembly plan, contract-backed payloads, manual administrator steps, and acceptance cases. Read [octopus-cli evidence](references/octopus-cli.md), [platform capabilities](references/platform-capabilities.md), and [acceptance](references/acceptance.md).

Only the renderer may create Bash. Rendered live Bash calls `octopus-cli` directly through the fixed `run_octopus_assemble` wrapper and never adds dry-run flags to production assembly calls. Use inspector evidence, including global `octopus-cli --dryrun` body probes when available, only to validate the local CLI contract before rendering. Never infer CLI options, payloads, or toolkitKeys from `--help-json`; every live write must come from the versioned catalog, exact payload path, exact output binding, and an API-native payload Schema. Do not send FDE wrapper fields such as `schema_version`, `operation_id`, `skill_set`, `skill_refs`, `worker`, `worker_ref`, or `skill_set_refs` to live `octopus-cli` writes.

For `octopus-cli` 0.1.2, ordinary one-file Team Skill assembly is catalog-supported only through `skill.upload` (`configure skill upload add`), `skill.enable-assembly` (`configure skill enable-assembly add <id>`), and employee/public Skillset binding operations with renderer-managed output bindings. Treat `skill-set.create` as `manual-required`: the command path exists, but execution-layer evidence shows `configure skill set add` drops body/query options. Treat multipart `skill-package.upload` as `manual-required`: the API is form-data and the current generic CLI path sends JSON.

Output: supported/manual/blocked operations, payloads, manual steps, optional rendered assembly script, and acceptance cases.

### 7. `validate`

Input: full project, assembly evidence, and package policy.

Run structure, schema, link, cross-document, security, assembly-contract, and package checks. If explicitly authorized and a valid Profile and Team exist, run direct CLI assembly for supported catalog operations. Read [acceptance](references/acceptance.md) and [octopus-cli evidence](references/octopus-cli.md).

Output: issue-ranked validation report, package manifest, validated package, assembly evidence when executed, and delivery-readiness summary.

Run `scripts/validate-project <absolute-project-dir>` first. A successful
structural validation does not make the project deliverable. After the first
six stages are accepted, run
`scripts/package-delivery <absolute-project-dir> --confirm-personal-data`.
The package transaction repeats validation and sensitive-data scanning,
verifies the package manifest against the ZIP, and accepts `validate` only
when the final artifact is internally consistent.

## Project statuses

Project status is derived from stage state and blockers; never set it by hand.

- `draft` means at least one of the first three stages (`initialize`,
  `discover`, and `team-design`) is not `complete`, or one has a `BLOCKER`.
- `reviewable` means the first three stages are `complete` with no blocker
  assigned to them, but at least one of the remaining four stages is not
  `complete` or another `BLOCKER` exists.
- `delivery-ready` means all seven stages are `complete`, there is zero
  `BLOCKER`, and the delivery scan plus package manifest verification passed.
- `cli-assembled` first requires `delivery-ready`, at least one
  supported write operation, and one authorized validation in which every
  supported write uses the same artifact hash, confirmed Profile and Team,
  and succeeds through direct `octopus-cli` assembly. Fixture evidence can
  never produce this state.

`cli-assembled` means the catalog-supported live assembly calls completed. It
does not prove manual-required multipart Skill package upload, Arcubase
provisioning, or broader platform acceptance.

See
[installation](docs/installation.md) and the
[FDE operator guide](docs/fde-operator-guide.md).

## Enforce five human gates

1. **Project creation gate** — obtain confirmation of the project display name, ASCII directory slug, absolute target path, and entry mode before writing.
2. **Requirements baseline gate** — present facts, assumptions, conflicts, blockers, and exclusions; obtain confirmation or permission to continue with marked assumptions.
3. **Solution baseline gate** — confirm employee count, responsibilities, workflow, foundation, capabilities, identity, permissions, human checks, and conditional topics before authoring.
4. **Delivery readiness gate** — present versions, validation scope, issue severity, assembly status, manual steps, file inventory, and summary.
5. **Live assembly gate** — before running `octopus-cli` live assembly, present the confirmed Profile, Team, package hash, supported operation list, unsupported manual steps, and risk boundary; proceed only after explicit user confirmation.

## Load conditional topics directly

Read a topic only when its trigger applies, and incorporate its questions and exit check without adding another stage:

When Ontos, A2UI, or Private Service is selected in V1, always emit a `WARNING` and require specialist follow-up because V1 has no dedicated template or validator; never claim full specialized coverage.

- [Taskboard](references/conditional-topics/taskboard.md) for durable human/employee task coordination.
- [Browser and WebSkill](references/conditional-topics/browser-and-webskill.md) for browser automation or hosted web interaction.
- [Ontos](references/conditional-topics/ontos.md) for ontology-backed semantics or impact analysis.
- [A2UI](references/conditional-topics/a2ui.md) for structured forms, cards, or approval interaction.
- [External Station](references/conditional-topics/external-station.md) for any externally reachable employee.
- [Private Service](references/conditional-topics/private-service.md) for customer-private API or network integration.

## Stop safely

- If the CLI is missing, provide installation and verification instructions but do not auto-install, auto-login, or select a Team.
- Use `skill.upload` for catalog-supported ordinary one-file Team Skill markdown upload. The payload is API-native JSON `{ "slug": "...", "content": "..." }`.
- Use `skill.enable-assembly` only with a real platform Skill ID returned by `skill.upload` or recorded evidence; let the renderer supply positional bindings.
- Use `employee.skillsets.set` only with a real platform DigiEmployee ID and real public Skillset IDs; let the renderer supply output-derived bindings when available.
- Treat `skill-set.create` as `manual-required` for `octopus-cli` 0.1.2 because `configure skill set add` currently drops body/query options in execution-layer probes and must not be used for automatic assembly.
- Treat multipart ordinary Skill package upload (`configure skill package-upload add`) as `manual-required` because the API requires form-data while the current generic CLI path sends JSON.
- Treat new Arcubase app or table creation as `manual-required` until a tested public capability explicitly supports it.
- Treat platform-returned IDs as mandatory for live bindings. Logical FDE IDs such as `skill.*`, `worker.*`, and `skillset.*` are documentation references, not valid live API IDs.
- Do not append `employee-hire.create` after `team-private-digiworker.create`; private worker creation already creates the Team employee. Use `employee-hire.create` only for an existing platform worker with a real `digiWorkerId`.
- Use the versioned catalogs as public machine facts. Treat unknown toolkit keys, unsupported command shapes, invalid payloads, missing identity guards, or unresolved permissions as blockers.
- Separate catalog evidence from current CLI command evidence. Command existence does not prove options, payload shape, platform acceptance, or target-Team availability.

Exit only when all seven stages are complete, no blocker remains, the package manifest matches the package, manual steps are explicit, and the delivery-readiness gate has been presented. If live assembly is requested, additionally require the live assembly gate and preserve CLI evidence; direct assembly success is not acceptance for manual-required items.
