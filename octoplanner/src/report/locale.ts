import { fail } from '../core/errors'

export const SUPPORTED_REPORT_LOCALES = ['zh-CN', 'en-US'] as const

export type ReportLocale = (typeof SUPPORTED_REPORT_LOCALES)[number]

export function parseReportLocale(value: unknown): ReportLocale {
  if (value === undefined || value === null || value === '') return 'zh-CN'
  if (value === 'zh-CN' || value === 'en-US') return value
  fail('UNSUPPORTED_LANGUAGE', `Unsupported report language: ${String(value)}`)
}
