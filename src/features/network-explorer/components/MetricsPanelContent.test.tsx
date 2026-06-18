import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ChainGraph } from '../../../lib/types'
import { MetricsPanelContent } from './MetricsPanelContent'

function cssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? ''
}

function graph(): ChainGraph {
  return {
    nodes: [],
    edges: [],
    stats: {
      totalChains: 12,
      loopedChains: 5,
      openChains: 7,
      volumeByCurrency: new Map([[1, 2500n]]),
    },
  }
}

describe('MetricsPanelContent', () => {
  it('renders metrics as a shadcn card grid', () => {
    const { container } = render(<MetricsPanelContent graph={graph()} />)

    const grid = container.querySelector('.metrics-grid')
    const cards = container.querySelectorAll('[data-slot="card"]')

    expect(grid).toBeInTheDocument()
    expect(container.querySelector('.metrics-strip')).not.toBeInTheDocument()
    expect(cards).toHaveLength(4)
    expect(screen.getByText('\u603b\u94fe\u8def')).toBeInTheDocument()
    expect(screen.getByText('\u6210\u73af')).toBeInTheDocument()
    expect(screen.getByText('\u5f00\u653e')).toBeInTheDocument()
    expect(screen.getByText('\u6d41\u91cf')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('25.00 CNY')).toBeInTheDocument()
  })

  it('uses an adaptive card grid instead of a fixed metric strip', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/network-graph.css'), 'utf8')
    const gridRule = cssRule(css, '.metrics-grid')

    expect(gridRule).toContain('display: grid;')
    expect(gridRule).toContain('grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));')
    expect(gridRule).toContain('gap: 10px;')
    expect(gridRule).not.toContain('grid-template-columns: repeat(4')
  })
})
