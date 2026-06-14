import { describe, expect, it } from 'vitest'
import { deterministicOffset, diffIds } from './graphLayout'

describe('graph layout helpers', () => {
  it('returns deterministic offsets in the expected radius band', () => {
    const first = deterministicOffset('node-a')
    const second = deterministicOffset('node-a')
    const radius = Math.hypot(first.x, first.y)

    expect(first).toEqual(second)
    expect(radius).toBeGreaterThanOrEqual(126)
    expect(radius).toBeLessThan(174)
  })

  it('diffs graph element ids', () => {
    expect(diffIds(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual({
      add: ['d'],
      keep: ['b', 'c'],
      remove: ['a'],
    })
  })
})
