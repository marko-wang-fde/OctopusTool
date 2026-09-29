export class OctoplannerError extends Error {
  readonly code: string
  readonly issues?: unknown[]

  constructor(code: string, message: string, issues?: unknown[]) {
    super(message)
    this.name = 'OctoplannerError'
    this.code = code
    if (issues) this.issues = issues
  }
}

export function fail(code: string, message: string, issues?: unknown[]): never {
  throw new OctoplannerError(code, message, issues)
}
