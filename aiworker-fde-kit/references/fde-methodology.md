# FDE methodology

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public platform guidance and sanitized FDE method snapshots; no tenant or customer data.

## Outcome

Translate confirmed business work into the smallest maintainable digital-employee system. A good design states who is served, what begins the work, what the employee may decide, where humans decide, which records change, and how success is proven.

## Discovery model

Classify every claim:

- **Fact**: supported by a named user statement or indexed source.
- **Assumption**: needed to progress but not yet confirmed.
- **Conflict**: sources disagree; retain both claims and their origins.
- **Open question**: an answer changes scope, risk, data, identity, or acceptance.
- **Exclusion**: explicitly outside this delivery.

Ask the single question that removes the most downstream uncertainty. Never silently promote an assumption to fact.

Model each scenario with trigger, actor, current pain, inputs, steps, decision points, business objects, outputs, exception paths, service expectation, channel, identity context, and measurable acceptance.

## Source handling policy

By default, copy selected source files to `inputs/source-files/`. For each source, record its original path, SHA-256, media type, read status, and copy time in the source inventory.

The user may choose reference-only handling instead. Then do not copy the source, set `portable: false`, and disclose delivery package implications, including that another environment may not be able to reproduce discovery from the recorded path.

## Minimal team heuristic

Start with one employee, one Skill, and one table when one cohesive responsibility can own the complete loop. Split only when at least one is true:

- responsibilities have distinct goals or audiences;
- permissions or identities must differ;
- lifecycle, cadence, or escalation differs materially;
- separate ownership improves acceptance or maintenance;
- one prompt/Skill would otherwise become a catch-all.

Do not map every current human role to a digital employee. Map cohesive work and explicit accountability.

## Handoffs and humans

For every handoff, define producer, consumer, artifact or task, state transition, timeout, rejection path, and owner. Use a human gate before external commitments, financial or legal decisions, sensitive disclosure, destructive/bulk updates, publishing, and permission changes. Preserve evidence of the decision.

## Baselines and change

Confirm the requirements baseline before final team design. Confirm the solution baseline before authoring employee Skills and assembly artifacts.

After a baseline, treat changed source or output hashes as user edits or upstream change. Preserve files, mark the affected stage `needs-review`, mark downstream stages `stale`, and show the impact before regenerating anything. Stable IDs do not change merely because display names change.

## Stage completeness

- `initialize`: project identity, entry mode, path, source policy, and creation gate recorded.
- `discover`: facts, assumptions, conflicts, questions, scenario, scope, and baseline recorded.
- `team-design`: minimal team, handoffs, capability proposal, and identity constraints recorded.
- `foundation-design`: explicit data mode and access design, final capability/identity design, and solution baseline recorded.
- `author`: worker definitions and self-contained Skills agree with the baseline.
- `assemble`: supported/manual/blocked operations and acceptance artifacts are explicit.
- `validate`: package scanning, manifest, references, contracts, and delivery report pass.

Do not call a project deliverable because the documents look complete. Delivery requires zero blockers and a verified package manifest; CLI dry-run and production acceptance are separate later evidence.
