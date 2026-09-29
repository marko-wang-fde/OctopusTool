import type { ParsedArgs } from '../core/args'
import type { CliSuccess } from '../core/result'

export type CommandContext = {
  cwd: string
  env: Record<string, string | undefined>
}

export type CommandHandler = (parsed: ParsedArgs, context: CommandContext) => Promise<CliSuccess<unknown>> | CliSuccess<unknown>
