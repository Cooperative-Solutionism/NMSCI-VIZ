import type { Core } from 'cytoscape'
import { describe, expect, it, vi } from 'vitest'
import type { ChainGraphEdge, ChainGraphNode } from '../../lib/types'
import { syncGraphElements } from './graphSync'

describe('syncGraphElements', () => {
  it('maps every graph node state to a semantic PNG icon URL', () => {
    const add = vi.fn()
    const cy = {
      add,
      edges: () => [],
      extent: () => ({ x1: 0, y1: 0, x2: 400, y2: 300 }),
      getElementById: () => ({ nonempty: () => false }),
      nodes: () => [],
    } as unknown as Core

    syncGraphElements(cy, [
      {
        id: 'chain-a',
        label: 'Chain',
        chainCount: 1,
        volumeByCurrency: new Map(),
        kind: 'chain',
      },
      {
        id: 'flow-a',
        label: 'Flow',
        chainCount: 0,
        volumeByCurrency: new Map(),
        kind: 'local-flow',
        flowStatus: 'authorized',
      },
      {
        id: 'consume-a',
        label: 'Consume',
        chainCount: 0,
        volumeByCurrency: new Map(),
        kind: 'local-consume',
      },
    ], [])

    expect(add).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ icon: 'url("/graph-icons/node-chain.png")' }),
      }),
    )
    expect(add).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ icon: 'url("/graph-icons/node-flow-authorized.png")' }),
      }),
    )
    expect(add).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        data: expect.objectContaining({ icon: 'url("/graph-icons/node-local-consume.png")' }),
      }),
    )
  })

  it('places standalone nodes without saved positions at the current viewport center', () => {
    const add = vi.fn()
    const cy = {
      add,
      edges: () => [],
      extent: () => ({ x1: -120, y1: 40, x2: 520, y2: 360 }),
      getElementById: () => ({ nonempty: () => false }),
      nodes: () => [],
    } as unknown as Core

    syncGraphElements(cy, [
      {
        id: '03aaaaaa1111',
        label: '未注册1',
        chainCount: 0,
        volumeByCurrency: new Map(),
        kind: 'local-flow',
      } satisfies ChainGraphNode,
    ], [])

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        group: 'nodes',
        position: { x: 200, y: 200 },
      }),
    )
  })

  it('uses the prepared edge label when syncing Cytoscape data', () => {
    const add = vi.fn()
    const cy = {
      add,
      edges: () => [],
      getElementById: () => ({ nonempty: () => false }),
      nodes: () => [],
    } as unknown as Core

    syncGraphElements(cy, [], [
      {
        id: 'edge-a',
        source: 'node-a',
        target: 'node-b',
        label: '第1笔 1.00 CNY',
        amount: 100n,
        currencyType: 1,
        chainId: 'chain-a',
        status: 'open',
        color: '#0f766e',
        relatedTransactionRecord: 'record-a',
        relatedTransactionMount: 'mount-a',
        relatedTransactionMountTimestamp: 1n,
      } satisfies ChainGraphEdge,
    ])

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ label: '第1笔 1.00 CNY' }),
        group: 'edges',
      }),
    )
  })
})
