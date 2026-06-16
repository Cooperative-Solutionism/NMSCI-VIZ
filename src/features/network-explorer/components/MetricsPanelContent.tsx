import { Activity, Database, GitBranch, Network } from 'lucide-react'
import { MetricCard } from '../../../components'
import { formatVolumeByCurrency } from '../../../lib/chainGraph'
import type { ChainGraph } from '../../../lib/types'

export function MetricsPanelContent({ graph }: { graph: ChainGraph }) {
  return (
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
  )
}
