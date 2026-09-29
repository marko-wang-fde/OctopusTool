# `pageTool` Reference

`pageTool` is the script-facing browser automation object available at `context.pageTool`. It presents browser capabilities for WebSkill scripts while keeping the script API distinct from Playwright.

## Return Shape

Many read calls return structured values:

```js
const title = await context.pageTool.page.title()
return { result: { title: title.value } }
```

Inspect the generated package examples and local run output when adding a new call.

## Page State

Use page state methods to inspect the current browser context:

```js
await context.pageTool.page.title()
await context.pageTool.page.url()
```

Add page-state checks before acting when the script depends on a specific route or page state.

## Keyboard

Use keyboard methods for text entry and key presses:

```js
await context.pageTool.keyboard.type('search text')
await context.pageTool.keyboard.press('Enter')
```

Prefer element filling for normal form fields. Use keyboard operations when the site behavior depends on real key events.

## Mouse

Use mouse methods for pointer-level actions:

```js
await context.pageTool.mouse.move(100, 120)
await context.pageTool.mouse.click(100, 120)
```

Prefer element actions when a stable element ref exists. Use mouse operations for canvas-like surfaces, drag operations, menus, or coordinates derived from a screenshot.

## Elements

Use element methods with refs:

```js
await context.pageTool.element.click({ ref: 'submit' })
await context.pageTool.element.fill({ ref: 'query' }, 'hello')
```

Local fixtures can expose refs with `data-webskill-ref`:

```html
<input data-webskill-ref="query">
<button data-webskill-ref="submit">Submit</button>
```

For production sites, choose refs produced by the browser observation layer. Keep scripts resilient by checking the observed page state before acting.

## Visual Understanding

Use image content methods when DOM text and refs are insufficient, such as image-only verification, graphical state, or captcha handling with a human-approved policy.

Expected pattern:

```js
const answer = await context.pageTool.getImageContent(target, {
  type: 'object',
  properties: {
    label: { type: 'string' },
    confidence: { type: 'number' }
  },
  required: ['label']
})
```

Pass a JSON schema so the response has deterministic paths for the script to consume. Keep schema fields narrow and task-specific.

## Script Pattern

Structure scripts as small, observable steps:

```js
async function run(args, context) {
  const page = context.pageTool
  const before = await page.page.url()

  await page.element.fill({ ref: 'query' }, String(args.query ?? ''))
  await page.element.click({ ref: 'submit' })

  const after = await page.page.url()
  return {
    result: {
      beforeUrl: before.value,
      afterUrl: after.value
    }
  }
}
```

Return a compact JSON result that proves what the script observed and changed.
