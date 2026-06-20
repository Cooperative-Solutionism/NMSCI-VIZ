import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Plus, Workflow } from 'lucide-react'
import { shortId } from '../lib/chainGraph'
import type { ChainGraphNode } from '../lib/types'
import { Button } from './ui/button'
import { GraphAccessList } from './network-graph/GraphAccessList'
import { GraphContextMenu } from './network-graph/GraphContextMenu'
import { GraphLegend } from './network-graph/GraphLegend'
import { GraphSearch } from './network-graph/GraphSearch'
import { GraphTools } from './network-graph/GraphTools'
import type { GraphHighlightMode } from './network-graph/graphViewState'
import type { ContextMenuState, NetworkGraphProps } from './network-graph/types'
import { useCytoscapeGraph } from './network-graph/useCytoscapeGraph'

const emptyCanvasPosition = { x: 0, y: 0 }

export function NetworkGraph({
  graph,
  selectedId,
  onSelectNode,
  onSelectEdge,
  onAddFlowNode,
  onAddConsumeNode,
  onRegisterFlowNode,
  onAuthorizeFlowNode,
  onGenerateRecord,
  onMountRecord,
  onLoadChain,
}: NetworkGraphProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const selectedChainIds = useMemo(
    () => chainsForSelection(graph, selectedId),
    [graph, selectedId],
  )
  const cycleChainIds = useMemo(
    () =>
      new Set(
        graph.edges.filter((edge) => edge.status === 'looped').map((edge) => edge.chainId),
      ),
    [graph.edges],
  )
  const hasCycles = cycleChainIds.size > 0
  const [requestedHighlightMode, setRequestedHighlightMode] =
    useState<GraphHighlightMode>('related')
  const highlightMode: GraphHighlightMode = hasCycles ? requestedHighlightMode : 'related'

  const closeMenu = useCallback(() => setMenu(null), [])
  const { containerRef, cyRef, focusNode } = useCytoscapeGraph({
    graph,
    selectedId,
    selectedChainIds,
    cycleChainIds,
    highlightMode,
    onSelectNode,
    onSelectEdge,
    onOpenMenu: setMenu,
    onCloseMenu: closeMenu,
  })

  useEffect(() => {
    if (!menu) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    const onClick = () => setMenu(null)
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('click', onClick)
    }
  }, [menu])

  const handleDownloadPng = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const uri = cy.png({ full: true, scale: 2, bg: '#ffffff' })
    const link = document.createElement('a')
    link.href = uri
    link.download = 'nmsci-graph.png'
    link.click()
  }, [cyRef])

  const handleSearchSelect = useCallback(
    (node: ChainGraphNode) => {
      onSelectNode(node)
      focusNode(node.id)
    },
    [focusNode, onSelectNode],
  )

  const zoomBy = useCallback(
    (delta: number) => {
      const cy = cyRef.current
      if (!cy) return
      cy.zoom(cy.zoom() + delta)
    },
    [cyRef],
  )

  const fitGraph = useCallback(() => {
    cyRef.current?.fit(undefined, 48)
  }, [cyRef])

  const openMenuAtCenter = useCallback(() => {
    const cy = cyRef.current
    const container = containerRef.current
    if (!cy || !container) return
    const extent = cy.extent()
    setMenu({
      x: container.clientWidth / 2,
      y: container.clientHeight / 2,
      position: {
        x: (extent.x1 + extent.x2) / 2,
        y: (extent.y1 + extent.y2) / 2,
      },
    })
  }, [containerRef, cyRef])

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomBy(0.15)
      } else if (event.key === '-') {
        event.preventDefault()
        zoomBy(-0.15)
      } else if (event.key === '0') {
        event.preventDefault()
        fitGraph()
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault()
        openMenuAtCenter()
      } else if (event.key === 'Escape') {
        setMenu(null)
      }
    },
    [fitGraph, openMenuAtCenter, zoomBy],
  )

  const activeHighlightCount =
    highlightMode === 'cycles' ? cycleChainIds.size : selectedChainIds.size
  const selectedState = selectedId ? `选中 ${shortId(selectedId)}` : '未选择'
  const highlightState =
    highlightMode === 'cycles' ? `循环 ${cycleChainIds.size}` : `高亮链 ${activeHighlightCount}`
  const densityHint = graph.nodes.length > 100 ? '节点较多，建议使用搜索定位' : null

  return (
    <div className="graph-shell" onContextMenu={(event) => event.preventDefault()}>
      <div className="graph-statusbar" aria-label="画布状态">
        <div className="graph-statusbar__brand">
          <Workflow aria-hidden="true" />
          <strong>NMSCI 交易画布</strong>
        </div>
        <div className="graph-statusbar__meta">
          <span>节点 {graph.nodes.length}</span>
          <span>连接 {graph.edges.length}</span>
          <span>{highlightState}</span>
          <span>{selectedState}</span>
          {densityHint ? <span>{densityHint}</span> : null}
        </div>
      </div>

      {/* Cytoscape owns this custom canvas widget; keyboard affordances are wired below. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={containerRef}
        className="graph-canvas"
        role="application"
        aria-roledescription="交互式网络图谱"
        tabIndex={0}
        aria-label={`消费链网络图谱，包含 ${graph.nodes.length} 个节点和 ${graph.edges.length} 条边`}
        onKeyDown={handleCanvasKeyDown}
      />
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <GraphSearch nodes={graph.nodes} onSelectNode={handleSearchSelect} />

      {graph.nodes.length === 0 ? (
        <div className="graph-empty-state" aria-label="空画布">
          <div className="graph-empty-state__mark">
            <Workflow aria-hidden="true" />
          </div>
          <h2>空白交易画布</h2>
          <div className="graph-empty-state__actions">
            <Button
              type="button"
              variant="default"
              onClick={() => onAddFlowNode?.(emptyCanvasPosition)}
            >
              <Plus aria-hidden="true" />
              添加流转节点
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onAddConsumeNode?.(emptyCanvasPosition)}
            >
              <Plus aria-hidden="true" />
              添加消费节点
            </Button>
          </div>
        </div>
      ) : null}

      {menu ? (
        <GraphContextMenu
          menu={menu}
          onAddConsumeNode={onAddConsumeNode}
          onAddFlowNode={onAddFlowNode}
          onRegisterFlowNode={onRegisterFlowNode}
          onAuthorizeFlowNode={onAuthorizeFlowNode}
          onGenerateRecord={onGenerateRecord}
          onMountRecord={onMountRecord}
          onLoadChain={onLoadChain}
          onClose={closeMenu}
        />
      ) : null}
      <GraphAccessList graph={graph} onSelectEdge={onSelectEdge} onSelectNode={onSelectNode} />
      <GraphTools
        hasCycles={hasCycles}
        highlightMode={highlightMode}
        onDownloadPng={handleDownloadPng}
        onFit={fitGraph}
        onHighlightModeChange={setRequestedHighlightMode}
        onZoomBy={zoomBy}
      />
      <GraphLegend />
    </div>
  )
}

function chainsForSelection(
  graph: NetworkGraphProps['graph'],
  selectedId: string | null,
): Set<string> {
  if (!selectedId) return new Set()

  const selectedEdge = graph.edges.find((edge) => edge.id === selectedId)
  if (selectedEdge) return new Set([selectedEdge.chainId])

  if (!graph.nodes.some((node) => node.id === selectedId)) return new Set()

  const chainIds = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.source === selectedId || edge.target === selectedId) {
      chainIds.add(edge.chainId)
    }
  }
  return chainIds
}
