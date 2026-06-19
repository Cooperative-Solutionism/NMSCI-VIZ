import type { CanvasPosition, ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../lib/types'

export interface NetworkGraphProps {
  graph: ChainGraph
  selectedId: string | null
  onSelectNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onAddFlowNode?: (position: CanvasPosition) => void
  onAddConsumeNode?: (position: CanvasPosition) => void
  onRegisterFlowNode?: (node: ChainGraphNode) => void
  onAuthorizeFlowNode?: (node: ChainGraphNode) => void
  onGenerateRecord?: (node: ChainGraphNode) => void
  onMountRecord?: (node: ChainGraphNode) => void
}

export interface ContextMenuState {
  x: number
  y: number
  position: CanvasPosition
  // 右键命中的节点（空白画布右键时为空）。
  node?: ChainGraphNode
}
