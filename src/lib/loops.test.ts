import { describe, expect, it } from 'vitest'
import { normalizeConsumeChainResponseDTO } from '@nmsci/sdk'
import { extractLoops, sortLoops } from './loops'
import type { ConsumeChainResponseDTORaw } from './types'

function rawChain(
  id: string,
  isLoop: boolean,
  amount: number,
  tail: number,
  edges: number,
): ConsumeChainResponseDTORaw {
  return {
    consumeChain: {
      id,
      start: `${id}-start`,
      end: `${id}-end`,
      amount,
      currencyType: 1,
      isLoop,
      tailMountTimestamp: tail,
    },
    consumeChainEdges: Array.from({ length: edges }, (_unused, index) => ({
      id: `${id}-e${index}`,
      source: `${id}-n${index}`,
      target: `${id}-n${index + 1}`,
      amount,
      currencyType: 1,
      chain: id,
      relatedTransactionRecord: `${id}-r${index}`,
      relatedTransactionMount: `${id}-m${index}`,
      relatedTransactionMountTimestamp: tail,
      isLoop,
    })),
  }
}

const rows = [
  rawChain('loop-small', true, 1000, 100, 2),
  rawChain('open-1', false, 9999, 200, 1),
  rawChain('loop-big', true, 5000, 50, 4),
].map(normalizeConsumeChainResponseDTO)

describe('loops', () => {
  it('extracts only looped chains with cycle length and first edge', () => {
    const loops = extractLoops(rows)
    expect(loops.map((loop) => loop.chainId)).toEqual(['loop-small', 'loop-big'])
    expect(loops[0]).toMatchObject({ length: 2, amount: 1000n, firstEdgeId: 'loop-small-e0' })
    expect(loops[1]).toMatchObject({ length: 4, amount: 5000n })
  })

  it('sorts by amount, length, and recency', () => {
    const loops = extractLoops(rows)
    expect(sortLoops(loops, 'amount').map((loop) => loop.chainId)).toEqual(['loop-big', 'loop-small'])
    expect(sortLoops(loops, 'length').map((loop) => loop.chainId)).toEqual(['loop-big', 'loop-small'])
    expect(sortLoops(loops, 'recency').map((loop) => loop.chainId)).toEqual(['loop-small', 'loop-big'])
  })
})
