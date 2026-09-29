# Installation

This repository installs the `design-aiworker-solutions` Skill for Codex,
Claude Code, or both. Installation is local only; it never logs in to the
AIWorker platform and never changes a production Team.

## Supported platforms and prerequisites

V1 supports macOS and Linux with Node.js 20, Git, POSIX `/bin/sh`, and
`/bin/bash`. Run installation from a trusted local checkout. Other operating
systems and compatibility layers are not part of the V1 release contract.

## Install from a trusted checkout

Run from the repository root:

```bash
./scripts/install --target codex --mode symlink
./scripts/install --target claude-code --mode symlink
./scripts/install --target both --mode copy
```

`symlink` is the default and follows the checked-out source. `copy` creates a
self-contained snapshot that includes the bundled runtime. Targets are:

- Codex: `${HOME}/.agents/skills/design-aiworker-solutions`
- Claude Code: `${HOME}/.claude/skills/design-aiworker-solutions`

Installation manifests are stored below
`${XDG_CONFIG_HOME:-$HOME/.config}/aiworker-fde-kit/installations`.

For a `copy` install, its manifest is the local trust root for ownership,
updates, replacement, and conflict detection. Protect the manifest together
with the copied Skill snapshot: do not hand-edit, delete, share, or regenerate
it merely to bypass an ownership failure. If it is lost or damaged, treat the
target as untrusted and review it before any explicit replacement.

## Update and conflicts

Pull or check out the trusted release yourself; the installer never runs
`git pull`.

```bash
./scripts/install --target both --mode copy --update
```

An unchanged install is idempotent. `--update` requires an install previously
owned by this Kit. A foreign, modified, malformed, or conflicting target is
blocked. Review it before using `--replace`; replacement is explicit and
transactional. Failed operations either restore the owned state or report a
quarantine path for manual recovery.

## Uninstall

There is no destructive uninstall command in V1. First compare the target and
its installation manifest with `./scripts/install --target …` output. Remove
only the exact owned Skill target and corresponding manifest after preserving
any reported quarantine. Never recursively remove a general skills directory.

To switch between `copy` and `symlink`, perform the same ownership check, then
use `--replace` with the desired mode.
