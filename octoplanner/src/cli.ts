#!/usr/bin/env bun
import { parseArgs } from './core/args'
import { OctoplannerError } from './core/errors'
import { failure, success } from './core/result'
import { VERSION } from './index'
import { caseCommand } from './commands/case'
import { auditCommand } from './commands/audit'
import { explainCommand } from './commands/explain'
import { impactCommand } from './commands/impact'
import { modelCommand } from './commands/model'
import { planCommand } from './commands/plan'
import { reportCommand } from './commands/report'
import { ruleCommand } from './commands/rule'
import { scenarioCommand } from './commands/scenario'
import { schemaCommand } from './commands/schema'
import { workspaceCommand } from './commands/workspace'

export type CliRunContext = {
  cwd: string
  env: Record<string, string | undefined>
}

export type CliRunResult = {
  exitCode: number
  stdout: string
  stderr: string
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

export async function runCli(argv: string[], context: CliRunContext): Promise<CliRunResult> {
  try {
    if (argv.length === 1 && argv[0] === '--version') {
      return {
        exitCode: 0,
        stdout: json(success({ name: 'octoplanner', version: VERSION })),
        stderr: ''
      }
    }

    const parsed = parseArgs(argv)
    const command = parsed.positionals[0]
    if (!command) {
      return {
        exitCode: 2,
        stdout: '',
        stderr: json(failure('UNKNOWN_COMMAND', 'Unknown command'))
      }
    }

    const handlers = {
      workspace: workspaceCommand,
      schema: schemaCommand,
      model: modelCommand,
      rule: ruleCommand,
      case: caseCommand,
      plan: planCommand,
      report: reportCommand,
      impact: impactCommand,
      scenario: scenarioCommand,
      explain: explainCommand,
      audit: auditCommand
    } as const
    if (command in handlers) {
      const output = await handlers[command as keyof typeof handlers](parsed, context)
      return { exitCode: 0, stdout: json(output), stderr: '' }
    }

    return { exitCode: 2, stdout: '', stderr: json(failure('UNKNOWN_COMMAND', `Unknown command: ${command}`)) }
  } catch (error) {
    if (error instanceof OctoplannerError) {
      return {
        exitCode: 2,
        stdout: '',
        stderr: json(failure(error.code, error.message, error.issues))
      }
    }

    return {
      exitCode: 1,
      stdout: '',
      stderr: json(failure('INTERNAL_ERROR', error instanceof Error ? error.message : 'Internal error'))
    }
  }
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2)
  const result = await runCli(argv, { cwd: process.cwd(), env: process.env })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (argv[0] === 'report' && argv[1] === 'serve' && result.exitCode === 0 && process.env.OCTOPLANNER_REPORT_SERVE_DRY_RUN !== '1') {
    await new Promise(() => undefined)
  }
  process.exit(result.exitCode)
}
