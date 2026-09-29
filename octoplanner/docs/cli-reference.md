# Octoplanner CLI Reference

All commands emit JSON by default. Mutating commands write audit logs and return `auditId`.

## Runtime

The npm package is Bun-first. After installing the package, run:

```bash
octoplanner --version
```

From the source repository, run:

```bash
npm run octoplanner -- --version
```

## workspace

- `workspace init`: create `.octoplanner/workspace.db`.
- `workspace status`: show schema version and object counts.
- `workspace config`: show default config.
- `workspace doctor`: validate workspace schema.

## schema

- `schema list`: list schema names.
- `schema show --name <schema>`: show schema internals.
- `schema check --name <schema> --file <json>`: validate a JSON file.
- `schema example --name <schema>`: print an example JSON object.

## model

- `model requirement load|list|show|validate|summary`
- `model item load|list|show|validate`
- `model routing load|list|show|validate|coverage`
- `model resource load|list|show|validate|timeline`
- `model supply load|list|show|validate|availability`

`load` and `validate` require `--file <json>`. `show` requires `--id <id>`.

## rule

- `rule add --type <type> --target <kind:id> [fields]`
- `rule load --file <json>`
- `rule list [--all]`
- `rule show --id <id>`
- `rule remove --id <id>`
- `rule enable --id <id>`
- `rule disable --id <id>`
- `rule expire --id <id> --at <iso-datetime>`
- `rule validate --id <id>` or `rule validate --file <json>`

Supported rule types:

- `not-start-until`
- `not-finish-after`
- `resource-unavailable`
- `lock-operation`
- `lock-requirement`
- `avoid-resource`
- `prefer-resource`
- `priority-boost`
- `must-run-before`
- `must-run-after`
- `supply-not-available-until`

## case

- `case create --name <name>`
- `case list`
- `case show --case <name-or-id>`
- `case validate --case <name-or-id>`
- `case summary --case <name-or-id>`
- `case export --case <name-or-id> [--out <file>]`

## plan

- `plan create --case <case> --name <name>`
- `plan load --file <json> [--name <name>]`
- `plan list [--all]`
- `plan show --plan <name-or-id>`
- `plan summary --plan <name-or-id>`
- `plan timeline --plan <name-or-id>`
- `plan metrics --plan <name-or-id>`
- `plan export --plan <name-or-id> [--out <file>]`
- `plan compare --left <plan> --right <plan>`
- `plan revise --from-plan <plan> --name <name> [--rules <rules.json>] [--revision <revision.json>]`
- `plan diff --from <plan> --to <plan> [--out <file>]`
- `plan archive --plan <name-or-id>`

## impact

- `impact analyze --plan <plan> [--rule <rule-id|latest>]`
- `impact trace --plan <plan> --target <kind:id>`

## scenario

- `scenario create --from-plan <plan> --name <name>`
- `scenario list`
- `scenario show --scenario <name-or-id>`
- `scenario simulate --scenario <name-or-id> --mode repair|optimize`
- `scenario compare --scenario <name-or-id>`
- `scenario commit --scenario <name-or-id> --as-plan <name>`
- `scenario discard --scenario <name-or-id>`

## explain

- `explain plan --plan <plan>`
- `explain requirement --plan <plan> --id <requirement-id>`
- `explain order --plan <plan> --id <requirement-id>`
- `explain operation --plan <plan> --id <operation-id>`
- `explain resource --plan <plan> --id <resource-id>`
- `explain rule --id <rule-id>`
- `explain scenario --scenario <scenario>`

## audit

- `audit log [--limit <n>]`
- `audit show --id <audit-id>`

## report

`report` is read-only. It can export localized HTML reports and serve a local interactive report website.

- `report output --format html [--lang zh-CN|en-US] --plan <plan> plan-overview [--out <file>]`
- `report output --format html [--lang zh-CN|en-US] --plan <plan> resource-timeline [--out <file>]`
- `report output --format html [--lang zh-CN|en-US] --plan <plan> requirement-trace [--out <file>]`
- `report output --format html [--lang zh-CN|en-US] --plan <plan> exception-review [--out <file>]`
- `report output --format html [--lang zh-CN|en-US] --plan <plan> rule-impact [--out <file>]`
- `report output --format html [--lang zh-CN|en-US] --diff <diff.json> plan-diff [--out <file>]`
- `report output --format html [--lang zh-CN|en-US] --scenario <scenario> scenario-compare [--out <file>]`
- `report serve [--lang zh-CN|en-US] [--host 127.0.0.1] [--port 0]`

Supported languages:

- `zh-CN` default
- `en-US`

When running from source, build the website first:

```bash
npm run build:report-web
```
