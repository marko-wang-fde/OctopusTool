# Identity and access

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public identity guidance and sanitized Station/access-control patterns.

## Resolve identity before authority

For every action, record channel, speaker context, acting identity, organization role, resource scope, operation, and evidence. Authentication answers who is present; authorization answers what that identity may do. Do not infer either from a name, phone number, message text, or requested record.

## Contexts

- **Internal conversation**: use the authenticated current user and current Team; still enforce role and record scope.
- **External Station**: require a verified binding before sensitive reads or writes.
- **Scheduled work**: use an explicit service identity and bounded record/recipient policy; there is no current speaker.
- **Administrator assembly**: keep separate from business-worker identity and require explicit authorization.

## External identity branches

1. If a valid binding exists, resolve the internal identity, roles, and allowed scope before action.
2. If no binding exists and an approved verification flow is available, guide the user into that platform flow; do not collect or validate credentials yourself.
3. If verification is unavailable, restrict the interaction to public help or a safe human handoff.
4. For scheduled work, skip conversational verification but enforce service-account scope and explicit recipients.

Never reveal whether a sensitive record exists before authorization. Deny safely and preserve a reason code without exposing protected data.

## Permission model

Design hard resource permissions first, then conversation-layer filters for user experience. Use least privilege across capability, app, table, record, field, action, channel, and lifecycle state.

Record:

- human and service roles;
- identity source and verification state;
- allowed objects, records, fields, and operations;
- ownership and manager-scope rules;
- high-risk human approvals;
- escalation, revocation, audit, and recovery;
- external recipient binding and delivery evidence.

Do not give ordinary business employees system, organization, ontology, or data-administration capability to simplify setup.

## Acceptance paths

Test permitted action, another user's record, wrong role, unknown/unbound identity, disabled verification, scheduled identity, revoked access, external recipient mismatch, and administrator separation. Include both refusal text and absence of side effects.

Any external Station employee lacking identity branches, any data design relying only on conversational filtering, or any privileged action without an authorized identity is a blocker.
