import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { edgeColor, formatAmount } from '../lib/chainGraph'
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
  const nodeMap = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])
  const edgeMap = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges])

  const elements = useMemo<ElementDefinition[]>(() => [
    ...graph.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        volume: node.volume,
      },
    })),
    ...graph.edges.map((edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: formatAmount(edge.amount, edge.currencyType),
        status: edge.status,
        color: edgeColor(edge.status),
      },
    })),
  ], [graph.edges, graph.nodes])

  useEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.35,
      maxZoom: 2.4,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#f8fafc',
            'border-color': '#b9c6d3',
            'border-width': 1.4,
            color: '#16202a',
            content: 'data(label)',
            'font-family': 'Inter, ui-sans-serif, system-ui',
            'font-size': 11,
            height: 48,
            'label': 'data(label)',
            'overlay-opacity': 0,
            'text-valign': 'center',
            'text-halign': 'center',
            width: 48,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'background-color': '#effdfa',
            'border-color': '#08776c',
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'bezier',
            'line-color': 'data(color)',
            'target-arrow-color': 'data(color)',
            'target-arrow-shape': 'triangle',
            'target-distance-from-node': 2,
            width: 2.4,
            opacity: 0.9,
            label: 'data(label)',
            color: '#334155',
            'font-family': 'Inter, ui-sans-serif, system-ui',
            'font-size': 10,
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.92,
            'text-background-padding': '3px',
            'text-rotation': 'autorotate',
            'overlay-opacity': 0,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            width: 4,
            'line-color': '#063f3a',
            'target-arrow-color': '#063f3a',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        fit: true,
        padding: 56,
        nodeRepulsion: 9500,
        idealEdgeLength: 132,
      },
    })

    cy.on('tap', 'node', (event) => {
      const node = nodeMap.get(event.target.id())
      if (node) onSelectNode(node)
    })
    cy.on('tap', 'edge', (event) => {
      const edge = edgeMap.get(event.target.id())
      if (edge) onSelectEdge(edge)
    })

    cyRef.current = cy
    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [edgeMap, elements, nodeMap, onSelectEdge, onSelectNode])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    cy.elements().unselect()
    if (selectedId) cy.getElementById(selectedId).select()
  }, [selectedId])

  return (
    <div className="graph-shell">
      <div ref={containerRef} className="graph-canvas" aria-label="Consumption chain network graph" />
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
        <span><i className="legend-line looped" />Looped chain</span>
        <span><i className="legend-line open" />Open chain</span>
        <span>Amounts shown per edge</span>
      </div>
    </div>
  )
}
