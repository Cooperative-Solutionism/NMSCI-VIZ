import cytoscape, { type Core, type EdgeSingular, type NodeSingular } from 'cytoscape'
import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatAmount } from '../lib/chainGraph'
import { deterministicOffset, type Point } from '../lib/graphLayout'
import { readGraphTokens } from '../lib/tokens'
import type { CanvasPosition, ChainGraph, ChainGraphEdge, ChainGraphNode } from '../lib/types'

interface NetworkGraphProps {
  graph: ChainGraph
  selectedId: string | null
  onSelectNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onAddFlowNode?: (position: CanvasPosition) => void
  onAddConsumeNode?: (position: CanvasPosition) => void
}

interface ContextMenuState {
  x: number
  y: number
  position: CanvasPosition
}

export function NetworkGraph({
  graph,
  selectedId,
  onSelectNode,
  onSelectEdge,
  onAddFlowNode,
  onAddConsumeNode,
}: NetworkGraphProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
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
          selector: 'node[kind = "local-flow"]',
          style: {
            'background-color': tokens.localFlowBackground,
            'border-color': tokens.localFlowBorder,
            'border-width': 3,
          },
        },
        {
          selector: 'node[kind = "local-consume"]',
          style: {
            'background-color': tokens.localConsumeBackground,
            'border-color': tokens.localConsumeBorder,
            'border-width': 3,
            shape: 'round-rectangle',
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
      const node = nodeMapRef.current.get((event.target as NodeSingular).id())
      if (node) onSelectNodeRef.current(node)
    })
    cy.on('tap', 'edge', (event) => {
      const edge = edgeMapRef.current.get((event.target as EdgeSingular).id())
      if (edge) onSelectEdgeRef.current(edge)
    })
    // 任意点击关闭右键菜单。
    cy.on('tap', () => setMenu(null))
    // 右键空白处：在落点弹出"添加节点"菜单（携带 model 坐标供落点定位）。
    cy.on('cxttap', (event) => {
      if (event.target !== cy) {
        setMenu(null)
        return
      }
      const rendered = event.renderedPosition
      const model = event.position
      if (!rendered || !model) return
      setMenu({ x: rendered.x, y: rendered.y, position: { x: model.x, y: model.y } })
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

  useEffect(() => {
    if (!menu) return
    const onKey = (event: KeyboardEvent) => {
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
  }, [])

  return (
    <div className="graph-shell" onContextMenu={(event) => event.preventDefault()}>
      {/* 画布需可聚焦以供键盘用户使用；P3 将补 onKeyDown（遍历/缩放/加节点）使其成为真正的交互式 widget。 */}
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={containerRef}
        className="graph-canvas"
        role="img"
        tabIndex={0}
        aria-label={`消费链网络图谱，包含 ${graph.nodes.length} 个节点和 ${graph.edges.length} 条边`}
      />
      {/* eslint-enable jsx-a11y/no-noninteractive-tabindex */}
      {menu ? (
        <div className="graph-context-menu" role="menu" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAddFlowNode?.(menu.position)
              setMenu(null)
            }}
          >
            添加流转节点
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAddConsumeNode?.(menu.position)
              setMenu(null)
            }}
          >
            添加消费节点
          </button>
        </div>
      ) : null}
      <div className="sr-only graph-access-list" aria-label="键盘图谱选择">
        <h3>图谱节点</h3>
        {graph.nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => onSelectNode(node)}>
            选择节点 {node.id}
          </button>
        ))}
        <h3>图谱边</h3>
        {graph.edges.map((edge) => (
          <button key={edge.id} type="button" onClick={() => onSelectEdge(edge)}>
            选择{edge.status === 'looped' ? '成环' : '开放'}边 {edge.id}
          </button>
        ))}
      </div>
      <div className="graph-tools" aria-label="图谱控制">
        <button
          type="button"
          aria-label="放大"
          title="放大"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() + 0.15)}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          aria-label="缩小"
          title="缩小"
          onClick={() => cyRef.current?.zoom(cyRef.current.zoom() - 0.15)}
        >
          <ZoomOut size={16} />
        </button>
        <button
          type="button"
          aria-label="适配图谱"
          title="适配图谱"
          onClick={() => cyRef.current?.fit(undefined, 48)}
        >
          <Maximize2 size={16} />
        </button>
        <button type="button" aria-label="下载 PNG" title="下载 PNG" onClick={handleDownloadPng}>
          <Download size={16} />
        </button>
      </div>
      <div className="legend">
        <span>
          <i className="legend-line chain" />
          颜色 = 消费链
        </span>
        <span>
          <i className="legend-line selected" />
          已选链路
        </span>
        <span>边标签 = 金额</span>
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
        kind: node.kind,
      })
      continue
    }

    cy.add({
      data: {
        id: node.id,
        label: node.label,
        kind: node.kind,
      },
      group: 'nodes',
      // 本地节点用右键落点；链节点沿用邻接定位。
      position: node.position ?? positionForNewNode(cy, node.id, edges),
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
    const neighborId =
      edge.source === nodeId ? edge.target : edge.target === nodeId ? edge.source : null
    if (!neighborId) continue

    const neighbor = cy.getElementById(neighborId)
    if (neighbor.nonempty() && neighbor.isNode()) {
      return (neighbor as NodeSingular).position()
    }
  }
  return null
}
