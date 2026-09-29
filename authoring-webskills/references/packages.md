# WebSkill Package Roles

Use this reference when deciding which package owns a WebSkill authoring behavior.

## `@syngy/create-webskill`

Owns scaffolding.

It creates a package directory with the expected WebSkill shape:

- `package.json`
- `manifest.json`
- `SKILL.md`
- script examples
- npm scripts for validation and local execution

The normal create command is:

```bash
npm create @syngy/webskill <package-dir> -- --title "<title>" --domain <domain>
```

The generated `package.json.name` is the platform package identity. It should be globally unique and should remain stable across edits and publishes.
Its format is `@scope/package`; each segment is 1-100 chars using lowercase letters, numbers, `.`, `_`, or `-`.

The generated `manifest.json` uses `title` as the display title. `package.json.name` is the package identity.

## `@syngy/webskill-devtools`

Owns local authoring checks and local script execution.

Generated packages use it through package scripts such as:

```bash
npm run check
npm run run -- --url <url> --tool <tool-name> --args '<json-args>'
```

Use it before publishing. It verifies package structure, manifest consistency, script loading, and local runtime behavior.

## `@syngy/octopus-cli`

Owns authenticated publish to a team.

Use the official command:

```bash
octopus-cli webskill publish <package-dir> --publish-note "<publish note>" --json
```

The CLI packages the directory and sends it to the platform. It infers create-vs-update from `package.json.name`.
Every publish requires `--publish-note`; the note is stored in version history.

## Platform Storage

The platform stores a WebSkill package as a team-owned package record and versioned bundle. `package.json.name` is the unique package identity. Publishing a package with an existing name owned by the same team updates that package. A package identity owned by another team is rejected.

## Ownership Boundary

Keep responsibilities separate:

- Scaffold changes belong in `@syngy/create-webskill`.
- Local validation and local runtime behavior belong in `@syngy/webskill-devtools`.
- Auth, team selection, zipping, upload, and publish responses belong in `@syngy/octopus-cli`.
- Runtime matching, web skill discovery, and execution belong in the platform services.
