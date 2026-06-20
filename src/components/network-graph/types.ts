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
  onLoadChain?: (node: ChainGraphNode, mode: QueryMode) => void
  onExportNodeKey?: (node: ChainGraphNode) => void
  onRenameNode?: (node: ChainGraphNode) => void
  onDeleteNode?: (node: ChainGraphNode) => void
}

export interface ContextMenuState {
  x: number
  y: number
  position: CanvasPosition
  node?: ChainGraphNode
}
