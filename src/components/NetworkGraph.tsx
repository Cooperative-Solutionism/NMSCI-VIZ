import cytoscape, { type Core, type NodeSingular } from 'cytoscape'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { formatAmount } from '../lib/chainGraph'
import { deterministicOffset, type Point } from '../lib/graphLayout'
import { readGraphTokens } from '../lib/tokens'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../lib/types'

interface NetworkGraphProps {
  graph: ChainGraph
  selectedId: string | null
  onSelectNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
}

export function NetworkGraph({ graph, selectedId, onSelectNode, onSelectEdge }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cyRef = useRef<Core | null>(null)
  const nodeMapRef = useRef(new Map<string, ChainGraphNode>())
  const edgeMapRef = useRef(new Map<string, ChainGraphEdge>())
  const onSelectNodeRef = useRef(onSelectNode)
  const onSelectEdgeRef = useRef(onSelectEdge)

  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])
  const edgeMap = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges])
  const selectedChainId = useMemo(() => {
    if (!selectedId) return null
    return edgeMap.get(selectedId)?.chainId ?? null
  }, [edgeMap, selectedId])

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
    if (!containerRef.current) return
    const tokens = readGraphTokens()

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      minZoom: 0.35,
      maxZoom: 2.4,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': tokens.nodeBackground,
            'border-color': tokens.nodeBorder,
            'border-width': 1.4,
            color: tokens.nodeText,
            content: 'data(label)',
            'font-family': 'Inter, ui-sans-serif, system-ui',
            'font-size': 11,
            height: 48,
            'overlay-opacity': 0,
            'text-halign': 'center',
            'text-valign': 'center',
            width: 48,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': tokens.nodeSelectedBackground,
            'border-color': tokens.nodeSelectedBorder,
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            color: tokens.edgeText,
            'curve-style': 'bezier',
            'font-family': 'Inter, ui-sans-serif, system-ui',
            'font-size': 10,
            label: 'data(label)',
            'line-color': 'data(color)',
            opacity: 0.84,
            'overlay-opacity': 0,
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'target-distance-from-node': 2,
            'text-background-color': tokens.edgeLabelBackground,
            'text-background-opacity': 0.92,
            'text-background-padding': '3px',
            'text-rotation': 'autorotate',
            width: 2.5,
          },
        },
        {
          selector: 'edge.chain-dimmed',
          style: {
            opacity: 0.16,
            'text-background-opacity': 0,
            'text-opacity': 0.2,
          },
        },
        {
          selector: 'edge[status = "open"]',
          style: {
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[status = "looped"]',
          style: {
            'line-style': 'solid',
          },
        },
        {
          selector: 'edge.chain-highlight',
          style: {
            opacity: 1,
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            width: 5,
            'z-index': 20,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 6,
          },
        },
      ],
      layout: {
        name: 'preset',
      },
    })

    cy.on('tap', 'node', (event) => {
      const node = nodeMapRef.current.get(event.target.id())
      if (node) onSelectNodeRef.current(node)
    })
    cy.on('tap', 'edge', (event) => {
      const edge = edgeMapRef.current.get(event.target.id())
      if (edge) onSelectEdgeRef.current(edge)
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
    syncNodes(cy, graph.nodes, graph.edges)
    syncEdges(cy, graph.edges)

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
    if (!cy) return

    cy.elements().unselect()
    cy.edges().removeClass('chain-highlight chain-dimmed')

    if (selectedChainId) {
      cy.edges().forEach((edge) => {
        edge.toggleClass('chain-highlight', edge.data('chainId') === selectedChainId)
        edge.toggleClass('chain-dimmed', edge.data('chainId') !== selectedChainId)
      })
    }

    if (selectedId) cy.getElementById(selectedId).select()
  }, [selectedChainId, selectedId])

  return (
    <div className="graph-shell">
      <div
        ref={containerRef}
        className="graph-canvas"
        role="img"
        tabIndex={0}
        aria-label={`Consumption chain network graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges`}
      />
      <div className="sr-only graph-access-list" aria-label="Keyboard graph selection">
        <h3>Graph nodes</h3>
        {graph.nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => onSelectNode(node)}>
            Select node {node.id}
          </button>
        ))}
        <h3>Graph edges</h3>
        {graph.edges.map((edge) => (
          <button key={edge.id} type="button" onClick={() => onSelectEdge(edge)}>
            Select {edge.status} edge {edge.id}
          </button>
        ))}
      </div>
      <div className="graph-tools" aria-label="Graph controls">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() + 0.15)}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() - 0.15)}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          aria-label="Fit graph"
          title="Fit graph"
          onClick={() => cyRef.current?.fit(undefined, 48)}
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="legend">
        <span><i className="legend-line chain" />Color = consume chain</span>
        <span><i className="legend-line selected" />Selected chain</span>
        <span>Edge label = amount</span>
      </div>
    </div>
  )
}

function syncNodes(cy: Core, nodes: ChainGraphNode[], edges: ChainGraphEdge[]): void {
  const nextNodeIds = new Set(nodes.map((node) => node.id))
  cy.nodes().forEach((node) => {
    if (!nextNodeIds.has(node.id())) node.remove()
  })

  for (const node of nodes) {
    const existingNode = cy.getElementById(node.id)
    if (existingNode.nonempty()) {
      existingNode.data({
        ...existingNode.data(),
        label: node.label,
        volume: node.volume,
      })
      continue
    }

    cy.add({
      data: {
        id: node.id,
        label: node.label,
        volume: node.volume,
      },
      group: 'nodes',
      position: positionForNewNode(cy, node.id, edges),
    })
  }
}

function syncEdges(cy: Core, edges: ChainGraphEdge[]): void {
  const nextEdgeIds = new Set(edges.map((edge) => edge.id))
  cy.edges().forEach((edge) => {
    if (!nextEdgeIds.has(edge.id())) edge.remove()
  })

  for (const edge of edges) {
    const edgeData = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: formatAmount(edge.amount, edge.currencyType),
      status: edge.status,
      chainId: edge.chainId,
      color: edge.color,
    }
    const existingEdge = cy.getElementById(edge.id)
    if (existingEdge.nonempty()) {
      existingEdge.data({
        ...existingEdge.data(),
        ...edgeData,
      })
      continue
    }
    cy.add({
      data: edgeData,
      group: 'edges',
    })
  }
}

function positionForNewNode(cy: Core, nodeId: string, edges: ChainGraphEdge[]): Point {
  const neighborPosition = findNeighborPosition(cy, nodeId, edges)
  const offset = deterministicOffset(nodeId)
  if (neighborPosition) {
    return {
      x: neighborPosition.x + offset.x,
      y: neighborPosition.y + offset.y,
    }
  }

  const center = cy.extent()
  return {
    x: (center.x1 + center.x2) / 2 + offset.x,
    y: (center.y1 + center.y2) / 2 + offset.y,
  }
}

function findNeighborPosition(cy: Core, nodeId: string, edges: ChainGraphEdge[]): Point | null {
  for (const edge of edges) {
    const neighborId = edge.source === nodeId ? edge.target : edge.target === nodeId ? edge.source : null
    if (!neighborId) continue

    const neighbor = cy.getElementById(neighborId)
    if (neighbor.nonempty() && neighbor.isNode()) {
      return (neighbor as NodeSingular).position()
    }
  }
  return null
}
