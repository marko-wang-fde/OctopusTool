# Conditional topic: External Station

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public Station/identity guidance and sanitized external-access patterns.

## Trigger

Use whenever any employee is reachable from an external Station or messaging channel. External reachability alone never grants access to internal business data or actions.

## Required design questions

- Which Stations/channels are enabled, and what public pre-verification help is safe?
- How is an external identity bound to an internal/external principal?
- Which verification flows are approved, available, disabled, or failed?
- Which roles, records, fields, and actions become available after binding?
- How are external recipients resolved for outbound messages?
- What happens for unbound, wrong-tenant, revoked, expired, or ambiguous identities?

## Deliverable impact

Add `station_reachable`, channel scope, all identity branches, required capability selection, access matrix, recipient resolution, safe refusal/handoff, promptSpec guard, Skill behavior, delivery evidence, and external acceptance cases.

## Identity and permission risks

Never trust names, phone numbers, message content, or channel handles as proof. Do not reveal record existence before authorization. Keep verification in the platform-approved flow, never collect credentials in the Skill, and prevent cross-tenant or recipient confusion. Scheduled work uses a bounded service identity rather than the external speaker.

## Exit check

Exit when bound, unbound-with-flow, verification-unavailable, revoked/wrong-tenant, and scheduled branches are explicit; hard permissions and record filters agree; outbound recipients are bound; refusals leak no data; and all branches have acceptance evidence.
