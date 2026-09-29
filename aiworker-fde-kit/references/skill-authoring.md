# Self-contained Skill authoring

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public Skill authoring guidance and sanitized FDE Skill patterns.

## Package contract

Author a Skill as a runtime package another agent can use without the FDE project directory. Include only instructions and resources needed to perform the job. Do not add project notes, meeting history, or customer source files.

Use a lowercase hyphenated package name. Give `SKILL.md` frontmatter only `name` and `description`. Make the description a trigger statement rather than a workflow summary. Write the body in imperative language and route heavy facts to package-local references.

## Required behavior

State:

- accepted triggers and required inputs;
- source of truth for each business object;
- normal workflow and bounded decision rules;
- missing-data questions and assumption policy;
- acting identity, allowed roles, and record scope;
- human review points and prohibited actions;
- idempotency or duplicate handling;
- exception, permission-denied, refusal, and escalation behavior;
- output shape and acceptance evidence.

Use stable field and object IDs from the project manifest. Do not create alternate names that drift from the data schema.

## Self-contained test

Before packaging, inspect every file and link:

- all runtime links resolve inside the Skill package;
- no absolute path, source interview, design document, or FDE-only file is required;
- no credentials, tenant IDs, internal URLs, or real personal/customer data appear;
- examples are fictional or sanitized;
- commands and toolkit keys come from verified catalogs, not memory;
- high-risk actions include explicit human approval and rejection behavior.

Run the package from a clean location with only declared inputs. A successful run that secretly reads the FDE workspace is a failed self-containment test.

## Tool and script discipline

Use scripts only for deterministic repeated work. Keep business values in structured inputs rather than interpolated shell. Validate inputs before side effects, use least privilege, and return explicit errors.

Do not embed production assembly commands in an employee Skill. The FDE package expresses assembly separately. In V1, any repository-rendered CLI write script is generated only by the assembly renderer and requires the live assembly gate before execution.

## Review checklist

- One cohesive responsibility is understandable from the trigger.
- promptSpec routes to the Skill without duplicating its workflow.
- Inputs, outputs, business objects, and permissions match project facts.
- Every toolkit key is necessary and cataloged.
- Normal, incomplete, duplicate, rejected, unauthorized, and failed paths exist.
- External access follows identity and Station guards.
- Artifacts are reviewable and acceptance cases can observe the result.
