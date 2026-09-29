# Rule Contract

Rules are explicit planning directives. They let a user, agent, or adapter guide scheduling without forcing the system to infer every upstream cause.

## Target

A rule target has:

```json
{
  "kind": "requirement",
  "id": "REQ-1"
}
```

Supported target kinds:

- `requirement`
- `item`
- `operation`
- `resource`
- `supply`

## Rule Types

### not-start-until

Blocks a requirement, item, operation, or supply-related target until a timestamp.

Required field:

- `until`

Use this when the user already knows a prerequisite cannot be satisfied before a date.

### not-finish-after

Expresses a latest acceptable finish timestamp.

Required field:

- `after`

### resource-unavailable

Blocks a resource window.

Required fields:

- `target.kind = resource`
- `from`
- `to`

Use this for machine breakdowns, line maintenance, missing fixtures, or other capacity outages.

### lock-operation

Locks a specific operation placement. The current implementation preserves locked operations when they are already present in an imported or baseline plan.

### lock-requirement

Locks all operations for a requirement when a baseline placement should not move.

### avoid-resource

Discourages assigning the target to a resource.

Required field:

- `resourceId`

### prefer-resource

Encourages assigning the target to a resource.

Required field:

- `resourceId`

### priority-boost

Adds a business priority signal.

Required field:

- `priority`

The planner uses the highest of `requirement.priority` and matching `priority-boost.priority` when sorting requirements.

### must-run-before

Adds a sequence preference or constraint relative to another target.

Required field:

- `relatedTarget`

### must-run-after

Adds a sequence preference or constraint relative to another target.

Required field:

- `relatedTarget`

Requirement-level `must-run-before` and `must-run-after` participate in deterministic requirement ordering. Unsupported target combinations remain auditable rules but may not affect scheduling.

### supply-not-available-until

Expresses material or upstream availability delay.

Required field:

- `until`

## Coarse Rules Are Valid

Rules are allowed to be coarse. For example, if a material shortage means `REQ-100` cannot start until next Monday, use:

```json
{
  "id": "RULE-REQ-100-NST",
  "type": "not-start-until",
  "target": {
    "kind": "requirement",
    "id": "REQ-100"
  },
  "until": "2026-04-20T00:00:00.000Z",
  "reason": "Material shortage confirmed by buyer"
}
```

The caller does not need to model purchase orders, supplier commitments, and upstream operations unless those details are useful for the project.

## Rule Lifecycle

Rules can be loaded, listed, enabled, disabled, expired, and removed.

Use `expiresAt` for temporary rules. Disabled or expired rules should remain auditable but should not affect new plans.
