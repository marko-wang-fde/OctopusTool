# Urgent Insertion Revision Example

This example models a machining schedule revision where order `601277344` is inserted urgently on `RES-SS-05`.

The baseline plan is an imported schedule snapshot. The revision boosts `REQ-601277344` and keeps the rest of the resource queue in baseline order as a best-effort policy.

```bash
octoplanner workspace init
octoplanner model requirement load --file examples/revision-urgent-insert/requirements.json
octoplanner model item load --file examples/revision-urgent-insert/items.json
octoplanner model routing load --file examples/revision-urgent-insert/routings.json
octoplanner model resource load --file examples/revision-urgent-insert/resources.json
octoplanner case create --name urgent-case
octoplanner plan load --file examples/revision-urgent-insert/baseline-plan.json --name urgent-baseline
octoplanner plan revise --from-plan urgent-baseline --name urgent-after-601277344 --revision examples/revision-urgent-insert/revision.json
octoplanner plan diff --from urgent-baseline --to urgent-after-601277344 --out diff.json
octoplanner report output --format html --diff diff.json plan-diff --out diff.html
```
