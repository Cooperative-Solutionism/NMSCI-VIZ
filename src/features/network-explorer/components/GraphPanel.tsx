import { lazy, Suspense } from 'react'
import { Activity, Database, GitBranch, Network } from 'lucide-react'
import { ErrorBoundary, MetricCard } from '../../../components'
import { formatVolumeByCurrency } from '../../../lib/chainGraph'
import type { DataOrigin } from '../../../hooks/useConsumeChainQuery'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../../lib/types'

const NetworkGraph = lazy(() =>
  import('../../../components/NetworkGraph').then((module) => ({ default: module.NetworkGraph })),
)

export function GraphPanel({
  canvasGraph,
  filteredRowCount,
  graph,
  loading,
  onAddConsumeNode,
  onAddFlowNode,
  onCopyCurl,
  onExportCsv,
  onExportJson,
  onSelectEdge,
  onSelectNode,
  origin,
  selectedId,
}: {
  canvasGraph: ChainGraph
  filteredRowCount: number
  graph: ChainGraph
  loading: boolean
  onAddConsumeNode: (position?: { x: number; y: number }) => void
  onAddFlowNode: (position?: { x: number; y: number }) => void
  onCopyCurl: () => Promise<void>
  onExportCsv: () => void
  onExportJson: () => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onSelectNode: (node: ChainGraphNode) => void
  origin: DataOrigin
  selectedId: string | null
}) {
  return (
    <section id="network-graph" className="graph-panel" aria-label="网络可视化" aria-busy={loading}>
      <div className="graph-header">
        <div className="export-bar" role="group" aria-label="导出">
          <button
            className="ghost-button"
            type="button"
            disabled={graph.edges.length === 0}
            onClick={onExportCsv}
          >
            CSV
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={filteredRowCount === 0}
            onClick={onExportJson}
          >
            JSON
          </button>
          <button className="ghost-button" type="button" onClick={() => void onCopyCurl()}>
            复制 curl
          </button>
        </div>
        {origin === 'idle' ? (
          <div className="graph-welcome">
            <h2>探索消费网络</h2>
            <p>
              输入流转节点 UUID 或 66
              位十六进制公钥，选择起点、终点或节点模式后加载。成环链路代表循环交易，可在循环面板中排序查看。
            </p>
          </div>
        ) : null}
        <div className="metrics-strip">
          <MetricCard
            label="总链路"
            value={graph.stats.totalChains.toString()}
            icon={<GitBranch size={17} />}
          />
          <MetricCard
            label="成环"
            value={graph.stats.loopedChains.toString()}
            tone="looped"
            icon={<Activity size={17} />}
          />
          <MetricCard
            label="开放"
            value={graph.stats.openChains.toString()}
            tone="open"
            icon={<Network size={17} />}
          />
          <MetricCard
            label="流量"
            value={formatVolumeByCurrency(graph.stats.volumeByCurrency)}
            icon={<Database size={17} />}
          />
        </div>
      </div>

      <ErrorBoundary label="图谱加载失败">
        <Suspense fallback={<div className="graph-loading">正在加载图谱…</div>}>
          <NetworkGraph
            graph={canvasGraph}
            selectedId={selectedId}
            onSelectNode={onSelectNode}
            onSelectEdge={onSelectEdge}
            onAddFlowNode={onAddFlowNode}
            onAddConsumeNode={onAddConsumeNode}
          />
        </Suspense>
      </ErrorBoundary>
    </section>
  )
}
