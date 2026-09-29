import { chmodSync, rmSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = path.resolve('.')
const packageRoot = path.join(repoRoot, 'package')

async function run(command: string[], label: string): Promise<void> {
  const proc = Bun.spawn(command, {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  if (exitCode !== 0) {
    throw new Error(`${label} failed with ${exitCode}\n${stdout}\n${stderr}`)
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(path.join(packageRoot, file))
    return true
  } catch {
    return false
  }
}

afterEach(() => {
  rmSync(packageRoot, { recursive: true, force: true })
})

describe('package preparation', () => {
  it('assembles the npm publish directory', async () => {
    await run(['npm', 'run', 'build'], 'build')
    await run(['npm', 'run', 'build:report-web'], 'build:report-web')
    await run(['bun', 'scripts/prepare-package.ts'], 'prepare-package')

    expect(await exists('package.json')).toBe(true)
    expect(await exists('dist/cli.js')).toBe(true)
    expect(await exists('dist/index.d.ts')).toBe(true)
    expect(await exists('dist/report-web/index.html')).toBe(true)
    expect(await exists('docs/cli-reference.md')).toBe(true)
    expect(await exists('docs/agent-integration.md')).toBe(true)
    expect(await exists('examples/minimal/requirements.json')).toBe(true)
    expect(await exists('schemas/requirement.schema.json')).toBe(true)
    expect(await exists('schemas/revision.schema.json')).toBe(true)
    expect(await exists('schemas/plan-diff.schema.json')).toBe(true)

    const publishPackage = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as {
      bin?: { octoplanner?: string }
      types?: string
      engines?: { bun?: string }
      private?: boolean
    }

    expect(publishPackage.bin?.octoplanner).toBe('./dist/cli.js')
    expect(publishPackage.types).toBe('./dist/index.d.ts')
    expect(publishPackage.engines?.bun).toBeTruthy()
    expect(publishPackage.private).toBeUndefined()

    const mode = (await stat(path.join(packageRoot, 'dist/cli.js'))).mode
    expect(mode & 0o111).toBeGreaterThan(0)

    chmodSync(path.join(packageRoot, 'dist/cli.js'), 0o644)
  })
})
