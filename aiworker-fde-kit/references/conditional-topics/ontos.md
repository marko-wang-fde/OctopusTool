# Conditional topic: Ontos

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public ontology guidance and sanitized semantic-model design patterns.

## Trigger

Use when the scenario needs shared semantics across multiple business objects, relationship traversal, impact analysis, or ontology-backed simulation. Do not add Ontos when one table or explicit links answer the workflow.

## Required design questions

- Which decisions require semantic relationships rather than ordinary data links?
- What entities, relations, identifiers, provenance, and temporal rules are authoritative?
- Which source systems populate each concept, and how are conflicts resolved?
- Is use read-only, or does the project request ontology authoring/administration?
- What freshness, versioning, publication, rollback, and incomplete-graph behavior applies?
- What query/result demonstrates business value?

## Deliverable impact

Add an ontology scope, concept/relation mapping, source provenance, capability choice, worker/Skill query behavior, dataflow, version dependency, fallback, and acceptance cases. V1 has no dedicated template or validator, so selection always requires a `WARNING` and specialist follow-up; do not claim full specialized coverage.

## Identity and permission risks

Graph traversal can reveal relationships a user cannot see in source systems. Preserve source-system authorization, filter nodes/edges by acting identity, separate read use from ontology administration, and require explicit administrator ownership for publish/rebuild actions.

## Exit check

Exit when every concept and relation has an owner and source, read/admin permissions are separate, freshness and fallback are defined, hidden relationships remain hidden, and acceptance proves a necessary query plus unauthorized and incomplete-data behavior.
