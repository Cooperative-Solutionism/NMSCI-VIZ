import { describe, expect, it } from 'vitest'
import { normalizeConsumeChainResponseDTO } from '@nmsci/sdk'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  chainColor,
  formatAmount,
  formatVolumeByCurrency,
  mergeConsumeChains,
  mergeLocalNodes,
  shortId,
} from './chainGraph'
import { queryNodeId } from '../test/appFixtures'
import type { ConsumeChainResponseDTORaw } from './types'

const rawChainRows: ConsumeChainResponseDTORaw[] = [
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
const chainRows = rawChainRows.map(normalizeConsumeChainResponseDTO)

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
      amount: 5000n,
      color: chainColor('chain-a'),
    })
    expect(graph.edges[0]!.color).toBe(graph.edges[1]!.color)
    expect(graph.edges[0]!.color).not.toBe(graph.edges[2]!.color)

    // 节点吞吐量只计入关联边金额（不再叠加链额）：node 1111 = a1(5000) + b1(3200)。
    const startNode = graph.nodes.find((node) => node.id === '11111111-1111-4111-8111-111111111111')
    expect(startNode?.volumeByCurrency).toEqual(new Map([[1, 8200n]]))

    expect(graph.stats).toEqual({
      totalChains: 2,
      loopedChains: 1,
      openChains: 1,
      volumeByCurrency: new Map([[1, 15700n]]),
    })
  })

  it('merges local flow/consume nodes and labels unregistered flow nodes by sequence', () => {
    const graph = buildGraphFromConsumeChains(chainRows)
    const before = graph.nodes.length
    const flowRefs = [
      {
        id: 'alpha-flow-node',
        publicKeyHex: 'pk-flow',
        label: 'Flow A',
        position: { x: 1, y: 2 },
      },
      {
        id: 'registered-local-flow-node',
        publicKeyHex: 'pk-registered-flow',
        label: 'Flow B',
        registration: {
          id: 'registered-flow-node-id',
        },
      },
    ]
    const consumeRefs = [
      {
        id: 'bravo-consume-node',
        publicKeyHex: 'pk-consume',
        label: 'Consume A',
      },
    ]

    const merged = mergeLocalNodes(graph, flowRefs, consumeRefs)
    expect(merged.nodes.length).toBe(before + 3)
    const flow = merged.nodes.find((node) => node.id === 'pk-flow')
    expect(flow?.kind).toBe('local-flow')
    expect(flow?.label).toBe('未注册1')
    expect(flow?.position).toEqual({ x: 1, y: 2 })
    expect(merged.nodes.find((node) => node.id === 'pk-registered-flow')?.label).toBe('REGIST')
    const consume = merged.nodes.find((node) => node.id === 'pk-consume')
    expect(consume?.kind).toBe('local-consume')
    expect(consume?.label).toBe('BRAVO-')

    // 已存在的 id 不重复叠加
    const dup = mergeLocalNodes(
      graph,
      [{ id: 'duplicate-flow-node', publicKeyHex: graph.nodes[0]!.id, label: 'X' }],
      [],
    )
    expect(dup.nodes.length).toBe(before)
    expect(dup).toBe(graph)
  })

  it('aggregates volume per currency and never sums across currencies', () => {
    const mixed = [
      chainRows[0]!,
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-au',
          start: 'node-a',
          end: 'node-b',
          amount: 2_500_000,
          currencyType: 0,
          isLoop: false,
          tailMountTimestamp: 1,
        },
        consumeChainEdges: [
          {
            id: 'edge-au',
            source: 'node-a',
            target: 'node-b',
            amount: 2_500_000,
            currencyType: 0,
            chain: 'chain-au',
            relatedTransactionRecord: 'r',
            relatedTransactionMount: 'm',
            relatedTransactionMountTimestamp: 1,
            isLoop: false,
          },
        ],
      }),
    ]

    const graph = buildGraphFromConsumeChains(mixed)
    expect(graph.stats.volumeByCurrency).toEqual(
      new Map([
        [1, 12500n],
        [0, 2_500_000n],
      ]),
    )
    expect(formatVolumeByCurrency(graph.stats.volumeByCurrency)).toBe(
      '2,500,000 Au 微克 · 125.00 CNY',
    )
  })

  it('builds backend URLs for node-centered start and end queries', () => {
    expect(
      buildConsumeChainUrl('/api', {
        mode: 'start',
        nodeId: queryNodeId,
        loopStatus: 'open',
      }),
    ).toBe(`/api/consume-chains?startId=${queryNodeId}&isLoop=false&page=0&size=200`)

    expect(
      buildConsumeChainUrl('http://localhost:8080/', {
        mode: 'end',
        nodeId: 'node 2',
        loopStatus: 'looped',
      }),
    ).toBe('http://localhost:8080/consume-chains?endId=node+2&isLoop=true&page=0&size=200')

    expect(
      buildConsumeChainUrl('/api', {
        mode: 'node',
        nodeId: 'node-3',
        loopStatus: 'all',
      }),
    ).toBe('/api/consume-chains?nodeId=node-3&page=0&size=200')

    const pubkey = `02${'a'.repeat(64)}`
    expect(
      buildConsumeChainUrl('/api', {
        mode: 'start',
        nodeId: pubkey,
        loopStatus: 'all',
      }),
    ).toBe(`/api/consume-chains?startPubkey=${pubkey}&page=0&size=200`)
  })

  it('formats operational labels without losing raw ids', () => {
    expect(shortId('abcdef11-1111-4111-8111-111111111111')).toBe('ABCDEF')
    expect(formatAmount(12500, 1)).toBe('125.00 CNY')
    expect(formatAmount(2500000, 0)).toBe('2,500,000 Au 微克')
    expect(chainColor('chain-a')).toBe(chainColor('chain-a'))
    expect(chainColor('chain-a')).not.toBe(chainColor('chain-b'))
  })

  it('merges extended consume chains by chain id without duplicating existing graph rows', () => {
    const duplicate = normalizeConsumeChainResponseDTO({
      ...rawChainRows[0]!,
      consumeChain: {
        ...rawChainRows[0]!.consumeChain,
        amount: 999999,
      },
    })
    const extra = normalizeConsumeChainResponseDTO({
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
    })

    const merged = mergeConsumeChains(chainRows, [duplicate, extra])

    expect(merged.map((row) => row.consumeChain.id)).toEqual(['chain-a', 'chain-b', 'chain-c'])
    expect(merged[0]!.consumeChain.amount).toBe(12500n)
  })
})
