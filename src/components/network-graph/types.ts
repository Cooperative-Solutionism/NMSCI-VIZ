import type { CanvasPosition, ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../lib/types'

export interface NetworkGraphProps {
  graph: ChainGraph
  selectedId: string | null
  onSelectNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onAddFlowNode?: (position: CanvasPosition) => void
  onAddConsumeNode?: (position: CanvasPosition) => void
}

export interface ContextMenuState {
  x: number
  y: number
  position: CanvasPosition
}
