import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function productionSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'test') return []
      return productionSourceFiles(path)
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) return []
    if (/\.test\.(ts|tsx)$/.test(entry.name)) return []
    return [path]
  })
}

describe('user prompt components', () => {
  it('does not use native browser prompt APIs in production user flows', () => {
    for (const file of productionSourceFiles(join(process.cwd(), 'src'))) {
      const text = readFileSync(file, 'utf8')

      expect(text, file).not.toMatch(/\bwindow\.(alert|confirm|prompt)\s*\(/)
      expect(text, file).not.toMatch(/\b(alert|confirm|prompt)\s*\(/)
    }
  })
})
