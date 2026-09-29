import { chmod, cp, mkdir, rm, stat, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type RootPackageJson = {
  name: string
  version: string
  description?: string
  type?: string
  dependencies?: Record<string, string>
}

const root = process.cwd()
const out = path.join(root, 'package')
const dist = path.join(root, 'dist')

const requiredDocs = [
  'cli-reference.md',
  'agent-integration.md',
  'model-contract.md',
  'rule-contract.md',
  'scheduling-semantics.md',
  'examples.md'
] as const

const requiredExamples = [
  'minimal/requirements.json',
  'minimal/items.json',
  'minimal/routings.json',
  'minimal/resources.json',
  'minimal/supplies.json',
  'reschedule/requirements.json',
  'reschedule/items.json',
  'reschedule/routings.json',
  'reschedule/resources.json',
  'reschedule/rules.json'
] as const

const requiredSchemas = [
  'requirement.schema.json',
  'item.schema.json',
  'routing.schema.json',
  'resource.schema.json',
  'supply.schema.json',
  'rule.schema.json',
  'case.schema.json',
  'revision.schema.json',
  'plan-diff.schema.json'
] as const

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

async function requireFile(file: string): Promise<void> {
  if (!(await exists(file))) {
    throw new Error(`Required package file is missing: ${path.relative(root, file)}`)
  }
}

async function copyFileIfPresent(fileName: string): Promise<void> {
  const source = path.join(root, fileName)
  if (await exists(source)) {
    await cp(source, path.join(out, fileName))
  }
}

async function ensureCliEntrypoint(): Promise<void> {
  const cliPath = path.join(out, 'dist/cli.js')
  const cliSource = await readFile(cliPath, 'utf8')
  const withShebang = cliSource.startsWith('#!/usr/bin/env bun')
    ? cliSource
    : `#!/usr/bin/env bun\n${cliSource}`
  await writeFile(cliPath, withShebang)
  await chmod(cliPath, 0o755)
}

function buildPublishPackage(rootPackage: RootPackageJson): Record<string, unknown> {
  return {
    name: rootPackage.name,
    version: rootPackage.version,
    description: rootPackage.description ?? 'Bun-first CLI for AI Agent-driven production scheduling.',
    type: 'module',
    bin: {
      octoplanner: './dist/cli.js'
    },
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js'
      },
      './schemas': {
        types: './dist/domain/schemas.d.ts',
        import: './dist/domain/schemas.js'
      },
      './docs/*': './docs/*',
      './examples/*': './examples/*',
      './json-schemas/*': './schemas/*'
    },
    dependencies: rootPackage.dependencies ?? {},
    engines: {
      bun: '>=1.1.0'
    }
  }
}

async function main(): Promise<void> {
  await requireFile(path.join(dist, 'cli.js'))
  await requireFile(path.join(dist, 'index.js'))
  await requireFile(path.join(dist, 'index.d.ts'))
  await requireFile(path.join(dist, 'report-web', 'index.html'))
  for (const doc of requiredDocs) await requireFile(path.join(root, 'docs', doc))
  for (const example of requiredExamples) await requireFile(path.join(root, 'examples', example))
  for (const schema of requiredSchemas) await requireFile(path.join(root, 'schemas', schema))

  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })

  await cp(dist, path.join(out, 'dist'), { recursive: true })
  await mkdir(path.join(out, 'docs'), { recursive: true })
  for (const doc of requiredDocs) {
    await cp(path.join(root, 'docs', doc), path.join(out, 'docs', doc))
  }
  await cp(path.join(root, 'examples'), path.join(out, 'examples'), { recursive: true })
  await cp(path.join(root, 'schemas'), path.join(out, 'schemas'), { recursive: true })
  await cp(path.join(root, 'README.md'), path.join(out, 'README.md'))
  await copyFileIfPresent('LICENSE')
  await copyFileIfPresent('CHANGELOG.md')

  await ensureCliEntrypoint()

  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as RootPackageJson
  await writeFile(
    path.join(out, 'package.json'),
    `${JSON.stringify(buildPublishPackage(rootPackage), null, 2)}\n`
  )

  const requiredPublishFiles = [
    'package.json',
    'README.md',
    'dist/cli.js',
    'dist/index.js',
    'dist/index.d.ts',
    ...requiredDocs.map((doc) => `docs/${doc}`),
    ...requiredExamples.map((example) => `examples/${example}`),
    ...requiredSchemas.map((schema) => `schemas/${schema}`)
  ]
  for (const file of requiredPublishFiles) {
    await requireFile(path.join(out, file))
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`prepare-package failed: ${message}\n`)
  process.exit(1)
})
