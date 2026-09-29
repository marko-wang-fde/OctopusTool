# Conditional topic: A2UI

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public A2UI guidance and sanitized structured-interaction patterns.

## Trigger

Use when a chat question is inadequate for multi-field collection, review, comparison, approval, correction, or a structured status display. Do not add A2UI when a short conversational choice is clearer.

## Required design questions

- Which user decision or data-entry problem requires structured UI?
- What fields, validation, defaults, dependencies, and sensitive classifications apply?
- Which values are read-only, editable, derived, or conditionally visible?
- What submit, cancel, reject, revise, timeout, and duplicate-submit behavior exists?
- What accessible text fallback is available?
- What identity and server-side authorization are rechecked on submit?

## Deliverable impact

Add component/state specification, validation and error copy, binding to stable business fields, prompt/Skill invocation, approval evidence, accessibility/fallback, and UI acceptance cases. V1 has no dedicated template or validator, so selection always requires a `WARNING` and specialist follow-up; do not claim full specialized coverage.

## Identity and permission risks

UI visibility is not authorization. Recheck identity, role, record ownership, field access, and lifecycle state server-side at submission. Avoid embedding secrets or excessive personal data in client state. Prevent stale, replayed, forged, or double submissions.

## Exit check

Exit when every field maps to an authoritative schema, validation and state transitions are deterministic, submit/cancel/reject are auditable, authorization is rechecked, accessibility fallback exists, and stale/unauthorized/duplicate cases pass.
