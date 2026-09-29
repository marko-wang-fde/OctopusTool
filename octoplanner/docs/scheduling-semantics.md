# Scheduling Semantics

`octoplanner` uses deterministic local scheduling. It is designed to produce explainable plans for agents and operators, not to hide business judgment inside an opaque optimizer.

## Ordering

Requirements are ordered by:

1. higher effective priority, including `priority-boost`
2. requirement-level `must-run-before` / `must-run-after`
3. baseline order when repairing from an existing plan
4. earlier `dueAt`
5. stable `id`

This makes repeated runs predictable when the same model and rules are used.

## Operation Expansion

Each requirement is expanded through the routing for its `itemId`.

If routing or operation duration is missing, the planner records an unplanned operation with a reason instead of guessing silently.

## Precedence

Routing operation `sequence` defines operation order. Later operations cannot start before earlier operations complete.

`minLagMinutes` and `maxLagMinutes` are model signals. The current deterministic scheduler focuses on simple precedence and reports unsupported semantics through `notModeled` where needed.

## Resources

Operations can specify eligible resources directly or through a resource group. The scheduler assigns operations to available resources and advances resource cursors over time.

`resource-unavailable` rules and resource `unavailableWindows` block scheduling windows.

## Rules

Rules are applied as explicit planning controls. They are not hidden assumptions. A plan records applied rule ids so users and agents can explain why a result changed.

Examples:

- `not-start-until` delays a target until a known timestamp
- `resource-unavailable` removes capacity for a window
- lock rules preserve accepted baseline placements when applicable

## Not Modeled

Successful output can still include `notModeled`.

This is intentional. It tells the agent that the plan was produced while some business nuance was not represented numerically or structurally.

Examples:

- exact setup changeover costs
- detailed shift calendars
- multi-capacity batching physics
- preferred but not required process continuity
- external procurement negotiation

Agents should surface `notModeled` instead of treating the plan as a complete truth model.

## Replanning

When a shortage or upstream failure invalidates part of a plan:

1. load the current schedule as a baseline plan
2. add a revision or rules that represent the changed condition
3. run `plan revise --from-plan <baseline>`
4. run `plan diff --from <baseline> --to <new-plan>`
5. let the agent use the diff and `externalRef` to update downstream artifacts

If no baseline plan is provided, `plan create` performs full scheduling from the current case. If a baseline plan is provided, `plan revise` performs deterministic repair scheduling and preserves locked or unaffected baseline placements where possible.

This keeps human judgment explicit while still allowing broad deterministic rescheduling.
