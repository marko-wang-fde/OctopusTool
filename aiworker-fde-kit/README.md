# AIWorker FDE Kit

AIWorker FDE Kit guides an FDE engineer from confirmed requirements to a
validated offline delivery package for an AIWorker digital employee or team.
After explicit confirmation of the target Profile, Team, and package hash, V1
can directly assemble catalog-supported operations through `octopus-cli`.
Unsupported Skill upload, Arcubase, and platform actions stay manual-required.

## Requirements

- Node.js 20
- macOS or Linux
- POSIX `/bin/sh`, `/bin/bash`, and Git

## Install the Skill

Install from a trusted checkout:

```bash
./scripts/install --target codex --mode symlink
./scripts/install --target claude-code --mode symlink
./scripts/install --target both --mode copy
```

Codex supports both `symlink` and `copy` installation. Claude Code also
supports both `symlink` and `copy` installation. A symlink follows the
checkout; a copy is a self-contained snapshot.

For copy installs, the installation manifest is the local trust root used to
establish ownership and authorize updates or replacement. Protect it together
with the installed snapshot; do not edit, discard, or regenerate it casually.
See [Installation](docs/installation.md) for update and conflict handling.

## Start a project

Choose one entry mode: `new` for requirements from the conversation,
`materials` for selected source files, or `resume` for an existing FDE
project. Before any write, preview the project display name, lowercase ASCII
directory slug, absolute target directory, and entry mode, then confirm all
four.

Work through the seven stages described in the
[Operator guide](docs/fde-operator-guide.md). The four derived project states
are:

- `draft`: the first three stages are incomplete or blocked.
- `reviewable`: the first three stages are complete, but later work or
  blockers remain.
- `delivery-ready`: all stages and deterministic package checks pass.
- `cli-assembled`: delivery-ready plus separately authorized live
  `octopus-cli` assembly for every supported operation.

The shortest delivery flow is:

```bash
./scripts/validate-project /absolute/project
./scripts/package-delivery /absolute/project --confirm-personal-data
```

Live assembly uses:

```bash
./scripts/render-assemble-script /absolute/project
./scripts/validate-project /absolute/project --run-assembly --profile <name> --team <id>
```

## Verify the Kit

```bash
npm ci
npm run verify
./scripts/test-example --example lead-collector
npm run verify:public
npm run verify:e2e
./scripts/validate-forward-test evals/results
```

The Golden example and end-to-end suite prove the deterministic package
boundary. Forward evidence separately evaluates fresh Agent behavior; it does
not replace or imply that package proof. Forward validator exit `0` checks
retained structure, candidate Git/tree-hash binding, and execution-declaration
consistency. It does not prove Agent identity, independent sessions, network
isolation, or production-write isolation; maintainers witness those process
controls. See the
[Agent forward test](docs/agent-forward-test.md) procedure before recording
forward evidence. Maintainers should read the
[Maintainer guide](docs/maintenance.md). This project is distributed under
the [License](LICENSE).
