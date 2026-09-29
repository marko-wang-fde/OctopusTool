---
name: authoring-webskills
description: Use when creating, testing, scripting, cloning, or publishing WebSkill packages for reusable browser automation workflows
---

# Authoring WebSkills

Use this skill to turn a successful browser operation into a reusable WebSkill package. Keep one success path: create a package, validate it locally, run scripts locally, then publish the same package directory with `octopus-cli`.

## Workflow

1. Pick a package title and target domain from the task.
2. Create the package with `npm create @syngy/webskill`.
3. Edit `SKILL.md`, `manifest.json`, and scripts until the workflow is reproducible.
4. Run the generated package checks.
5. Run the target script locally against a representative URL.
6. Publish with the installed `octopus-cli`.
7. Publish the same directory again when verifying update semantics.

Use npm only:

```bash
npm create @syngy/webskill <package-dir> -- --title "<title>" --domain <domain>
cd <package-dir>
npm install
npm run check
npm run run -- --url <url> --tool <tool-name> --args '<json-args>'
```

Publish through the official Octopus CLI command:

```bash
octopus-cli auth whoami --json
octopus-cli webskill publish <package-dir> --publish-note "<publish note>" --json
```

Publish uses `package.json.name` as the package identity. The format is `@scope/package`; each segment is 1-100 chars using lowercase letters, numbers, `.`, `_`, or `-`.

`manifest.json` uses `title` for the display title. `description`, `domains`, `pathPatterns`, `entryPath`, and `tools` are required. `web_skill_publish` and `octopus-cli webskill publish` require a human-readable publish note for version history.

## Package Relationship

Read [references/packages.md](references/packages.md) when you need to explain or debug package responsibilities.

Short version:

| Package | Role |
| --- | --- |
| `@syngy/create-webskill` | Scaffolds a WebSkill package. It is normally invoked as `npm create @syngy/webskill`. |
| `@syngy/webskill-devtools` | Provides local package validation and script execution used by generated packages. |
| `@syngy/octopus-cli` | Publishes a checked package directory to a team. |

Generated WebSkill packages must include `package.json`, `manifest.json`, `SKILL.md`, and any scripts referenced by `manifest.json`.

## Script Context

Scripts export an async `run(args, context)` function. Browser automation goes through `context.pageTool`.

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

Use `pageTool` for page state, element actions, keyboard input, mouse actions, and visual understanding. Read [references/pageTool.md](references/pageTool.md) before writing or reviewing non-trivial scripts.

Common calls:

```js
await context.pageTool.page.title()
await context.pageTool.page.url()
await context.pageTool.keyboard.type('hello')
await context.pageTool.mouse.move(100, 120)
await context.pageTool.mouse.click(100, 120)
await context.pageTool.element.click({ ref: 'submit' })
await context.pageTool.element.fill({ ref: 'query' }, 'hello')
```

For local fixtures, prefer stable refs:

```html
<input data-webskill-ref="query">
<button data-webskill-ref="submit">Search</button>
```

## Validation

Before reporting success, verify:

- `npm run check` exits 0.
- The script runs locally with `npm run run`.
- `package.json.name` is present and stable.
- `package.json.name` follows `@scope/package`; each segment is 1-100 chars using lowercase letters, numbers, `.`, `_`, or `-`.
- `manifest.json` has `title`, `description`, `domains`, `pathPatterns`, `entryPath`, and `tools`.
- Publish response contains `package.packageName`.
- `package.packageName` equals local `package.json.name`.
- Re-publishing the same directory updates the same package identity.

When a command fails, stop at the failing command, read the error, and fix the package or environment that produced it. The validation and publish path is `npm run check`, `npm run run`, then `octopus-cli webskill publish`.
