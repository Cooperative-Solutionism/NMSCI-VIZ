import { describe, expect, it } from 'vitest'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  chainColor,
  formatAmount,
  mergeConsumeChains,
  shortId,
} from './chainGraph'
import type { ConsumeChainResponseDTORaw } from './types'

const chainRows: ConsumeChainResponseDTORaw[] = [
  {
    consumeChain: {
      id: 'chain-a',
      start: '11111111-1111-4111-8111-111111111111',
      end: '33333333-3333-4333-8333-333333333333',
      amount: 12500,
      currencyType: 1,
      isLoop: true,
      tailMountTimestamp: 1_700_000_000_000_000,
    },
    consumeChainEdges: [
      {
        id: 'edge-a1',
        source: '11111111-1111-4111-8111-111111111111',
        target: '22222222-2222-4222-8222-222222222222',
        amount: 5000,
        currencyType: 1,
        chain: 'chain-a',
        relatedTransactionRecord: 'record-a1',
        relatedTransactionMount: 'mount-a1',
        relatedTransactionMountTimestamp: 1_700_000_000_000_001,
        isLoop: true,
      },
      {
        id: 'edge-a2',
        source: '22222222-2222-4222-8222-222222222222',
        target: '33333333-3333-4333-8333-333333333333',
        amount: 7500,
        currencyType: 1,
        chain: 'chain-a',
        relatedTransactionRecord: 'record-a2',
        relatedTransactionMount: 'mount-a2',
        relatedTransactionMountTimestamp: 1_700_000_000_000_002,
        isLoop: true,
      },
    ],
  },
  {
    consumeChain: {
      id: 'chain-b',
      start: '11111111-1111-4111-8111-111111111111',
      end: '44444444-4444-4444-8444-444444444444',
      amount: 3200,
      currencyType: 1,
      isLoop: false,
      tailMountTimestamp: 1_700_000_000_000_010,
    },
    consumeChainEdges: [
      {
        id: 'edge-b1',
        source: '11111111-1111-4111-8111-111111111111',
        target: '44444444-4444-4444-8444-444444444444',
        amount: 3200,
        currencyType: 1,
        chain: 'chain-b',
        relatedTransactionRecord: 'record-b1',
        relatedTransactionMount: 'mount-b1',
        relatedTransactionMountTimestamp: 1_700_000_000_000_011,
        isLoop: false,
      },
    ],
  },
]

describe('chain graph mapping', () => {
  it('deduplicates nodes, maps directed edges, and aggregates metrics', () => {
    const graph = buildGraphFromConsumeChains(chainRows)

    expect(graph.nodes.map((node) => node.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ])
    expect(graph.edges).toHaveLength(3)
    expect(graph.edges[0]).toMatchObject({
      id: 'edge-a1',
      source: '11111111-1111-4111-8111-111111111111',
      target: '22222222-2222-4222-8222-222222222222',
      chainId: 'chain-a',
      status: 'looped',
      amount: 5000,
      color: chainColor('chain-a'),
    })
    expect(graph.edges[0].color).toBe(graph.edges[1].color)
    expect(graph.edges[0].color).not.toBe(graph.edges[2].color)
    expect(graph.stats).toEqual({
      totalChains: 2,
      loopedChains: 1,
      openChains: 1,
      volume: 15700,
      currencyType: 1,
    })
  })

  it('builds backend URLs for node-centered start and end queries', () => {
    expect(buildConsumeChainUrl('/api', {
      mode: 'start',
      nodeId: 'node-1',
      loopStatus: 'open',
      page: 2,
      size: 25,
    })).toBe('/api/consume-chain/by-start?start=node-1&isLoop=false&page=2&size=25')

    expect(buildConsumeChainUrl('http://localhost:8080/', {
      mode: 'end',
      nodeId: 'node 2',
      loopStatus: 'looped',
      page: 0,
      size: 10,
    })).toBe('http://localhost:8080/consume-chain/by-end?end=node+2&isLoop=true&page=0&size=10')

    expect(buildConsumeChainUrl('/api', {
      mode: 'node',
      nodeId: 'node-3',
      loopStatus: 'all',
      page: 1,
      size: 100,
    })).toBe('/api/consume-chain/by-node?node=node-3&page=1&size=100')
  })

  it('formats operational labels without losing raw ids', () => {
    expect(shortId('abcdef11-1111-4111-8111-111111111111')).toBe('ABCDEF')
    expect(formatAmount(12500, 1)).toBe('125.00 CNY')
    expect(formatAmount(2500000, 0)).toBe('2,500,000 ug Au')
    expect(chainColor('chain-a')).toBe(chainColor('chain-a'))
    expect(chainColor('chain-a')).not.toBe(chainColor('chain-b'))
  })

  it('merges extended consume chains by chain id without duplicating existing graph rows', () => {
    const duplicate = {
      ...chainRows[0],
      consumeChain: {
        ...chainRows[0].consumeChain,
        amount: 999999,
      },
    }
    const extra: ConsumeChainResponseDTORaw = {
      consumeChain: {
        id: 'chain-c',
        start: '44444444-4444-4444-8444-444444444444',
        end: '55555555-5555-4555-8555-555555555555',
        amount: 6000,
        currencyType: 1,
        isLoop: false,
        tailMountTimestamp: 1_700_000_000_000_020,
      },
      consumeChainEdges: [
        {
          id: 'edge-c1',
          source: '44444444-4444-4444-8444-444444444444',
          target: '55555555-5555-4555-8555-555555555555',
          amount: 6000,
          currencyType: 1,
          chain: 'chain-c',
          relatedTransactionRecord: 'record-c1',
          relatedTransactionMount: 'mount-c1',
          relatedTransactionMountTimestamp: 1_700_000_000_000_021,
          isLoop: false,
        },
      ],
    }

    const merged = mergeConsumeChains(chainRows, [duplicate, extra])

    expect(merged.map((row) => row.consumeChain.id)).toEqual(['chain-a', 'chain-b', 'chain-c'])
    expect(merged[0].consumeChain.amount).toBe(12500)
  })
})
