import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '../../../components'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode, QueryMode } from '../../../lib/types'

const NetworkGraph = lazy(() =>
  import('../../../components/NetworkGraph').then((module) => ({ default: module.NetworkGraph })),
)

export function GraphPanel({
  canvasGraph,
  aggregateMode,
  onAggregateModeChange,
  loading,
  onAddConsumeNode,
  onAddFlowNode,
  onRegisterFlowNode,
  onAuthorizeFlowNode,
  onGenerateRecord,
  onMountRecord,
  onLoadChain,
  onClearCanvas,
  onExportNodeKey,
  onRenameNode,
  onDeleteNode,
  onSelectEdge,
  onSelectNode,
  mountPickActive,
  onCancelMountPick,
  selectedId,
}: {
  canvasGraph: ChainGraph
  aggregateMode: boolean
  onAggregateModeChange: (aggregate: boolean) => void
  loading: boolean
  onAddConsumeNode: (position?: { x: number; y: number }) => void
  onAddFlowNode: (position?: { x: number; y: number }) => void
  onRegisterFlowNode: (node: ChainGraphNode) => void
  onAuthorizeFlowNode: (node: ChainGraphNode) => void
  onGenerateRecord: (node: ChainGraphNode) => void
  onMountRecord: (node: ChainGraphNode) => void
  onLoadChain: (node: ChainGraphNode, mode: QueryMode) => void
  onClearCanvas: () => void
  onExportNodeKey: (node: ChainGraphNode) => void
  onRenameNode: (node: ChainGraphNode) => void
  onDeleteNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onSelectNode: (node: ChainGraphNode) => void
  mountPickActive: boolean
  onCancelMountPick: () => void
  selectedId: string | null
}) {
  return (
    <section id="network-graph" className="graph-panel" aria-label="网络可视化" aria-busy={loading}>
      <div
        className="graph-panel-body"
        style={{ display: 'grid', gridRow: '1 / -1', minHeight: 0 }}
      >
        <ErrorBoundary label="图谱加载失败">
          <Suspense fallback={<div className="graph-loading">正在加载图谱…</div>}>
            <NetworkGraph
              graph={canvasGraph}
              aggregateMode={aggregateMode}
              onAggregateModeChange={onAggregateModeChange}
              selectedId={selectedId}
              onSelectNode={onSelectNode}
              onSelectEdge={onSelectEdge}
              onAddFlowNode={onAddFlowNode}
              onAddConsumeNode={onAddConsumeNode}
              onRegisterFlowNode={onRegisterFlowNode}
              onAuthorizeFlowNode={onAuthorizeFlowNode}
              onGenerateRecord={onGenerateRecord}
              onMountRecord={onMountRecord}
              onLoadChain={onLoadChain}
              onClearCanvas={onClearCanvas}
              onExportNodeKey={onExportNodeKey}
              onRenameNode={onRenameNode}
              onDeleteNode={onDeleteNode}
              mountPickActive={mountPickActive}
              onCancelMountPick={onCancelMountPick}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </section>
  )
}
