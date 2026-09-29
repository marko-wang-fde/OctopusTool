# octopus-cli evidence and limits

Updated: 2026-07-28
Applicable version: AIWorker FDE Kit 0.1.0; npm package 0.1.2; CLI-reported version 0.1.2
Source: Public CLI output observed locally and sanitized versioned Kit contracts; no profile, Team, or credential data.

## Four evidence layers

1. **Versioned Kit contract** — `catalog/assembly-operations.yaml` plus payload Schemas define approved command path, positional arguments, options, payload shape, contract version, risk, and execution policy. This is the parameter and payload authority.
2. **`octopus-cli --help-json`** — proves only that a command path is present in the installed command tree. It does not expose options, positional arguments, required fields, payload Schema, toolkit keys, or target-Team support.
3. **Leaf `--help`** — human diagnostic evidence for a planned command's visible option shape. Compare it with the versioned contract; do not treat it as a payload Schema.
4. **Global dry-run body probe** — `octopus-cli --dryrun <command> --body-json <marker> --json` proves whether the local execution layer forwards body options before any production write. It does not validate platform business rules.
5. **Live execution evidence** — proves only that the selected API-native payload was submitted through the confirmed Profile and Team and received a platform response. It does not prove manual-required Skill upload, Arcubase provisioning, or broader acceptance.

Never infer options, payloads, or toolkit keys from `--help-json`. Never promote an unregistered write command discovered in help output directly into a delivery.

## Recorded versions

Record package and runtime versions separately:

- installed npm package observed: `@syngy/octopus-cli@0.1.2`;
- CLI self-reported version observed: `0.1.2`.

Do not normalize or assume these values match. A newer or unknown version may be a warning only when leaf help still matches the tested contract; a shape conflict is a blocker.

## Current supported contract paths

The Kit contract currently recognizes live writes for ordinary one-file Team Skill upload, enabling that Skill for assembly, private digital-worker creation, existing employee Skillset binding, and existing employee hire creation. Exact paths, options, output bindings, and payload Schema URIs live only in the assembly operation catalog; do not duplicate them here.

Payload files must be API-native request bodies for the target `octopus-cli`
command. Do not pass FDE wrapper fields such as `schema_version`,
`operation_id`, `skill_set`, `skill_refs`, `worker`, `worker_ref`, or
`skill_set_refs` to live CLI writes.

Important API and CLI constraints:

- `configure skill upload add` is the supported ordinary Skill upload path for
  the current catalog. It sends JSON body `{ "slug": "...", "content": "..." }`
  to `POST /api/v1/teams/{teamId}/skills/upload` and returns a real `skill.id`.
  It uploads one `SKILL.md` markdown body, not a multi-file package.
- `configure skill enable-assembly add <id>` is supported only when `<id>` is a
  real platform Skill ID from `skill.upload` or recorded evidence. The renderer
  must provide this positional argument from an output binding. The response
  carries the public `skillsetId` used for employee binding.
- `configure employee skillsets set <digi-employee-id>` is supported for binding
  public Team Skillsets to an existing employee using API-native payload
  `{ "skillsets": [{ "id": "..." }] }`.
- `configure skill set add` is manual-required in catalog `1.0.4` for
  `octopus-cli` 0.1.2. The command path exists and its leaf help advertises
  body options, but global dry-run execution probes show body/query options are
  dropped for this path. Do not auto-run it until a future tested catalog
  revision restores support.
- `configure skill package-upload add` is manual-required for this catalog. The
  backend endpoint requires multipart/form-data (`file`, `slug`, optional
  `replace`), while the current generic `octopus-cli` execution layer sends JSON
  from `--body-file`/`--body-json`; dry-run body echo alone is not enough to
  prove live package upload compatibility.
- `configure team private-digiworkers add` accepts top-level worker fields such
  as `name`, `bio`, `promptSpec`, `quickStartPrompts`, `homeMode`,
  `llmModelId`, `thinkingConfig`, `toolkitKeys`, and optional real platform
  `teamSkillIds`. The backend requires `promptSpec` to be API-native
  `{"type":"static","text":"..."}` or `{"type":"script","script":"..."}`;
  sectioned FDE objects such as `{role, objective, boundaries}` are authoring
  artifacts and will be rejected by live API validation. `thinkingConfig` uses
  `effort`, not `reasoningEffort`. The command creates both the private worker
  and its Team employee.
- `configure employee hire` accepts only a real platform `digiWorkerId`. Do not
  append it after `team-private-digiworker.create`.

For each planned supported operation, require contract mapping, API-native payload Schema validation, command existence from help JSON, leaf-help compatibility, dry-run body-probe forwarding when the local CLI supports it, and renderer-generated live invocation.

## Current manual-required limits

Current evidence supports one-file ordinary Skill markdown upload plus enable-assembly. It does not support multipart ordinary Skill package upload or direct Skillset creation through this CLI contract. WebSkill publishing is a different capability and does not prove ordinary Skill upload.

Current evidence also does not support creating a new Arcubase app or table. Read/query or employee Arcubase commands do not prove administrative creation. Keep multipart Skill package upload, direct Skill-set creation, Arcubase app creation, and Arcubase table creation `admin-manual/manual-required` with artifacts, instructions, recovery, and verification. Do not invent `skill deploy`, `schema apply`, `policy apply`, `arcubase app create`, or equivalent commands.

## Failure handling

- CLI missing: report a blocker for CLI evidence, provide administrator-approved installation/version-check instructions, and do not auto-install.
- Help JSON missing or invalid: preserve diagnostic evidence and do not generate CLI operations.
- Contract path missing: downgrade to a confirmed manual route; otherwise block.
- Unregistered write path found: warn and wait for a tested Kit contract update.
- Leaf help conflicts with contract: block rendering.
- No valid profile or explicit Team: skip live assembly and remain eligible only for offline delivery readiness.
- Live execution failure: preserve the platform requestId, mapped error, command path, and sanitized payload path. Do not retry with edited payloads unless the project is revalidated and the live assembly gate is repeated.

Only the fixed renderer may create Bash, and every CLI write must use the fixed `run_octopus_assemble` wrapper. V1 executes production writes only after the live assembly gate and only for catalog-supported API-native payloads.
