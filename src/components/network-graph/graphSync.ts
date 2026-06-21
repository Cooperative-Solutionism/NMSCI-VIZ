import type { Core, NodeSingular } from 'cytoscape'
import { flowNodeStatusLabels } from '../../lib/chainGraph'
import { deterministicOffset, type Point } from '../../lib/graphLayout'
import type { ChainGraphEdge, ChainGraphNode } from '../../lib/types'
import { graphNodeIconFor } from './graphIcons'

// 本地流转节点在画布上展示两行：名称 + 状态标签，使状态随时可见。
function nodeCanvasLabel(node: ChainGraphNode): string {
  if (node.kind === 'local-flow' && node.flowStatus) {
    return `${node.label}\n${flowNodeStatusLabels[node.flowStatus]}`
  }
  return node.label
}

export function syncGraphElements(
  cy: Core,
  nodes: ChainGraphNode[],
  edges: ChainGraphEdge[],
): void {
  syncNodes(cy, nodes, edges)
  syncEdges(cy, edges)
}

function syncNodes(cy: Core, nodes: ChainGraphNode[], edges: ChainGraphEdge[]): void {
  const nextNodeIds = new Set(nodes.map((node) => node.id))
  cy.nodes().forEach((node) => {
    if (!nextNodeIds.has(node.id())) node.remove()
  })

  for (const node of nodes) {
    const nodeData = {
      id: node.id,
      label: nodeCanvasLabel(node),
      kind: node.kind,
      flowStatus: node.flowStatus ?? null,
      icon: graphNodeIconFor(node),
    }
    const existingNode = cy.getElementById(node.id)
    if (existingNode.nonempty()) {
      existingNode.data({
        ...existingNode.data(),
        ...nodeData,
      })
      continue
    }

    cy.add({
      data: nodeData,
      group: 'nodes',
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
      label: edge.label,
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
  if (neighborPosition) {
    const offset = deterministicOffset(nodeId)
    return {
      x: neighborPosition.x + offset.x,
      y: neighborPosition.y + offset.y,
    }
  }

  const center = cy.extent()
  return {
    x: (center.x1 + center.x2) / 2,
    y: (center.y1 + center.y2) / 2,
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
