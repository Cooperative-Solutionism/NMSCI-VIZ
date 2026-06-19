import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '../../../components'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../../lib/types'

const NetworkGraph = lazy(() =>
  import('../../../components/NetworkGraph').then((module) => ({ default: module.NetworkGraph })),
)

export function GraphPanel({
  canvasGraph,
  loading,
  onAddConsumeNode,
  onAddFlowNode,
  onRegisterFlowNode,
  onAuthorizeFlowNode,
  onGenerateRecord,
  onMountRecord,
  onSelectEdge,
  onSelectNode,
  selectedId,
}: {
  canvasGraph: ChainGraph
  loading: boolean
  onAddConsumeNode: (position?: { x: number; y: number }) => void
  onAddFlowNode: (position?: { x: number; y: number }) => void
  onRegisterFlowNode: (node: ChainGraphNode) => void
  onAuthorizeFlowNode: (node: ChainGraphNode) => void
  onGenerateRecord: (node: ChainGraphNode) => void
  onMountRecord: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onSelectNode: (node: ChainGraphNode) => void
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
              selectedId={selectedId}
              onSelectNode={onSelectNode}
              onSelectEdge={onSelectEdge}
              onAddFlowNode={onAddFlowNode}
              onAddConsumeNode={onAddConsumeNode}
              onRegisterFlowNode={onRegisterFlowNode}
              onAuthorizeFlowNode={onAuthorizeFlowNode}
              onGenerateRecord={onGenerateRecord}
              onMountRecord={onMountRecord}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    </section>
  )
}
