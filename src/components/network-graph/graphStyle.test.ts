import { describe, expect, it } from 'vitest'
import { graphTokenDefaults } from '../../lib/tokens'
import { graphNodeIconUrls } from './graphIcons'
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
  it('distinguishes node state with inline-SVG icon layers instead of native shapes or line styles', () => {
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
    // 选中用节点外侧描边（outline），不叠加图标层、不改底色或边框，避免遮挡原节点图标。
    expect(selected).toEqual(
      expect.objectContaining({
        'outline-color': graphTokenDefaults.nodeSelectedBorder,
        'outline-opacity': 1,
        'outline-width': 5,
      }),
    )
    expect(selected).not.toHaveProperty('background-image')
    expect(selected).not.toHaveProperty('border-color')
    expect(selected).not.toHaveProperty('background-color')

    expect(rule('node.cycle-endpoint')).toEqual(
      expect.objectContaining({
        'background-image': ['data(icon)', graphNodeIconUrls.cycleEndpoint],
      }),
    )
  })
})
