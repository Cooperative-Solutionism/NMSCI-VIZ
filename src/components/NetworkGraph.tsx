import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { GraphAccessList } from './network-graph/GraphAccessList'
import { GraphContextMenu } from './network-graph/GraphContextMenu'
import { GraphLegend } from './network-graph/GraphLegend'
import { GraphTools } from './network-graph/GraphTools'
import type { ContextMenuState, NetworkGraphProps } from './network-graph/types'
import { useCytoscapeGraph } from './network-graph/useCytoscapeGraph'

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
  const selectedChainId = useMemo(
    () => graph.edges.find((edge) => edge.id === selectedId)?.chainId ?? null,
    [graph.edges, selectedId],
  )
  const closeMenu = useCallback(() => setMenu(null), [])
  const { containerRef, cyRef } = useCytoscapeGraph({
    graph,
    selectedId,
    selectedChainId,
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

  return (
    <div className="graph-shell" onContextMenu={(event) => event.preventDefault()}>
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
      <GraphTools onDownloadPng={handleDownloadPng} onFit={fitGraph} onZoomBy={zoomBy} />
      <GraphLegend />
    </div>
  )
}
