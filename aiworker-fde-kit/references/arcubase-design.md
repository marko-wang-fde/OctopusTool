# Arcubase selection and design

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0; current public CLI evidence recorded 2026-07-24
Source: Public Arcubase guidance and sanitized data-foundation design patterns.

## Choose the data mode

- `none`: no durable structured business records are needed.
- `memory`: a small, low-risk preference or context file is sufficient.
- `new`: create a dedicated app for a new structured scenario; this is the default when durable business records are required.
- `existing`: use an existing app without schema modification.
- `extend`: modify an existing app only after explicit user request, dependency analysis, impact disclosure, and solution-baseline confirmation.

Always record the decision, including `mode: none`. Do not create multiple apps or tables simply because the source material contains multiple nouns.

## Model from workflows

Identify business objects, stable IDs, owners, lifecycle, and audit needs. For each table define purpose, primary field, required fields, types, defaults, unique constraints, indexes, links, state transitions, and retention.

Use links for real relationships rather than duplicated display text. Specify relationship cardinality and deletion behavior. Keep one authoritative structured table collection in the project manifest.

Arcubase derived values are not assumed to recalculate themselves. For every persisted derived field, define formula, inputs, responsible Skill or scheduled worker, update trigger, stale-data rule, and repair procedure.

## Access design

Separate:

- **acting identity**: current user, verified external user, or bounded service identity;
- **hard permission**: platform/app/table/record authorization;
- **conversation filtering**: query narrowing based on the resolved identity;
- **human role**: business entitlement such as submitter, manager, reviewer, or admin.

Conversation filters are not a substitute for hard permissions. Define create/read/update/delete and sensitive-field access by role, record ownership, and state. Test another user's record, manager scope, unbound identity, and scheduled execution.

Business workers normally receive user-level data access. App, table, schema, access-rule, and bulk administration belong to explicitly authorized delivery/admin identities.

## Provisioning boundary

Deliver a complete `schema.yaml`, access matrix, state model, migration/rollback notes, and verification checklist. Current public CLI evidence does not prove new Arcubase app or table creation. Keep both operations `admin-manual/manual-required`; do not invent commands such as schema apply, policy apply, app create, or table create.

The administrator should create or select the app, create tables and fields, apply links and hard permissions, record generated IDs, and return verification evidence. Only then update assembly references.

## Verification

Verify field and link existence, unique constraints, required/default behavior, state transitions, least-privilege reads/writes, unauthorized refusal, audit evidence, derived-field freshness, migration safety, and recovery condition. A design is not provisioned merely because its YAML validates.
