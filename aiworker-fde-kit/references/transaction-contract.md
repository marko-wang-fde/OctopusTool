# Project transaction contract

Updated: 2026-07-24
Applicable version: AIWorker FDE Kit 0.1.0
Source: Public portable Node.js filesystem semantics and sanitized Kit transaction tests.

## Contents

- [V1 concurrency model](#v1-concurrency-model)
- [Explicit non-guarantees](#explicit-non-guarantees)
- [Recovery](#recovery)

## V1 concurrency model

The portable Node.js implementation uses a **cooperative transaction marker**.
Writers create the external sibling marker
`.PROJECT.fde-project.yaml.transaction.lock` before publishing, and Kit readers
return `B_PROJECT_TRANSACTION_LOCKED` while that marker is present. Initialization
may therefore expose a partially assembled project directory, but cooperating
Kit commands do not consume it.

V1 provides these filesystem guarantees:

- the final project directory is claimed with one non-recursive `mkdir`, so an
  existing final target is never replaced;
- every published leaf is created with `O_EXCL | O_NOFOLLOW`, so an existing
  leaf is never overwritten;
- initialization records the device and inode of the final root and every
  created child directory;
- the complete ancestor chain is checked for non-symlink type and matching
  identity before and after each leaf write;
- final inventory and content validation rechecks every recorded directory and
  reads each leaf only after validating its complete ancestor chain;
- observed ownership or content changes fail closed and retain the partial
  target and transaction marker for recovery;
- once inventory and content validation completes, the project is committed.
  A later marker-cleanup failure is reported as
  `W_INITIALIZATION_CLEANUP_DEFERRED` and does not downgrade the committed
  project to failure.

Stage acceptance uses the same cooperative writer marker. Validation records
the exact manifest and current-stage authoritative file snapshots, including
bytes, hash, type, mode, device, inode, and every directory ancestor identity.
The snapshot also binds the active authoritative patterns and their canonical,
sorted resolved path set, so additions, removals, renames, type changes, and
symlink substitutions in glob-backed artifact sets are drift. After all report
and manifest bytes and temporary files are prepared, but before any target is
published, the transaction reopens the validation-time files with no-follow
semantics, resolves membership again, and requires both snapshots to match. It
also records the project root and report-directory ancestor chains and checks
them around temporary-file creation, reads, links, renames, and cleanup.
Observable drift fails with `E_VALIDATION_SNAPSHOT_DRIFT` or a report
transaction blocker; no stale acceptance is published.

`inspect-octopus-cli` uses its own external sibling cooperative marker before
reading or changing the requested evidence output. It writes every evidence and
diagnostic file into a same-filesystem sibling staging directory. Staging is
fully validated, then claimed and revalidated before a
single same-filesystem directory rename publishes it. Readers that honor the
marker therefore see either the prior complete evidence directory or the new
complete evidence directory, never a per-file partial publication.

For an update, the inspector binds the prior output root identity, ownership
marker, modes, paths, and hashes. It atomically claims the live output into a
unique backup path and validates the claimed tree before publishing staging. If
the staging rename fails and no foreign live output has appeared, it atomically
rolls the validated backup back to the output path. A foreign or concurrently
replaced staging, output, backup, or lock marker is retained and reported in
`recovery_paths`/`foreign_paths`; it is never removed by pathname. Validated
backups and isolated lock markers may also be deliberately retained rather than
deleted, because portable Node.js cannot make a pathname check plus deletion
one indivisible operation.

## Explicit non-guarantees

This is not kernel-level directory-fd isolation. Portable Node.js does not give
this implementation an `openat`/`unlinkat` transaction rooted in a held
directory descriptor. Initialization and project-report transactions do not
claim atomic visibility for their complete multi-file trees. The CLI inspector
claims atomic visibility only for the one validated evidence directory rename;
its marker, old-output claim, publication, optional rollback, and recovery
retention are multiple cooperative filesystem operations rather than one
kernel transaction.

An uncooperative process running as the same operating-system user can mutate
path ancestors in the single window after one filesystem syscall returns and
before the next syscall begins. Such tampering is outside the cooperative
transaction guarantee. The repeated identity checks detect injected or
observable replacements at the surrounding boundaries, but they are not a
claim that pathname traversal has become an atomic kernel transaction.

An uncooperative process can also create or replace the inspector output in the
gap between its last observation and directory rename. This is outside the
cooperative model. Observable conflicts fail closed and retain evidence; the
inspector does not claim `renameat2(RENAME_NOREPLACE)` or directory-fd
isolation on platforms where portable Node.js does not expose them.

The initializer's hard guarantees remain narrow: `mkdir` atomically refuses an
existing final target, and `O_EXCL` atomically refuses an existing leaf. Do not
describe the V1 initializer as an atomic directory rename or as directory-fd
sandboxing. The inspector's separately documented same-filesystem rename
guarantee does not broaden those initializer guarantees.

## Recovery

Before commit, publication failure returns a nonzero result and reports both
the live partial target and marker in `recovery_paths`; cleanup never recursively
deletes that target. After commit, marker cleanup failure returns exit `0`,
`initialized: true`, the marker path, and the cleanup warning. An operator must
inspect retained paths and remove a stale marker only after confirming no writer
is active.
