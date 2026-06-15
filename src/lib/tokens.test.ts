import { describe, expect, it } from 'vitest'
import { graphTokenDefaults, readGraphTokens } from './tokens'

describe('graph token bridge', () => {
  it('uses fallback graph tokens without a DOM root', () => {
    expect(readGraphTokens(null)).toEqual(graphTokenDefaults)
  })

  it('reads CSS variable overrides from a root element', () => {
    const root = document.createElement('div')
    root.style.setProperty('--graph-node-bg', '#111111')
    root.style.setProperty('--chain-1', '#222222')

    const tokens = readGraphTokens(root)

    expect(tokens.nodeBackground).toBe('#111111')
    expect(tokens.chainPalette[0]).toBe('#222222')
    expect(tokens.chainPalette[1]).toBe(graphTokenDefaults.chainPalette[1])
  })
})
