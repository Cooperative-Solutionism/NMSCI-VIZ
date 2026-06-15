import { GitBranch } from 'lucide-react'
import { formatAmount } from '../lib/chainGraph'
import { formatMicros } from '../lib/format'
import type { ChainGraphEdge, ConsumeChainResponseDTO } from '../lib/types'
import { DetailRow } from './DetailRow'
import type { FlowRateView } from './NodeInspector'
import { PanelHeader } from './PanelHeader'
import { ReturnFlowCard } from './ReturnFlowCard'
import { TransactionEvidence } from './TransactionEvidence'

export function EdgeInspector({
  apiBase,
  chain,
  edge,
  flowRate,
}: {
  apiBase: string
  chain: ConsumeChainResponseDTO | null
  edge: ChainGraphEdge
  flowRate: FlowRateView
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<GitBranch size={16} />} title="已选边" />
      <div className={`status-pill ${edge.status}`}>
        {edge.status === 'looped' ? '成环' : '开放'}
      </div>
      <DetailRow label="边 ID" value={<code>{edge.id}</code>} />
      <DetailRow label="链路 ID" value={<code>{edge.chainId}</code>} />
      <DetailRow label="金额" value={formatAmount(edge.amount, edge.currencyType)} />
      <DetailRow label="来源" value={<code>{edge.source}</code>} />
      <DetailRow label="目标" value={<code>{edge.target}</code>} />
      <DetailRow label="记录" value={<code>{edge.relatedTransactionRecord}</code>} />
      <DetailRow label="挂载" value={<code>{edge.relatedTransactionMount}</code>} />
      <DetailRow label="挂载时间" value={formatMicros(edge.relatedTransactionMountTimestamp)} />
      {chain ? (
        <>
          <div className="section-title">链尾</div>
          <DetailRow label="起点" value={<code>{chain.consumeChain.start}</code>} />
          <DetailRow label="终点" value={<code>{chain.consumeChain.end}</code>} />
          <DetailRow label="尾部挂载" value={formatMicros(chain.consumeChain.tailMountTimestamp)} />
        </>
      ) : null}
      <ReturnFlowCard
        data={flowRate.data}
        error={flowRate.error}
        mode="edge"
        status={flowRate.status}
      />
      <TransactionEvidence
        apiBase={apiBase}
        mountId={edge.relatedTransactionMount}
        recordId={edge.relatedTransactionRecord}
      />
    </div>
  )
}
