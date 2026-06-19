import type { Core } from 'cytoscape'
import { describe, expect, it, vi } from 'vitest'
import type { ChainGraphEdge } from '../../lib/types'
import { syncGraphElements } from './graphSync'

describe('syncGraphElements', () => {
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
