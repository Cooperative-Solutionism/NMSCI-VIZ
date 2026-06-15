import type { ReturningFlowRateResponseDTO } from '@nmsci/sdk'
import { formatAmount } from '../lib/chainGraph'
import { DetailRow } from './DetailRow'

type FlowRateStatus = 'idle' | 'loading' | 'loaded' | 'error'

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
      <div className="section-title">回流</div>
      {status === 'loading' ? <div className="detail-state">正在加载回流率...</div> : null}
      {status === 'error' ? (
        <div className="detail-state error">{error ?? '回流率请求失败。'}</div>
      ) : null}
      {status === 'loaded' && data ? (
        mode === 'edge' ? (
          <>
            <DetailRow label="回流率" value={formatRate(data.returningFlowRate)} />
            <DetailRow
              label="成环金额"
              value={formatAmount(data.loopedAmount, data.currencyType)}
            />
            <DetailRow
              label="滞留金额"
              value={formatAmount(data.unloopedAmount, data.currencyType)}
            />
          </>
        ) : (
          <>
            <DetailRow
              label="留存率"
              value={formatRate(
                retention(data.targetTotalLoopedAmount, data.targetTotalUnloopedAmount),
              )}
            />
            <DetailRow
              label="总成环金额"
              value={formatAmount(data.targetTotalLoopedAmount, data.currencyType)}
            />
            <DetailRow
              label="总滞留金额"
              value={formatAmount(data.targetTotalUnloopedAmount, data.currencyType)}
            />
          </>
        )
      ) : null}
    </>
  )
}

function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return '-'
  return `${(rate * 100).toFixed(2)}%`
}

function retention(looped: number, unlooped: number): number {
  const total = looped + unlooped
  if (total <= 0) return 0
  return looped / total
}
