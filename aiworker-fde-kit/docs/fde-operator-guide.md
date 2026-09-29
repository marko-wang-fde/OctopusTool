# FDE Operator Guide

The Kit guides an FDE engineer from a confirmed enterprise scenario to a
complete, validated offline AIWorker delivery package. It favors one digital
employee, one self-contained Skill, and one table until evidence requires
more.

## Start with the project creation gate

Before writing, present and confirm all four values:

1. project display name;
2. lowercase ASCII directory slug;
3. absolute target path;
4. entry mode: `new`, `materials`, or `resume`.

`scripts/init-project` previews these values without writing. Repeat it with
`--confirm` only after the user approves them. Existing directories are never
overwritten; choose resume, a different slug, or cancel.

## Operate the seven stages

Work in this fixed order: `initialize`, `discover`, `team-design`,
`foundation-design`, `author`, `assemble`, `validate`. Keep facts,
assumptions, conflicts, inputs, outputs, issues, and status in
`fde-project.yaml`. Load conditional topics only when triggered.

Five human gates prevent silent scope changes:

1. project creation;
2. requirements baseline;
3. solution baseline;
4. delivery readiness;
5. live assembly, only when direct `octopus-cli` execution is requested.

Use `scripts/validate-project` throughout. Stage acceptance records a reviewed
snapshot; editing a dependency makes downstream stages stale.

## Assemble with explicit live authorization

Inspect a known fixture or an explicitly selected `octopus-cli` binary before
rendering. Catalog support and current CLI evidence are separate facts.
Unknown payloads, toolkit keys, target Teams, Profiles, or permissions are
blockers.

The renderer creates the only allowed Bash script:
`assembly/octopus-cli-assemble.sh`. It calls `octopus-cli` directly through a
fixed wrapper and does not add `--dryrun` because this script is for gated live
assembly. Use `inspect-octopus-cli` for non-writing command-contract checks; it
may use global `octopus-cli --dryrun` body probes to prove the local CLI forwards
request bodies before production assembly.
Run live assembly only after the user confirms Profile, Team, package hash,
supported operations, and manual-required gaps. Fixture inspection can support
package validation but never produces `cli-assembled`.

## Deliver the offline package

After the first six stages are accepted:

```bash
./scripts/validate-project /absolute/project
./scripts/package-delivery /absolute/project --confirm-personal-data
```

Packaging repeats the safety scan, creates a deterministic ZIP, verifies its
manifest, closes `validate`, and reports `delivery-ready`. Present validation
scope, remaining warnings, manual administrator steps, inventory, versions,
and assembly status at the delivery readiness gate.

For supported catalog operations, direct assembly is:

```bash
./scripts/render-assemble-script /absolute/project
./scripts/validate-project /absolute/project --run-assembly --profile <name> --team <id>
```

Before running live assembly, verify every supported payload is the
API-native body for its `octopus-cli` command. Do not pass FDE logical wrapper
fields to the platform. If a payload needs uploaded Skill IDs, worker IDs, or
other platform-returned identifiers, complete the manual step, update the
payload with the real IDs, repackage, revalidate, and repeat the live assembly
gate.

V1 still does not auto-login, select a Team, create unsupported Arcubase
resources, upload unsupported Skills, create or bind Skill sets through
`octopus-cli` 0.1.2, or publish an External Station.
