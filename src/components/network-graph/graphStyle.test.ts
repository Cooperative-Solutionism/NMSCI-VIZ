import { describe, expect, it } from 'vitest'
import { graphTokenDefaults } from '../../lib/tokens'
import { createGraphStyle } from './graphStyle'

type StyleRule = { selector: string; style: Record<string, unknown> }

function rule(selector: string) {
  const styles = createGraphStyle(graphTokenDefaults) as StyleRule[]
  const found = styles.find((entry) => entry.selector === selector)
  if (!found) throw new Error(`Missing graph style rule: ${selector}`)
  return found.style
}

function selectors() {
  return (createGraphStyle(graphTokenDefaults) as StyleRule[]).map((entry) => entry.selector)
}

describe('createGraphStyle', () => {
  it('distinguishes node state with PNG icon layers instead of native shapes or line styles', () => {
    expect(rule('node')).toEqual(
      expect.objectContaining({
        'background-image': 'data(icon)',
        'background-fit': 'contain',
        'background-image-containment': 'over',
      }),
    )

    expect(selectors()).not.toEqual(
      expect.arrayContaining([
        'node[kind = "local-flow"]',
        'node[kind = "local-consume"]',
        'node[flowStatus = "unregistered"]',
        'node[flowStatus = "registered"]',
        'node[flowStatus = "authorized"]',
        'node[flowStatus = "failed"]',
      ]),
    )

    const selected = rule('node:selected')
    expect(selected).toEqual(
      expect.objectContaining({
        'background-image': ['data(icon)', 'url("/graph-icons/node-selected.png")'],
      }),
    )
    expect(selected).not.toHaveProperty('border-color')
    expect(selected).not.toHaveProperty('background-color')

    expect(rule('node.cycle-endpoint')).toEqual(
      expect.objectContaining({
        'background-image': [
          'data(icon)',
          'url("/graph-icons/node-cycle-endpoint.png")',
        ],
      }),
    )
  })
})
