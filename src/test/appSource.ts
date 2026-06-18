import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function sourceExists(path: string): boolean {
  return existsSync(join(process.cwd(), path))
}

export function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8')
}
