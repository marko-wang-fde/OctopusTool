export type Warning = { code: string; message: string; details?: unknown }

export type CliSuccess<T> = {
  ok: true
  data: T
  warnings: Warning[]
  notModeled: string[]
  auditId?: string
}

export type CliFailure = {
  ok: false
  error: {
    code: string
    message: string
    issues?: unknown[]
  }
}

export function success<T>(
  data: T,
  input: { warnings?: Warning[]; notModeled?: string[]; auditId?: string } = {}
): CliSuccess<T> {
  return {
    ok: true,
    data,
    warnings: input.warnings ?? [],
    notModeled: input.notModeled ?? [],
    ...(input.auditId ? { auditId: input.auditId } : {})
  }
}

export function failure(code: string, message: string, issues?: unknown[]): CliFailure {
  return { ok: false, error: { code, message, ...(issues ? { issues } : {}) } }
}
