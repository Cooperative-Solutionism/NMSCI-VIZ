import { Activity, Database, GitBranch, Network, type LucideIcon } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatVolumeByCurrency } from '../../../lib/chainGraph'
import type { ChainGraph } from '../../../lib/types'

type MetricItem = {
  icon: LucideIcon
  label: string
  tone?: 'looped' | 'open'
  value: string
}

export function MetricsPanelContent({ graph }: { graph: ChainGraph }) {
  const metrics: MetricItem[] = [
    {
      icon: GitBranch,
      label: '总链路',
      value: graph.stats.totalChains.toString(),
    },
    {
      icon: Activity,
      label: '成环',
      tone: 'looped',
      value: graph.stats.loopedChains.toString(),
    },
    {
      icon: Network,
      label: '开放',
      tone: 'open',
      value: graph.stats.openChains.toString(),
    },
    {
      icon: Database,
      label: '流量',
      value: formatVolumeByCurrency(graph.stats.volumeByCurrency),
    },
  ]

  return (
    <div className="metrics-grid" aria-label="指标概览">
      {metrics.map(({ icon: Icon, label, tone, value }) => (
        <Card key={label} size="sm" className={`metric-card${tone ? ` metric-card--${tone}` : ''}`}>
          <CardHeader className="metric-card__header">
            <CardTitle className="metric-card__title">{label}</CardTitle>
            <CardAction className="metric-card__icon">
              <Icon aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent className="metric-card__content">
            <strong className="metric-card__value">{value}</strong>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
