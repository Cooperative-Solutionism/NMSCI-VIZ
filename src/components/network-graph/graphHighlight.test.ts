import { describe, expect, it } from 'vitest'
import type { ChainGraphEdge } from '../../lib/types'
import { cycleEndpointIds, highlightedChainsForMode } from './graphHighlight'

const edges: ChainGraphEdge[] = [
  edge('edge-a', 'node-a', 'node-b', 'chain-a', 'open'),
  edge('edge-b', 'node-b', 'node-c', 'chain-b', 'looped'),
  edge('edge-c', 'node-c', 'node-d', 'chain-b', 'looped'),
]

describe('graph highlight helpers', () => {
  it('uses selected related chains in related mode', () => {
    expect(
      Array.from(highlightedChainsForMode('related', new Set(['chain-a']), new Set(['chain-b']))),
    ).toEqual(['chain-a'])
  })

  it('uses cycle chains in cycles mode', () => {
    expect(
      Array.from(highlightedChainsForMode('cycles', new Set(['chain-a']), new Set(['chain-b']))),
    ).toEqual(['chain-b'])
  })

  it('returns cycle endpoints from highlighted cycle chains', () => {
    expect(Array.from(cycleEndpointIds(edges, new Set(['chain-b']))).sort()).toEqual([
      'node-b',
      'node-c',
      'node-d',
    ])
  })
})

function edge(
  id: string,
  source: string,
  target: string,
  chainId: string,
  status: ChainGraphEdge['status'],
): ChainGraphEdge {
  return {
    id,
    source,
    target,
    chainId,
    label: '1.00 CNY',
    amount: 100n,
    currencyType: 1,
    status,
    color: '#0f766e',
    relatedTransactionRecord: 'record',
    relatedTransactionMount: 'mount',
    relatedTransactionMountTimestamp: 1n,
  }
}
