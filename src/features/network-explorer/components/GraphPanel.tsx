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
    <section
      id="network-graph"
      className="graph-panel"
      aria-label="Network visualization"
      aria-busy={loading}
    >
      <div className="graph-header">
        <div className="export-bar" role="group" aria-label="Export">
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
            Copy curl
          </button>
        </div>
        {origin === 'idle' ? (
          <div className="graph-welcome">
            <h2>Explore the consumption network</h2>
            <p>
              Enter a flow node UUID or 66-hex public key, choose a mode (Start / End / Node), and
              Load. Looped chains are circular trades - open the Loops panel to rank them.
            </p>
          </div>
        ) : null}
        <div className="metrics-strip">
          <MetricCard
            label="Total chains"
            value={graph.stats.totalChains.toString()}
            icon={<GitBranch size={17} />}
          />
          <MetricCard
            label="Looped"
            value={graph.stats.loopedChains.toString()}
            tone="looped"
            icon={<Activity size={17} />}
          />
          <MetricCard
            label="Open"
            value={graph.stats.openChains.toString()}
            tone="open"
            icon={<Network size={17} />}
          />
          <MetricCard
            label="Volume"
            value={formatVolumeByCurrency(graph.stats.volumeByCurrency)}
            icon={<Database size={17} />}
          />
        </div>
      </div>

      <ErrorBoundary label="Network graph failed">
        <Suspense fallback={<div className="graph-loading">Loading graph...</div>}>
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
