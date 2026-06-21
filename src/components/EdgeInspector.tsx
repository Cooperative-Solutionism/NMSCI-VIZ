import { GitBranch } from 'lucide-react'
import { formatAmount } from '../lib/chainGraph'
import { formatMicros, formatRate } from '../lib/format'
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
  // 总计模式下的合并边：展示客户端汇总口径（总额/成环/回流率），与画布标签一致，
  // 不再走按 source→target 的后端回流率接口，避免两套口径并存造成困惑。
  if (edge.aggregated) {
    return (
      <div className="inspector-content">
        <PanelHeader icon={<GitBranch size={16} />} title="合并边（总计）" />
        <div className={`status-pill ${edge.status}`}>
          {edge.status === 'looped' ? '成环' : '开放'}
        </div>
        <DetailRow label="来源" value={<code translate="no">{edge.source}</code>} />
        <DetailRow label="目标" value={<code translate="no">{edge.target}</code>} />
        <div className="section-title">总计</div>
        <DetailRow label="合并边数" value={String(edge.aggregated.edgeCount)} />
        <DetailRow
          label="总额"
          value={formatAmount(edge.aggregated.totalAmount, edge.currencyType)}
        />
        <DetailRow
          label="成环金额"
          value={formatAmount(edge.aggregated.loopedAmount, edge.currencyType)}
        />
        <DetailRow label="回流率" value={formatRate(edge.aggregated.reflowRate)} />
      </div>
    )
  }

  return (
    <div className="inspector-content">
      <PanelHeader icon={<GitBranch size={16} />} title="已选边" />
      <div className={`status-pill ${edge.status}`}>
        {edge.status === 'looped' ? '成环' : '开放'}
      </div>
      <DetailRow label="边 ID" value={<code translate="no">{edge.id}</code>} />
      <DetailRow label="链路 ID" value={<code translate="no">{edge.chainId}</code>} />
      <DetailRow label="金额" value={formatAmount(edge.amount, edge.currencyType)} />
      <DetailRow label="来源" value={<code translate="no">{edge.source}</code>} />
      <DetailRow label="目标" value={<code translate="no">{edge.target}</code>} />
      <DetailRow label="记录" value={<code translate="no">{edge.relatedTransactionRecord}</code>} />
      <DetailRow label="挂载" value={<code translate="no">{edge.relatedTransactionMount}</code>} />
      <DetailRow label="挂载时间" value={formatMicros(edge.relatedTransactionMountTimestamp)} />
      {chain ? (
        <>
          <div className="section-title">链尾</div>
          <DetailRow label="起点" value={<code translate="no">{chain.consumeChain.start}</code>} />
          <DetailRow label="终点" value={<code translate="no">{chain.consumeChain.end}</code>} />
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
