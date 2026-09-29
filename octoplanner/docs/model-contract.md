# Model Contract

`octoplanner` models scheduling inputs as a small set of planning concepts. The model is intentionally product-led: adapters convert external data into these concepts before loading them.

## Requirement

A `requirement` is demand to be scheduled.

Required fields:

- `id`
- `itemId`
- `quantity`

Common optional fields:

- `dueAt`
- `priority`
- `customer`
- `vehicleModel`
- `attributes`
- `externalRef`

`priority` is an input signal used by the planner. Higher priority is scheduled before lower priority when other ordering signals are equal.

## Item

An `item` is the product or part being produced.

Required fields:

- `id`
- `name`

Optional fields capture planning traits:

- `materialId`
- `materialShape`
- `materialGrade`
- `processFamily`
- `setupGroup`
- `attributes`
- `externalRef`

Material and setup fields are optional because not every project has reliable material or tooling data. When provided, they can support rules, explanations, and future optimization metrics.

## Routing

A `routing` defines how an item is produced.

Required fields:

- `itemId`
- `operations`

Each routing operation requires:

- `id`
- `sequence`
- `name`

Common optional fields:

- `durationMinutes`
- `eligibleResourceIds`
- `resourceGroupId`
- `setupGroup`
- `materialShape`
- `minLagMinutes`
- `maxLagMinutes`
- `continuity`

`continuity` can be `required`, `preferred`, or `none`. It represents process continuity requirements without forcing every adapter to model every physical process detail.

## Resource

A `resource` is a schedulable capacity unit such as a machine, line, cell, work center, or external capacity bucket.

Required fields:

- `id`
- `name`

Optional fields:

- `groupId`
- `capacity`
- `unavailableWindows`
- `attributes`

If exact shifts or calendars are unavailable, callers can omit them and use coarse `resource-unavailable` rules for known outages.

## Supply

A `supply` record describes material or upstream availability.

Required fields:

- `id`

Optional fields:

- `itemId`
- `materialId`
- `quantity`
- `availableAt`
- `shortageQty`
- `supplyMode`
- `ownerDepartment`
- `ownerPerson`
- `externalRef`

Supply records are allowed to be coarse. If a shortage is already known to block a requirement, callers may use a `not-start-until` rule directly instead of modeling every supply dependency.

## References

The core references are:

- `requirement.itemId` points to `item.id`
- `routing.itemId` points to `item.id`
- `routing.operations[].eligibleResourceIds[]` points to `resource.id`
- `supply.itemId` points to `item.id` when supply is item-specific

`case validate` fastfails when required planning references are missing. `case summary` may still report `notModeled` signals for incomplete optional data.

## Baseline Plan References

When an adapter imports an existing schedule, it should create a `plan` with `scheduledOperations`.

Each scheduled operation can carry `externalRef`:

```json
{
  "operationId": "REQ-601275458:OP-930002",
  "requirementId": "REQ-601275458",
  "resourceId": "RES-SS-05",
  "startAt": "2026-06-11T00:00:00.000Z",
  "endAt": "2026-06-20T00:00:00.000Z",
  "externalRef": {
    "system": "xlsx",
    "id": "段友!6"
  }
}
```

`externalRef` lets the agent map `plan diff` rows back to the original workbook, ERP record, or execution system. `octoplanner` stores and returns the reference, but does not parse or write those external systems.

## Batch Loading

Model load commands accept arrays of model objects. JSON Schema files in the published package describe one object; array files should contain arrays of those objects unless a command explicitly documents a batch wrapper.
