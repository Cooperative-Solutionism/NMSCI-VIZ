import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChainGraph } from '../lib/types'
import { NetworkGraph } from './NetworkGraph'
import { useCytoscapeGraph } from './network-graph/useCytoscapeGraph'

vi.mock('./network-graph/useCytoscapeGraph', () => ({
  useCytoscapeGraph: vi.fn(() => ({
    containerRef: { current: null },
    cyRef: { current: null },
  })),
}))

const baseGraph: ChainGraph = {
  nodes: [
    node('node-a'),
    node('node-b'),
    node('node-c'),
    node('node-d'),
    node('node-e'),
  ],
  edges: [
    edge('edge-a1', 'node-a', 'node-b', 'chain-a'),
    edge('edge-a2', 'node-b', 'node-c', 'chain-a'),
    edge('edge-b1', 'node-d', 'node-b', 'chain-b'),
    edge('edge-c1', 'node-d', 'node-e', 'chain-c'),
  ],
  stats: {
    totalChains: 3,
    loopedChains: 0,
    openChains: 3,
    volumeByCurrency: new Map([[1, 400n]]),
  },
}

describe('NetworkGraph selection highlighting', () => {
  it('passes every chain containing the selected node to the Cytoscape hook', () => {
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId="node-b"
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    const params = vi.mocked(useCytoscapeGraph).mock.calls[0]?.[0] as
      | { selectedChainIds?: Set<string> }
      | undefined

    expect(Array.from(params?.selectedChainIds ?? []).sort()).toEqual(['chain-a', 'chain-b'])
  })
})

function node(id: string): ChainGraph['nodes'][number] {
  return {
    id,
    label: id,
    chainCount: 1,
    kind: 'chain',
    volumeByCurrency: new Map([[1, 100n]]),
  }
}

function edge(
  id: string,
  source: string,
  target: string,
  chainId: string,
): ChainGraph['edges'][number] {
  return {
    id,
    source,
    target,
    chainId,
    label: '1.00 CNY',
    amount: 100n,
    currencyType: 1,
    status: 'open',
    color: '#0f766e',
    relatedTransactionRecord: 'record',
    relatedTransactionMount: 'mount',
    relatedTransactionMountTimestamp: 1n,
  }
}
