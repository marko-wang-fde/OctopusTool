# Examples

The npm package includes example JSON files under `examples/`.

## Minimal Planning Flow

Files:

- `examples/minimal/requirements.json`
- `examples/minimal/items.json`
- `examples/minimal/routings.json`
- `examples/minimal/resources.json`
- `examples/minimal/supplies.json`

Commands:

```bash
octoplanner workspace init
octoplanner model requirement load --file examples/minimal/requirements.json
octoplanner model item load --file examples/minimal/items.json
octoplanner model routing load --file examples/minimal/routings.json
octoplanner model resource load --file examples/minimal/resources.json
octoplanner model supply load --file examples/minimal/supplies.json
octoplanner case create --name minimal
octoplanner case validate --case minimal
octoplanner plan create --case minimal --name minimal-plan
octoplanner plan summary --plan minimal-plan
```

## Reschedule Flow

Files:

- `examples/reschedule/requirements.json`
- `examples/reschedule/items.json`
- `examples/reschedule/routings.json`
- `examples/reschedule/resources.json`
- `examples/reschedule/rules.json`

Commands:

```bash
octoplanner workspace init
octoplanner model requirement load --file examples/reschedule/requirements.json
octoplanner model item load --file examples/reschedule/items.json
octoplanner model routing load --file examples/reschedule/routings.json
octoplanner model resource load --file examples/reschedule/resources.json
octoplanner rule load --file examples/reschedule/rules.json
octoplanner case create --name reschedule
octoplanner plan create --case reschedule --name baseline
octoplanner impact analyze --plan baseline --rule latest
octoplanner scenario create --from-plan baseline --name repair
octoplanner scenario simulate --scenario repair --mode repair
octoplanner scenario compare --scenario repair
```

## Schema Convention

The JSON Schema assets describe one object. Model load files use arrays of those objects.

For example, `schemas/requirement.schema.json` describes a single requirement, while `examples/minimal/requirements.json` contains an array of requirements.
