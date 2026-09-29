# Acceptance and issue severity

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public delivery guidance and sanitized FDE acceptance patterns.

## Evidence levels

Keep three claims separate:

- **Document and package valid**: structures, Schemas, references, catalogs, consistency, security scan, and manifest pass.
- **Live assembly executed**: the selected installed CLI executed the supported writes for one explicit profile/Team and the current artifact hashes.
- **Production accepted**: platform resources exist and business owners verified the live result. This claim requires live evidence, not document completeness.

## Issue severity

- `BLOCKER`: delivery-ready is forbidden. Examples include unknown toolkit key, missing Skill, invalid field reference, invalid payload, permission overreach, missing identity guard, contract/CLI conflict, secret exposure, or no feasible assembly route.
- `WARNING`: a review package may proceed with disclosure. Examples include a marked noncritical assumption, old but compatible evidence, missing optional target evidence, or a conditional topic requiring specialist follow-up.
- `INFO`: optimization or traceability note with no delivery impact.

Every issue includes stable code, severity, affected path/object, evidence, impact, owner, and recovery condition. Do not lower severity merely to finish packaging.

## Case coverage

For every main business action, include:

- normal success and observable output;
- missing/incomplete input;
- duplicate or idempotent repeat;
- business-rule exception;
- wrong role, wrong record owner, and denied sensitive field;
- external unbound identity when relevant;
- human approval accepted, rejected, and timed out;
- downstream tool/service failure and retry/escalation;
- refusal for explicitly prohibited scope;
- audit, task, artifact, or record evidence.

Trace each case to scenario, worker, Skill, capability, business object, field/state, identity context, and expected side effects.

## Delivery checks

Require:

- seven stages complete under their own contracts;
- four human gates recorded or presented as specified;
- zero blockers;
- all structured files validate;
- all local links and stable IDs resolve;
- promptSpec, worker, Skill, toolkit, data, access, and payload facts agree;
- Skill packages are self-contained;
- supported operations have contract and evidence;
- manual-required operations have complete artifacts and verification;
- any rendered Bash is byte-derived by the renderer and gated before live execution;
- secrets, credentials, private endpoints, unrelated customer data, and local absolute paths are absent;
- package manifest lists every included file except itself with matching hashes.

## Exit report

Report Kit version, CLI package/runtime versions separately, catalog revision, validation scope, issue counts, live assembly status and target context without secrets, manual steps, exclusions, package inventory, and known warnings.
