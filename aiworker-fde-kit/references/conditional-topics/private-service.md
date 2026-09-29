# Conditional topic: Private Service

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public integration guidance and sanitized private-service design patterns.

## Trigger

Use when a worker must call a customer-private API, internal network service, private model, database facade, or other nonpublic integration. Do not assume connectivity or credentials from a service name.

## Required design questions

- What business operation and data contract are required?
- Who owns the service, endpoint lifecycle, sandbox, SLA, and incident response?
- What network route, authentication, secret store, and identity delegation are approved?
- Which methods are read/write, idempotent, reversible, rate-limited, or high-impact?
- What data classification, residency, logging, retention, timeout, retry, and circuit-breaker rules apply?
- What mock or contract fixture supports offline validation?

## Deliverable impact

Add a sanitized interface contract, capability/integration dependency, identity mapping, network and secret prerequisites, error taxonomy, retry/idempotency behavior, observability, administrator setup steps, offline fixture, and acceptance cases. V1 has no dedicated template or validator, so selection always requires a `WARNING` and specialist follow-up; do not claim full specialized coverage. Never place private endpoints or credentials in the public Kit.

## Identity and permission risks

Use a managed secret reference, not embedded credentials. Propagate only the required caller identity and scope. Prevent confused-deputy and cross-tenant access, redact logs, constrain egress, and require human confirmation for irreversible or externally binding writes.

## Exit check

Exit when ownership and authorization are confirmed, secrets stay out of artifacts, network and data boundaries are explicit, contract fixtures validate offline, retry/idempotency and rollback are defined, and unauthorized, timeout, partial-write, and redaction tests pass.
