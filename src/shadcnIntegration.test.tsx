import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { readSource, sourceExists } from './test/appTestHarness'

describe('shadcn/ui integration', () => {
  it('provides the project configuration and base Button component', async () => {
    expect(sourceExists('components.json')).toBe(true)
    expect(sourceExists('src/lib/utils.ts')).toBe(true)
    expect(sourceExists('src/components/ui/button.tsx')).toBe(true)

    const buttonModulePath = './components/ui/button.tsx'
    const { Button } = await import(/* @vite-ignore */ buttonModulePath)

    render(<Button>确认操作</Button>)

    expect(screen.getByRole('button', { name: '确认操作' })).toBeTruthy()
  })

  it('keeps shadcn muted colors separate from the existing app muted text token', () => {
    const indexCss = readSource('src/index.css')

    expect(indexCss).toContain('--muted: #61706a;')
    expect(indexCss).toContain('--shadcn-muted: var(--surface-muted);')
    expect(indexCss).toContain('--color-muted: var(--shadcn-muted);')
    expect(indexCss).toContain('--background: var(--bg);')
    expect(indexCss).toContain('--foreground: var(--text);')
  })
})
