export function createId(prefix: string): string {
  const time = new Date().toISOString().replace(/[-:.TZ]/g, '')
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${time}_${random}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
