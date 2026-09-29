# Maintainer Guide

## Contract changes

Treat `catalog/toolkit-keys.yaml`, `catalog/assembly-operations.yaml`, schemas,
and CLI evidence as versioned public contracts. Update a toolkit key only from
reviewable platform evidence. Adding a CLI command does not establish option,
payload, target-Team, or platform-acceptance support.

For an operation change:

1. add a failing catalog, payload, renderer, and validation case;
2. update the operation contract and evidence fixture;
3. rebuild the bundled runtime;
4. rebuild the bundled runtime and run the complete verification suite.

Unsupported or unverified capabilities stay `manual-required`; do not infer
commands from help text.

## Golden example

The lead-collector Golden is intentionally explicit. Update
`assets/examples/lead-collector/expected-project` and
`expected-artifacts.yaml` together, explain the behavior change in review, and
run:

```bash
./scripts/test-example --example lead-collector
```

Never regenerate expected hashes merely to make a failing comparison pass.

## Release

Use semantic version tags. Before tagging, run:

```bash
npm ci
npm run verify
npm run verify:public
./scripts/test-example --example lead-collector
npm run verify:e2e
./scripts/validate-forward-test evals/results
```

Golden and end-to-end validation prove the deterministic package.
Forward evidence is a separate fresh-Agent behavior gate and must never be
reported as package proof. Its candidate commit intentionally precedes the
evidence-only commit. Validator exit `0` binds retained structure, declarations,
and the copy-install tree hash to candidate Git objects; it does not
cryptographically prove Agent identity, session independence, network
isolation, or live assembly authorization. Maintainers must witness those
execution controls; see `docs/agent-forward-test.md`.

Create the tag and GitHub Release only after the public default branch passes
CI. Release notes must state that V1 produces a complete validated package and
can perform explicitly authorized direct `octopus-cli` assembly for
catalog-supported operations. Unsupported Skill upload, Arcubase, and platform
steps remain manual-required.
