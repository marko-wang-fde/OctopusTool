# Conditional topic: Browser and WebSkill

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public browser/WebSkill guidance and sanitized automation patterns.

## Trigger

Use for browser interaction with a real website, login-bound page state, downloads/uploads, or a hosted WebSkill user experience. Distinguish browser automation from public page fetch and distinguish WebSkill publishing from ordinary employee Skill package upload.

## Required design questions

- Is an API or public fetch sufficient, or is an interactive browser truly required?
- Which domains, pages, fields, files, and actions are in scope?
- Who supplies and owns authentication, MFA, CAPTCHA, consent, and session recovery?
- Which actions are read-only, reversible, high-impact, or externally visible?
- What page state proves success, and how are layout drift and partial completion detected?
- For WebSkill, who can access it, what data crosses its boundary, and who operates it?

## Deliverable impact

Add domain/action allowlists, session and takeover behavior, file handling, screenshots or page-state evidence, failure recovery, capability/Skill design, privacy notes, and acceptance cases. Add a WebSkill package and publishing handoff only when that product is explicitly selected.

## Identity and permission risks

Never bypass access controls, CAPTCHA, MFA, robots policy, or site terms. Do not store credentials or cookies in the delivery. Constrain downloads and uploads, prevent cross-tenant sessions, require human confirmation before submissions or external commitments, and separate a WebSkill visitor identity from internal employee authority.

## Exit check

Exit when domains/actions are bounded, authentication remains user/admin managed, human takeover exists, destructive or external actions are gated, evidence detects partial failure, data retention is defined, and unauthorized/cross-session cases pass.
