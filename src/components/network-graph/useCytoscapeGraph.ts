import cytoscape, { type Core, type EdgeSingular, type NodeSingular } from 'cytoscape'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { readGraphTokens } from '../../lib/tokens'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../lib/types'
import { cycleEndpointIds, highlightedChainsForMode } from './graphHighlight'
import { createGraphStyle } from './graphStyle'
import { syncGraphElements } from './graphSync'
import type { GraphHighlightMode, GraphViewState } from './graphViewState'
import type { ContextMenuState } from './types'

interface UseCytoscapeGraphParams {
  graph: ChainGraph
  selectedId: string | null
  selectedChainIds: ReadonlySet<string>
  cycleChainIds?: ReadonlySet<string>
  highlightMode?: GraphHighlightMode
  initialViewState?: GraphViewState
  onSelectNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onOpenMenu: (menu: ContextMenuState) => void
  onCloseMenu: () => void
  onViewChange?: (view: Pick<GraphViewState, 'zoom' | 'pan'>) => void
}

const emptyChainIds: ReadonlySet<string> = new Set()

export function useCytoscapeGraph({
  graph,
  selectedId,
  selectedChainIds,
  cycleChainIds = emptyChainIds,
  highlightMode = 'related',
  initialViewState,
  onSelectNode,
  onSelectEdge,
  onOpenMenu,
  onCloseMenu,
  onViewChange,
}: UseCytoscapeGraphParams) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const nodeMapRef = useRef(new Map<string, ChainGraphNode>())
  const edgeMapRef = useRef(new Map<string, ChainGraphEdge>())
  const onSelectNodeRef = useRef(onSelectNode)
  const onSelectEdgeRef = useRef(onSelectEdge)
  const onOpenMenuRef = useRef(onOpenMenu)
  const onCloseMenuRef = useRef(onCloseMenu)
  const onViewChangeRef = useRef(onViewChange)
  const initialViewAppliedRef = useRef(false)

  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])
  const edgeMap = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges])

  useEffect(() => {
    nodeMapRef.current = nodeMap
  }, [nodeMap])

  useEffect(() => {
    edgeMapRef.current = edgeMap
  }, [edgeMap])

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode
  }, [onSelectNode])

  useEffect(() => {
    onSelectEdgeRef.current = onSelectEdge
  }, [onSelectEdge])

  useEffect(() => {
    onOpenMenuRef.current = onOpenMenu
  }, [onOpenMenu])

  useEffect(() => {
    onCloseMenuRef.current = onCloseMenu
  }, [onCloseMenu])

  useEffect(() => {
    onViewChangeRef.current = onViewChange
  }, [onViewChange])

  useEffect(() => {
    if (!containerRef.current) return
    const tokens = readGraphTokens()

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      minZoom: 0.35,
      maxZoom: 2.4,
      style: createGraphStyle(tokens),
      layout: {
        name: 'preset',
      },
    })

    cy.on('tap', 'node', (event) => {
      const node = nodeMapRef.current.get((event.target as NodeSingular).id())
      if (node) onSelectNodeRef.current(node)
    })
    cy.on('tap', 'edge', (event) => {
      const edge = edgeMapRef.current.get((event.target as EdgeSingular).id())
      if (edge) onSelectEdgeRef.current(edge)
    })
    cy.on('tap', () => onCloseMenuRef.current())
    cy.on('cxttap', (event) => {
      const rendered = event.renderedPosition
      const model = event.position
      if (!rendered || !model) return
      // 空白画布右键 → 添加节点菜单；节点右键 → 该节点的操作菜单；其余（边）关闭菜单。
      if (event.target === cy) {
        onOpenMenuRef.current({
          x: rendered.x,
          y: rendered.y,
          position: { x: model.x, y: model.y },
        })
        return
      }
      const target = event.target as NodeSingular
      if (typeof target.isNode === 'function' && target.isNode()) {
        const node = nodeMapRef.current.get(target.id())
        if (node) {
          onOpenMenuRef.current({
            x: rendered.x,
            y: rendered.y,
            position: { x: model.x, y: model.y },
            node,
          })
          return
        }
      }
      onCloseMenuRef.current()
    })

    cyRef.current = cy
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    const wasEmpty = cy.elements().empty()
    syncGraphElements(cy, graph.nodes, graph.edges)

    if (wasEmpty && graph.nodes.length > 0) {
      cy.layout({
        name: 'cose',
        animate: false,
        fit: true,
        padding: 56,
        nodeRepulsion: 9500,
        idealEdgeLength: 132,
      }).run()
    }
  }, [graph.edges, graph.nodes])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !initialViewState || initialViewAppliedRef.current) return
    initialViewAppliedRef.current = true
    cy.zoom(initialViewState.zoom)
    cy.pan(initialViewState.pan)
  }, [graph.edges.length, graph.nodes.length, initialViewState])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    let timeoutId: number | undefined
    const reportView = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        onViewChangeRef.current?.({
          zoom: cy.zoom(),
          pan: cy.pan(),
        })
      }, 120)
    }

    cy.on('pan zoom', reportView)
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      cy.off('pan zoom', reportView)
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().unselect()
    cy.edges().removeClass('chain-highlight chain-dimmed cycle-highlight')
    cy.nodes().removeClass('cycle-endpoint')

    const activeChainIds = highlightedChainsForMode(
      highlightMode,
      selectedChainIds,
      cycleChainIds,
    )

    if (activeChainIds.size > 0) {
      cy.edges().forEach((edge) => {
        const { chainId } = edge.data() as { chainId?: unknown }
        const highlighted = typeof chainId === 'string' && activeChainIds.has(chainId)
        edge.toggleClass('chain-highlight', highlighted)
        edge.toggleClass('chain-dimmed', !highlighted)
        edge.toggleClass('cycle-highlight', highlightMode === 'cycles' && highlighted)
      })
    }

    if (highlightMode === 'cycles') {
      const endpointIds = cycleEndpointIds(graph.edges, cycleChainIds)
      endpointIds.forEach((nodeId) => {
        cy.getElementById(nodeId).addClass('cycle-endpoint')
      })
    }

    if (selectedId) cy.getElementById(selectedId).select()
  }, [cycleChainIds, graph.edges, highlightMode, selectedChainIds, selectedId])

  const focusNode = useCallback((nodeId: string) => {
    const cy = cyRef.current
    if (!cy) return
    const target = cy.getElementById(nodeId)
    if (target.empty()) return

    cy.animate(
      {
        center: { eles: target },
        zoom: Math.max(cy.zoom(), 1.1),
      },
      {
        duration: 220,
      },
    )
  }, [])

  return { containerRef, cyRef, focusNode }
}
