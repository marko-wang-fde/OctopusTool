# Agent Forward Test

Forward tests are release evidence about Agent behavior. They are not unit
tests, do not invoke a model during validation, and do not prove that the Kit
can deterministically build a correct offline package. The Golden example and
end-to-end suite own that package proof.

The repository intentionally contains no completed forward evidence in the
candidate commit. Two fresh Agents must produce it after that commit. Never
copy the examples below into `evals/evidence` or hand-fill a passing result.

## Candidate and evidence sequence

1. Start from the clean candidate commit supplied by the maintainer. Record
   its full 40-character commit as `candidate_commit`.
2. Confirm `git status --porcelain=v1 --untracked-files=all` is empty.
3. Run the `baseline` track in a fresh isolated session. It must not install,
   read, or receive this Skill.
4. Run the `with-skill` track in a different fresh isolated session. Install
   the candidate with `./scripts/install --target codex --mode copy` (or
   `claude-code`) and retain only the redacted receipt summary defined below.
5. Give each session only the six unchanged inputs from
   `evals/forward-test-cases.yaml` and its own repository-relative evidence
   root. Disable network access and production writes. Do not use a real CLI,
   Profile, Team, credential, customer data, or production service.
6. Write the exact artifact tree below, review it for redaction, and commit
   only `evals/evidence/**` and `evals/results/**`.
7. With a clean worktree, run
   `./scripts/validate-forward-test evals/results`.

The evidence commit must descend from `candidate_commit`. From the candidate
to current `HEAD`, every changed path must be below `evals/evidence/` or
`evals/results/`. A product, test, contract, runtime, or documentation change
makes the evidence stale and requires a new candidate plus two new sessions.

Fresh-session identity and execution isolation are maintainer-witnessed process
requirements. The offline validator has no external trust root and cannot
prove which Agent ran, that two sessions were independent, or that network and
production access were actually disabled. Do not add self-signed nonces or
same-repository attestations: they would only restate an untrusted claim.

## Exact tree

`evals/evidence/` contains exactly `baseline/` and `with-skill/`. Each track
contains exactly one directory for each configured case. Each case directory
contains exactly:

```text
agent-output.yaml
artifact-manifest.json
```

`with-skill/` additionally contains exactly `install-receipt.yaml`.
`evals/results/` contains exactly:

```text
v0.1.0-baseline.md
v0.1.0-with-skill.md
```

All roots, directories, and files must be repository-relative regular entries;
symlinks, missing roots, extra files, traversal, and machine absolute paths are
blockers.

## Closed report schema

Each result file is Markdown whose YAML frontmatter has exactly these keys:

```yaml
schema_version: 2
track: baseline # baseline | with-skill; must match filename
candidate_commit: <40 lowercase hex>
candidate_dirty: false
cases_sha256: <sha256 of exact evals/forward-test-cases.yaml bytes>
agent: <redacted agent label>
model: <redacted model label>
session_id: <unique redacted safe id>
run_id: <unique redacted safe id>
executed_at: <ISO 8601 timestamp with milliseconds>
evidence_root: evals/evidence/baseline
install_receipt: null
network_used: false # execution declaration
production_writes: false # execution declaration
cases:
  - id: minimal-lead-collector
    input_sha256: <configured input_sha256>
    evidence_path: evals/evidence/baseline/minimal-lead-collector
    outcome: observed
```

For `with-skill`, use `evidence_root: evals/evidence/with-skill`,
`install_receipt: evals/evidence/with-skill/install-receipt.yaml`, and
`outcome: validated`. List all six cases exactly once. Baseline and with-skill
must use different session and run IDs. `validator_exit`, `invariants`, and
other self-reported validation claims are forbidden unknown fields.

Markdown after the frontmatter may contain a short redacted human summary. The
validator safety-scans it but does not hash or compare it.

## Closed `agent-output.yaml` schema

Each case file has exactly these keys:

```yaml
schema_version: 1
track: with-skill
case_id: minimal-lead-collector
candidate_commit: <same candidate>
session_id: <same track session>
run_id: <same track run>
input_sha256: <configured digest>
outcome: validated
constraints:
  network_used: false
  production_writes: false
focus_results:
  - requirement: minimum viable worker and Skill
    addressed: true
observation_codes: []
```

`focus_results` repeats `expected_focus` in configured order, exactly once.
Every with-skill entry must have `addressed: true`. Baseline uses
`outcome: observed`; its `addressed` values are observations rather than a pass
claim, and `observation_codes` must contain at least one stable uppercase code
such as `CONTROL_ONLY`. With-skill `observation_codes` is empty.

Do not retain the Agent's raw response, conversation, task/thread identifier,
chain of thought, or free-form evidence prose. The structured coverage record
is the complete retained behavior artifact.

## Closed `artifact-manifest.json` schema

Each case manifest has exactly these keys and one exact file entry:

```json
{
  "schema_version": 1,
  "track": "with-skill",
  "case_id": "minimal-lead-collector",
  "candidate_commit": "<same candidate>",
  "session_id": "<same track session>",
  "run_id": "<same track run>",
  "input_sha256": "<configured digest>",
  "files": [
    {
      "path": "agent-output.yaml",
      "sha256": "<sha256 of exact agent-output.yaml bytes>"
    }
  ]
}
```

The SHA-256 is an artifact-integrity check. It is not a semantic hash of
narrative prose and is never used to compare two Agents' wording.

## Closed redacted install receipt

Copy the authoritative local copy-install manifest into a new redacted summary
with exactly:

```yaml
schema_version: 1
mode: copy
target: codex # codex | claude-code
source_commit: <candidate_commit>
source_dirty: false
source_tree_hash: <64 lowercase hex from the install manifest>
```

Do not copy `source_path`, `target_path`, `installed_at`, file listings, or any
other field. The validator requires copy mode, a clean source, and
`source_commit == candidate_commit`. It reads the canonical Skill distribution
directly from that candidate's Git objects, using the same paths, file modes,
blob bytes, symlink targets, and tree-hash algorithm as the installer, then
requires the recomputed hash to equal `source_tree_hash`. It never trusts the
current worktree for this comparison.

## What the validator recomputes

The validator safety-scans retained reports and artifacts; enforces closed
schemas and exact file sets; recomputes the cases-file and per-input digests;
recomputes every manifest file SHA-256; cross-checks candidate, track, case,
session, run, and input references; derives baseline observation and
with-skill `expected_focus` coverage; checks that the retained network and
production-write declarations consistently say unused/none; validates the
redacted copy-install receipt against the candidate Git tree; and checks
candidate existence, evidence-only Git changes, ancestry, and worktree
cleanliness.

It never calls a model, contacts a service, executes the generated artifacts,
hashes narrative report prose, or upgrades behavior evidence into offline
package proof. Exit `0` proves only retained structure, digest and Git binding,
candidate tree-hash binding, and declaration consistency. It does not prove
execution provenance, Agent identity, session independence, network isolation,
or production-write isolation; maintainers must witness those process controls.
