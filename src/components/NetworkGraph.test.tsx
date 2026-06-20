import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainGraph } from '../lib/types'
import { NetworkGraph } from './NetworkGraph'
import { useCytoscapeGraph } from './network-graph/useCytoscapeGraph'

const hookMocks = vi.hoisted(() => ({
  focusNode: vi.fn(),
}))

vi.mock('./network-graph/useCytoscapeGraph', () => ({
  useCytoscapeGraph: vi.fn(() => ({
    containerRef: { current: null },
    cyRef: { current: null },
    focusNode: hookMocks.focusNode,
  })),
}))

afterEach(cleanup)

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
    edge('edge-c1', 'node-d', 'node-e', 'chain-c', 'looped'),
  ],
  stats: {
    totalChains: 3,
    loopedChains: 0,
    openChains: 3,
    volumeByCurrency: new Map([[1, 400n]]),
  },
}

describe('NetworkGraph selection highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a canvas status bar with graph counts and selection state', () => {
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId="node-b"
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    expect(screen.getByText('NMSCI 交易画布')).toBeInTheDocument()
    expect(screen.getByText('节点 5')).toBeInTheDocument()
    expect(screen.getByText('连接 4')).toBeInTheDocument()
    expect(screen.getByText('选中 NODE-B')).toBeInTheDocument()
  })

  it('offers direct add actions on an empty canvas', () => {
    const onAddFlowNode = vi.fn()
    const onAddConsumeNode = vi.fn()

    render(
      <NetworkGraph
        graph={{ ...baseGraph, nodes: [], edges: [] }}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
        onAddFlowNode={onAddFlowNode}
        onAddConsumeNode={onAddConsumeNode}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '添加流转节点' }))
    fireEvent.click(screen.getByRole('button', { name: '添加消费节点' }))

    expect(screen.getByText('空白交易画布')).toBeInTheDocument()
    expect(onAddFlowNode).toHaveBeenCalledWith({ x: 0, y: 0 })
    expect(onAddConsumeNode).toHaveBeenCalledWith({ x: 0, y: 0 })
  })

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

  it('searches and focuses the first matching node', () => {
    const onSelectNode = vi.fn()
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={onSelectNode}
      />,
    )

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'node-c' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定位节点' }))

    expect(onSelectNode).toHaveBeenCalledWith(baseGraph.nodes[2])
    expect(hookMocks.focusNode).toHaveBeenCalledWith('node-c')
  })

  it('switches to cycle highlighting when cycles are available', () => {
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '循环链路' }))

    const params = vi.mocked(useCytoscapeGraph).mock.calls.at(-1)?.[0] as
      | { cycleChainIds?: Set<string>; highlightMode?: string }
      | undefined

    expect(params?.highlightMode).toBe('cycles')
    expect(Array.from(params?.cycleChainIds ?? [])).toEqual(['chain-c'])
  })

  it('disables cycle highlighting when no cycle edges exist', () => {
    render(
      <NetworkGraph
        graph={{
          ...baseGraph,
          edges: baseGraph.edges.map((item) => ({ ...item, status: 'open' as const })),
        }}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '循环链路' })).toBeDisabled()
  })

  it('shows selected short id and density guidance for large graphs', () => {
    const largeGraph: ChainGraph = {
      ...baseGraph,
      nodes: Array.from({ length: 101 }, (_, index) => node(`node-${index}`)),
    }

    render(
      <NetworkGraph
        graph={largeGraph}
        selectedId="node-100"
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    expect(screen.getByText('选中 NODE-1')).toBeInTheDocument()
    expect(screen.getByText('节点较多，建议使用搜索定位')).toBeInTheDocument()
  })

  it('stacks graph overlays in the narrow viewport responsive rules', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/responsive.css'), 'utf8')
    const mobileCss = css.slice(css.indexOf('@media (max-width: 520px)'))

    expect(mobileCss).toMatch(
      /\.graph-statusbar,\s*\.graph-search,\s*\.graph-tools\s*\{[^}]*position:\s*relative;/s,
    )
    expect(mobileCss).toMatch(
      /\.graph-statusbar,\s*\.graph-search,\s*\.graph-tools\s*\{[^}]*top:\s*auto;/s,
    )
    expect(mobileCss).toMatch(/\.graph-search\s*\{[^}]*margin-top:\s*8px;/s)
    expect(mobileCss).toMatch(/\.graph-tools\s*\{[^}]*width:\s*max-content;/s)
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
  status: ChainGraph['edges'][number]['status'] = 'open',
): ChainGraph['edges'][number] {
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
