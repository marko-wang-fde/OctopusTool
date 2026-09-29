import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from '../../src/cli'
import { createReportServer } from '../../src/report/server'
import { getMessages } from '../../src/report/web/src/lib/i18n'

let dir: string | undefined
const example = (name: string) => path.resolve('examples/report-complex', name)

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

function tempWorkspace(): string {
  dir = mkdtempSync(path.join(tmpdir(), 'octoplanner-report-complex-'))
  return dir
}

async function json(response: Response) {
  return JSON.parse(await response.text())
}

describe('report complex example', () => {
  it('creates a multi-order plan suitable for timeline filtering', async () => {
    const cwd = tempWorkspace()
    await runCli(['workspace', 'init'], { cwd, env: {} })
    await runCli(['model', 'requirement', 'load', '--file', example('requirements.json')], { cwd, env: {} })
    await runCli(['model', 'item', 'load', '--file', example('items.json')], { cwd, env: {} })
    await runCli(['model', 'routing', 'load', '--file', example('routings.json')], { cwd, env: {} })
    await runCli(['model', 'resource', 'load', '--file', example('resources.json')], { cwd, env: {} })
    await runCli(['model', 'supply', 'load', '--file', example('supplies.json')], { cwd, env: {} })
    await runCli(['case', 'create', '--name', 'report-complex'], { cwd, env: {} })
    const planResult = await runCli(['plan', 'create', '--case', 'report-complex', '--name', 'report-complex-plan'], { cwd, env: {} })

    expect(planResult.exitCode).toBe(0)

    const server = createReportServer({ cwd, host: '127.0.0.1', port: 0, locale: 'zh-CN' })
    const timeline = await json(await server.fetch(new Request('http://local/api/plans/report-complex-plan/timeline')))
    const operations = timeline.data.resources.flatMap((resource: any) => resource.operations)
    const requirementIds = new Set(operations.map((operation: any) => operation.requirementId))
    const resourceIds = new Set(operations.map((operation: any) => operation.resourceId))

    expect(requirementIds.size).toBeGreaterThanOrEqual(8)
    expect(resourceIds.size).toBeGreaterThanOrEqual(4)
    expect(operations.length).toBeGreaterThanOrEqual(20)
    expect(getMessages('zh-CN').orderFilter).toBe('订单筛选')
    expect(getMessages('en-US').allOrders).toBe('All orders')
  })
})
