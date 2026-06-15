import type { ReturningFlowRateResponseDTO } from '@nmsci/sdk'
import { formatAmount } from '../lib/chainGraph'
import { DetailRow } from './DetailRow'

type FlowRateStatus = 'idle' | 'loading' | 'loaded' | 'error'

// 回流率展示：node 模式看该节点总成环/总滞留，edge 模式看 source→target 回流率。
export function ReturnFlowCard({
  data,
  error,
  mode,
  status,
}: {
  data: ReturningFlowRateResponseDTO | null
  error: string | null
  mode: 'node' | 'edge'
  status: FlowRateStatus
}) {
  return (
    <>
      <div className="section-title">Return flow</div>
      {status === 'loading' ? <div className="detail-state">Loading return flow rate...</div> : null}
      {status === 'error' ? (
        <div className="detail-state error">{error ?? 'Return flow request failed.'}</div>
      ) : null}
      {status === 'loaded' && data ? (
        mode === 'edge' ? (
          <>
            <DetailRow label="Return flow rate" value={formatRate(data.returningFlowRate)} />
            <DetailRow label="Looped" value={formatAmount(data.loopedAmount, data.currencyType)} />
            <DetailRow label="Stagnant" value={formatAmount(data.unloopedAmount, data.currencyType)} />
          </>
        ) : (
          <>
            <DetailRow label="Retention" value={formatRate(retention(data.targetTotalLoopedAmount, data.targetTotalUnloopedAmount))} />
            <DetailRow label="Total looped" value={formatAmount(data.targetTotalLoopedAmount, data.currencyType)} />
            <DetailRow label="Total stagnant" value={formatAmount(data.targetTotalUnloopedAmount, data.currencyType)} />
          </>
        )
      ) : null}
    </>
  )
}

// 后端回流率以 0~1 比例返回；按百分比展示。
function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '-'
  return `${(rate * 100).toFixed(2)}%`
}

function retention(looped: number, unlooped: number): number {
  const total = looped + unlooped
  if (total <= 0) return 0
  return looped / total
}
