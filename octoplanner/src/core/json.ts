import { readFileSync, writeFileSync } from 'node:fs'
import { fail } from './errors'

export function readJsonFile(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    fail('JSON_INVALID', `JSON_INVALID: ${file} is not valid JSON`, error instanceof Error ? [{ message: error.message }] : undefined)
  }
}

export function writeJsonFile(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}
