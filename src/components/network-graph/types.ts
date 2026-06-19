import type {
  CanvasPosition,
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  QueryMode,
} from '../../lib/types'

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
  // 以该节点为端点加载消费链：'end' 前链（节点为尾）、'start' 后链（节点为头）、'node' 全部。
  onLoadChain?: (node: ChainGraphNode, mode: QueryMode) => void
}

export interface ContextMenuState {
  x: number
  y: number
  position: CanvasPosition
  // 右键命中的节点（空白画布右键时为空）。
  node?: ChainGraphNode
}
