# Authoring WebSkills

This repository contains the `authoring-webskills` Codex skill. Use it to create, validate, run, and publish reusable browser automation WebSkill packages.

## What This Skill Does

The skill guides one authoring path:

1. Create a WebSkill package with `npm create @syngy/webskill`.
2. Edit the generated `SKILL.md`, `manifest.json`, and script files.
3. Validate the package locally with the generated npm scripts.
4. Run the target script locally against a representative URL.
5. Publish the same package directory with `octopus-cli webskill publish`.

Use npm for every package command.

## Repository Layout

```text
.
|-- SKILL.md
|-- agents/
|   `-- openai.yaml
`-- references/
    |-- packages.md
    `-- pageTool.md
```

- `SKILL.md`: main Codex skill instructions.
- `agents/openai.yaml`: skill display metadata and invocation policy.
- `references/packages.md`: ownership boundaries for the authoring npm packages.
- `references/pageTool.md`: script-facing browser automation API reference.

## Create And Validate A WebSkill

```bash
npm create @syngy/webskill <package-dir> -- --title "<title>" --domain <domain>
cd <package-dir>
npm install
npm run check
npm run run -- --url <url> --tool <tool-name> --args '<json-args>'
```

Generated packages contain:

- `package.json`
- `manifest.json`
- `SKILL.md`
- script files referenced by `manifest.json`

`package.json.name` is the platform package identity. The required format is `@scope/package`; each segment is 1-100 characters and uses lowercase letters, numbers, `.`, `_`, or `-`.

`manifest.json` uses `title` as the display title. `description`, `domains`, `pathPatterns`, `entryPath`, and `tools` are required.

## Publish

Authenticate with Octopus CLI, then publish the package directory:

```bash
octopus-cli auth whoami --json
octopus-cli webskill publish <package-dir> --publish-note "<publish note>" --json
```

`--publish-note` is required for version history. Publishing uses `package.json.name` to identify the package.

## Package Responsibilities

| Package | Responsibility |
| --- | --- |
| `@syngy/create-webskill` | Scaffolds WebSkill packages. |
| `@syngy/webskill-devtools` | Validates package structure and runs scripts locally. |
| `@syngy/octopus-cli` | Authenticates, packages, uploads, and publishes WebSkills. |

See [references/packages.md](references/packages.md) for the full responsibility split.

## Script Runtime

WebSkill scripts export an async `run(args, context)` function. Browser automation goes through `context.pageTool`.

```js
async function run(args, context) {
  const title = await context.pageTool.page.title()
  const url = await context.pageTool.page.url()

  return {
    result: {
      title: title.value,
      url: url.value
    }
  }
}
```

Use `pageTool` for page state, element actions, keyboard input, mouse actions, and visual understanding. See [references/pageTool.md](references/pageTool.md) before writing non-trivial scripts.

## Validation Checklist

Before publishing a WebSkill package:

- `npm run check` exits 0.
- `npm run run` proves the target script against a representative URL.
- `package.json.name` is stable and follows the required package identity format.
- `manifest.json` has `title`, `description`, `domains`, `pathPatterns`, `entryPath`, and `tools`.
- Publish response contains `package.packageName`.
- `package.packageName` equals local `package.json.name`.
