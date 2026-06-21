import type {
  CanvasPosition,
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  QueryMode,
} from '../../lib/types'

export interface NetworkGraphProps {
  graph: ChainGraph
  // 总计模式开关：由 App/GraphPanel 注入；单测直接渲染 NetworkGraph 时可省略（默认关闭）。
  aggregateMode?: boolean
  onAggregateModeChange?: (aggregate: boolean) => void
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
  onClearCanvas?: () => void
  onExportNodeKey?: (node: ChainGraphNode) => void
  onRenameNode?: (node: ChainGraphNode) => void
  onDeleteNode?: (node: ChainGraphNode) => void
  mountPickActive?: boolean
  onCancelMountPick?: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  position: CanvasPosition
  node?: ChainGraphNode
}
