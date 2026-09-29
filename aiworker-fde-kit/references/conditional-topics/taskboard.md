# Conditional topic: Taskboard

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public Taskboard guidance and sanitized collaboration patterns.

## Trigger

Use when work persists across conversations, spans multiple employees or people, needs assignment/status/SLA, or requires a durable human approval or offline action. Do not add Taskboard for a single synchronous interaction with no continuing ownership.

## Required design questions

- What event creates the task, and what stable business object does it reference?
- Who may assign, accept, reassign, update, block, reject, and close it?
- What states, transitions, due dates, dependencies, and escalation timers exist?
- Which context belongs in structured task fields versus comments or linked artifacts?
- How are duplicate creation, retries, cancellation, and stale work handled?
- What completion evidence is required, and who verifies it?

## Deliverable impact

Add task lifecycle and handoff sections to team/dataflow design, task IDs to business records where needed, capability selection, Skill actions, promptSpec routing, acceptance cases, and a taskboard design artifact. Record how task activity feeds audit and recovery.

## Identity and permission risks

Task visibility can expose sensitive context. Enforce creator, assignee, watcher, manager, and service-identity scopes. Do not let an employee self-assign privileged work or mark a human approval complete. Scheduled jobs need a bounded service identity. Minimize personal or secret data in titles/comments.

## Exit check

Exit when every state transition has an authorized actor, retry/idempotency rule, timeout/escalation owner, linked evidence, and tests for success, rejection, unauthorized access, duplicate creation, and abandoned work.
