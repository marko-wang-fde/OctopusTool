# Digital worker model

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public platform worker concepts and sanitized FDE worker-design conventions.

## Worker boundary

Define one worker around a cohesive job outcome, not a list of unrelated tools. Record:

- stable ID, display name, role, service audience, and success outcome;
- owned scenarios, inputs, outputs, exclusions, and escalation;
- Skills and toolkit keys used by those Skills;
- business objects and permitted operations;
- internal versus external Station reachability;
- acting identity, role resolution, data scope, and human gates;
- handoffs, quick starts, and acceptance ownership.

Split a worker when responsibilities need materially different identity, permissions, lifecycle, audience, or operating cadence. Do not split merely to mirror departments.

## promptSpec boundary

Keep always-on behavior in promptSpec:

1. identity and job outcome;
2. permanent scope and explicit non-goals;
3. stable safety, identity, access, and human-in-the-loop guards;
4. Skill routing and capability boundaries;
5. failure, refusal, escalation, and evidence expectations.

Put procedural task detail in self-contained Skills. Avoid copying long workflows into promptSpec. Keep promptSpec, employee document, toolkit selection, Skill package, and assembly payload consistent.

## Toolkit boundary

Every toolkit key must be present in the public machine catalog and trace to a concrete Skill action and acceptance case. Grant the smallest set. Business workers must not receive administration capabilities solely because setup needs them; setup belongs to a separate manual or supported assembly operation.

## Skill boundary

Each Skill owns a repeatable workflow with clear inputs, outputs, decisions, and error behavior. A worker may have multiple Skills, but the initial solution should prefer one Skill when one cohesive workflow is sufficient.

The runtime Skill must not depend on project design notes, source interviews, absolute local paths, or files outside its package. Move stable operating facts into the package and keep customer-specific secrets out.

## Station boundary

Record `station_reachable` explicitly. Platform-internal use may rely on the authenticated current user and organization context. External reachability requires the External Station topic, identity-verification branches, role/data filtering, refusal behavior, and unbound-user handling.

Scheduled execution has no conversational speaker. Give it a service identity and a bounded query/recipient policy; never bypass access control by pretending the schedule is a human.

## Handoff contract

For every worker-to-worker or worker-to-human handoff, specify:

- initiating state and owner;
- task or artifact ID;
- required context with no hidden conversation dependency;
- receiver and authorization rule;
- accepted, rejected, timed-out, and retry states;
- evidence written back to the shared record.

The employee definition is complete only when normal, exception, permission-denied, refusal, and escalation paths are testable.
