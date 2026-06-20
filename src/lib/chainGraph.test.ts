import { describe, expect, it } from 'vitest'
import { normalizeConsumeChainResponseDTO } from '@nmsci/sdk'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  chainColor,
  flowNodeCanvasStatus,
  formatAmount,
  formatVolumeByCurrency,
  mergeConsumeChains,
  mergeLocalNodes,
  refreshConsumeChains,
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

  it('numbers edges with the same source and target by mount time across consume chains', () => {
    const graph = buildGraphFromConsumeChains([
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-newer',
          start: 'node-a',
          end: 'node-c',
          amount: 400,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 40,
        },
        consumeChainEdges: [
          {
            id: 'edge-newer-same-endpoints',
            source: 'node-a',
            target: 'node-b',
            amount: 300,
            currencyType: 1,
            chain: 'chain-newer',
            relatedTransactionRecord: 'r3',
            relatedTransactionMount: 'm3',
            relatedTransactionMountTimestamp: 30,
            isLoop: false,
          },
          {
            id: 'edge-other-endpoints',
            source: 'node-b',
            target: 'node-c',
            amount: 100,
            currencyType: 1,
            chain: 'chain-newer',
            relatedTransactionRecord: 'r1',
            relatedTransactionMount: 'm1',
            relatedTransactionMountTimestamp: 40,
            isLoop: false,
          },
        ],
      }),
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-older',
          start: 'node-a',
          end: 'node-b',
          amount: 200,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 20,
        },
        consumeChainEdges: [
          {
            id: 'edge-older-same-endpoints',
            source: 'node-a',
            target: 'node-b',
            amount: 200,
            currencyType: 1,
            chain: 'chain-older',
            relatedTransactionRecord: 'r2',
            relatedTransactionMount: 'm2',
            relatedTransactionMountTimestamp: 20,
            isLoop: false,
          },
        ],
      }),
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-reverse',
          start: 'node-b',
          end: 'node-a',
          amount: 500,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 40,
        },
        consumeChainEdges: [
          {
            id: 'edge-reverse-direction',
            source: 'node-b',
            target: 'node-a',
            amount: 500,
            currencyType: 1,
            chain: 'chain-reverse',
            relatedTransactionRecord: 'r4',
            relatedTransactionMount: 'm4',
            relatedTransactionMountTimestamp: 40,
            isLoop: false,
          },
        ],
      }),
    ])

    const labelsById = new Map(graph.edges.map((edge) => [edge.id, edge.label]))
    expect(labelsById.get('edge-older-same-endpoints')).toBe('第1笔 2.00 CNY')
    expect(labelsById.get('edge-newer-same-endpoints')).toBe('第2笔 3.00 CNY')
    expect(labelsById.get('edge-other-endpoints')).toBe('第1笔 1.00 CNY')
    expect(labelsById.get('edge-reverse-direction')).toBe('第1笔 5.00 CNY')
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
    expect(flow?.flowStatus).toBe('unregistered')
    expect(merged.nodes.find((node) => node.id === 'pk-registered-flow')?.label).toBe('REGIST')
    expect(merged.nodes.find((node) => node.id === 'pk-consume')?.flowStatus).toBeUndefined()
    const consume = merged.nodes.find((node) => node.id === 'pk-consume')
    expect(consume?.kind).toBe('local-consume')
    expect(consume?.label).toBe('BRAVO-')

    // 命中已有链节点 id 的本地节点 → 原地升级为本地节点（不新增、保留链上吞吐/计数）。
    const chainNode = graph.nodes[0]!
    const upgraded = mergeLocalNodes(
      graph,
      [{ id: 'duplicate-flow-node', publicKeyHex: chainNode.id, label: 'X', position: { x: 7, y: 9 } }],
      [],
    )
    expect(upgraded.nodes.length).toBe(before)
    const upgradedNode = upgraded.nodes.find((node) => node.id === chainNode.id)
    expect(upgradedNode?.kind).toBe('local-flow')
    expect(upgradedNode?.label).toBe('未注册1')
    // 链上吞吐与计数从被升级的链节点保留下来。
    expect(upgradedNode?.chainCount).toBe(chainNode.chainCount)
    expect(upgradedNode?.volumeByCurrency).toEqual(chainNode.volumeByCurrency)
    // 被升级的链节点本身无落点，应回退到本地 ref 的画布落点。
    expect(upgradedNode?.position).toEqual({ x: 7, y: 9 })
  })

  it('upgrades both endpoints when one chain links two local pubkeys', () => {
    const pkA = `02${'a'.repeat(64)}`
    const pkB = `03${'b'.repeat(64)}`
    const graph = buildGraphFromConsumeChains([
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-x',
          start: pkA,
          end: pkB,
          amount: 4000,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 1,
        },
        consumeChainEdges: [
          {
            id: 'e1',
            source: pkA,
            target: pkB,
            amount: 4000,
            currencyType: 1,
            chain: 'chain-x',
            relatedTransactionRecord: 'r',
            relatedTransactionMount: 'm',
            relatedTransactionMountTimestamp: 1,
            isLoop: false,
          },
        ],
      }),
    ])
    const before = graph.nodes.length

    const merged = mergeLocalNodes(
      graph,
      [{ id: 'flow-a', publicKeyHex: pkA, registration: { id: 'reg-a', status: 'sent' } }],
      [{ id: 'consume-b', publicKeyHex: pkB }],
    )

    // 两个端点都被原地升级：不新增节点，各自带上正确的本地类型与链上计数。
    expect(merged.nodes.length).toBe(before)
    expect(merged.nodes.filter((node) => node.id === pkA)).toHaveLength(1)
    expect(merged.nodes.filter((node) => node.id === pkB)).toHaveLength(1)
    expect(merged.nodes.find((node) => node.id === pkA)?.kind).toBe('local-flow')
    expect(merged.nodes.find((node) => node.id === pkB)?.kind).toBe('local-consume')
    expect(merged.nodes.find((node) => node.id === pkA)?.chainCount).toBeGreaterThan(0)
    expect(merged.nodes.find((node) => node.id === pkB)?.chainCount).toBeGreaterThan(0)
  })

  it('appends only the flow node when a standalone flow and consume share a pubkey (flow priority)', () => {
    const graph = buildGraphFromConsumeChains([])
    const shared = 'pk-shared'

    const merged = mergeLocalNodes(
      graph,
      [{ id: 'shared-flow', publicKeyHex: shared, registration: { id: 'reg-s', status: 'sent' } }],
      [{ id: 'shared-consume', publicKeyHex: shared }],
    )

    // 同一身份只入图一次，且为流转节点（流转优先）。
    const matches = merged.nodes.filter((node) => node.id === shared)
    expect(matches).toHaveLength(1)
    expect(matches[0]!.kind).toBe('local-flow')
    expect(matches[0]!.flowStatus).toBe('registered')
  })

  it('upgrades a chain node that shares a local pubkey instead of drawing a second node', () => {
    const pubkey = `02${'a'.repeat(64)}`
    const graph = buildGraphFromConsumeChains([
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-x',
          start: pubkey,
          end: '99999999-9999-4999-8999-999999999999',
          amount: 4000,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 1,
        },
        consumeChainEdges: [
          {
            id: 'edge-x1',
            source: pubkey,
            target: '99999999-9999-4999-8999-999999999999',
            amount: 4000,
            currencyType: 1,
            chain: 'chain-x',
            relatedTransactionRecord: 'r',
            relatedTransactionMount: 'm',
            relatedTransactionMountTimestamp: 1,
            isLoop: false,
          },
        ],
      }),
    ])
    const before = graph.nodes.length

    const merged = mergeLocalNodes(
      graph,
      [{ id: 'local-flow-node', publicKeyHex: pubkey, registration: { id: 'reg-1', status: 'sent' } }],
      [],
    )

    // 同一节点：不新增；链节点升级为本地流转节点并带上状态。
    expect(merged.nodes.length).toBe(before)
    const node = merged.nodes.find((item) => item.id === pubkey)
    expect(node?.kind).toBe('local-flow')
    expect(node?.flowStatus).toBe('registered')
    expect(node?.chainCount).toBeGreaterThan(0)
  })

  it('rewrites a chain node that uses the local flow registration id onto the local pubkey node', () => {
    const pubkey = `02${'a'.repeat(64)}`
    const registrationId = 'f25682aa-1111-4111-8111-111111111111'
    const otherNodeId = '99999999-9999-4999-8999-999999999999'
    const graph = buildGraphFromConsumeChains([
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-reg',
          start: otherNodeId,
          end: registrationId,
          amount: 4000,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 1,
        },
        consumeChainEdges: [
          {
            id: 'edge-reg',
            source: otherNodeId,
            target: registrationId,
            amount: 4000,
            currencyType: 1,
            chain: 'chain-reg',
            relatedTransactionRecord: 'r',
            relatedTransactionMount: 'm',
            relatedTransactionMountTimestamp: 1,
            isLoop: false,
          },
        ],
      }),
    ])

    const merged = mergeLocalNodes(
      graph,
      [
        {
          id: 'local-flow-node',
          publicKeyHex: pubkey,
          registration: { id: registrationId, status: 'sent' },
          authorizations: [{ status: 'sent' }],
        },
      ],
      [],
    )

    expect(merged.nodes.map((node) => node.id).sort()).toEqual([otherNodeId, pubkey].sort())
    expect(merged.nodes.find((node) => node.id === registrationId)).toBeUndefined()
    const localNode = merged.nodes.find((node) => node.id === pubkey)
    expect(localNode?.kind).toBe('local-flow')
    expect(localNode?.label).toBe('F25682')
    expect(localNode?.flowStatus).toBe('authorized')
    expect(localNode?.chainCount).toBeGreaterThan(0)
    expect(merged.edges[0]).toMatchObject({ source: otherNodeId, target: pubkey })
  })

  it('renumbers edges after local aliases rewrite endpoints onto the same source and target', () => {
    const pubkey = `02${'a'.repeat(64)}`
    const registrationId = 'f25682aa-1111-4111-8111-111111111111'
    const sourceNodeId = '99999999-9999-4999-8999-999999999999'
    const graph = buildGraphFromConsumeChains([
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-newer',
          start: sourceNodeId,
          end: registrationId,
          amount: 200,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 20,
        },
        consumeChainEdges: [
          {
            id: 'edge-registration-target',
            source: sourceNodeId,
            target: registrationId,
            amount: 200,
            currencyType: 1,
            chain: 'chain-newer',
            relatedTransactionRecord: 'r2',
            relatedTransactionMount: 'm2',
            relatedTransactionMountTimestamp: 20,
            isLoop: false,
          },
        ],
      }),
      normalizeConsumeChainResponseDTO({
        consumeChain: {
          id: 'chain-older',
          start: sourceNodeId,
          end: pubkey,
          amount: 100,
          currencyType: 1,
          isLoop: false,
          tailMountTimestamp: 10,
        },
        consumeChainEdges: [
          {
            id: 'edge-pubkey-target',
            source: sourceNodeId,
            target: pubkey,
            amount: 100,
            currencyType: 1,
            chain: 'chain-older',
            relatedTransactionRecord: 'r1',
            relatedTransactionMount: 'm1',
            relatedTransactionMountTimestamp: 10,
            isLoop: false,
          },
        ],
      }),
    ])

    const merged = mergeLocalNodes(
      graph,
      [{ id: 'local-flow-node', publicKeyHex: pubkey, registration: { id: registrationId } }],
      [],
    )
    const labelsById = new Map(merged.edges.map((edge) => [edge.id, edge.label]))

    expect(merged.edges.map((edge) => [edge.source, edge.target])).toEqual([
      [sourceNodeId, pubkey],
      [sourceNodeId, pubkey],
    ])
    expect(labelsById.get('edge-pubkey-target')).toBe('第1笔 1.00 CNY')
    expect(labelsById.get('edge-registration-target')).toBe('第2笔 2.00 CNY')
  })

  it('only appends standalone local nodes that are explicitly added to the canvas', () => {
    const graph = buildGraphFromConsumeChains([])
    const flowRefs = [
      { id: 'on-canvas', publicKeyHex: 'pk-on-canvas', label: 'On' },
      { id: 'off-canvas', publicKeyHex: 'pk-off-canvas', label: 'Off' },
    ]

    const merged = mergeLocalNodes(graph, flowRefs, [], new Set(['pk-on-canvas']))

    expect(merged.nodes.map((node) => node.id)).toEqual(['pk-on-canvas'])
  })

  it('derives flow-node canvas status from registration and authorizations', () => {
    expect(flowNodeCanvasStatus({ id: 'a', publicKeyHex: 'pk-a' })).toBe('unregistered')
    expect(
      flowNodeCanvasStatus({
        id: 'b',
        publicKeyHex: 'pk-b',
        registration: { id: 'reg-b', status: 'failed' },
      }),
    ).toBe('failed')
    expect(
      flowNodeCanvasStatus({
        id: 'c',
        publicKeyHex: 'pk-c',
        registration: { id: 'reg-c', status: 'sent' },
      }),
    ).toBe('registered')
    expect(
      flowNodeCanvasStatus({
        id: 'd',
        publicKeyHex: 'pk-d',
        registration: { id: 'reg-d', status: 'sent' },
        authorizations: [{ status: 'sent' }],
      }),
    ).toBe('authorized')
  })

  it('tags merged local flow nodes with their canvas status', () => {
    const graph = buildGraphFromConsumeChains([])
    const merged = mergeLocalNodes(
      graph,
      [
        {
          id: 'authorized-flow',
          publicKeyHex: 'pk-authorized',
          registration: { id: 'reg-x', status: 'sent' },
          authorizations: [{ status: 'sent' }],
        },
      ],
      [],
    )
    expect(merged.nodes.find((node) => node.id === 'pk-authorized')?.flowStatus).toBe('authorized')
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
        page: 1,
        size: 40,
      }),
    ).toBe(`/api/consume-chains?startId=${queryNodeId}&isLoop=false&page=1&size=40`)

    expect(
      buildConsumeChainUrl('http://localhost:8080/', {
        mode: 'end',
        nodeId: 'node 2',
        loopStatus: 'looped',
        page: 2,
        size: 25,
      }),
    ).toBe('http://localhost:8080/consume-chains?endId=node+2&isLoop=true&page=2&size=25')

    expect(
      buildConsumeChainUrl('/api', {
        mode: 'node',
        nodeId: 'node-3',
        loopStatus: 'all',
        page: 0,
        size: 25,
      }),
    ).toBe('/api/consume-chains?nodeId=node-3&page=0&size=25')

    const pubkey = `02${'a'.repeat(64)}`
    expect(
      buildConsumeChainUrl('/api', {
        mode: 'start',
        nodeId: pubkey,
        loopStatus: 'all',
        page: 0,
        size: 25,
      }),
    ).toBe(`/api/consume-chains?startPubkey=${pubkey}&page=0&size=25`)
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

  it('refreshes consume chains by replacing matching chain id rows', () => {
    const refreshed = normalizeConsumeChainResponseDTO({
      ...rawChainRows[0]!,
      consumeChain: {
        ...rawChainRows[0]!.consumeChain,
        amount: 999999,
      },
      consumeChainEdges: rawChainRows[0]!.consumeChainEdges.map((edge) => ({
        ...edge,
        id: 'edge-a-refreshed',
      })),
    })

    const refreshedRows = refreshConsumeChains(chainRows, [refreshed])

    expect(refreshedRows.map((row) => row.consumeChain.id)).toEqual(['chain-a', 'chain-b'])
    expect(refreshedRows[0]!.consumeChain.amount).toBe(999999n)
    expect(refreshedRows[0]!.consumeChainEdges[0]!.id).toBe('edge-a-refreshed')
  })
})
