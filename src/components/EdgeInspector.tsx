import { GitBranch } from 'lucide-react'
import { formatAmount } from '../lib/chainGraph'
import { formatMicros } from '../lib/format'
import type { ChainGraphEdge, ConsumeChainResponseDTO } from '../lib/types'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'

export function EdgeInspector({
  chain,
  edge,
}: {
  chain: ConsumeChainResponseDTO | null
  edge: ChainGraphEdge
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<GitBranch size={16} />} title="Selected edge" />
      <div className={`status-pill ${edge.status}`}>{edge.status}</div>
      <DetailRow label="Edge ID" value={<code>{edge.id}</code>} />
      <DetailRow label="Chain ID" value={<code>{edge.chainId}</code>} />
      <DetailRow label="Amount" value={formatAmount(edge.amount, edge.currencyType)} />
      <DetailRow label="Source" value={<code>{edge.source}</code>} />
      <DetailRow label="Target" value={<code>{edge.target}</code>} />
      <DetailRow label="Record" value={<code>{edge.relatedTransactionRecord}</code>} />
      <DetailRow label="Mount" value={<code>{edge.relatedTransactionMount}</code>} />
      <DetailRow label="Mount time" value={formatMicros(edge.relatedTransactionMountTimestamp)} />
      {chain ? (
        <>
          <div className="section-title">Chain tail</div>
          <DetailRow label="Start" value={<code>{chain.consumeChain.start}</code>} />
          <DetailRow label="End" value={<code>{chain.consumeChain.end}</code>} />
          <DetailRow label="Tail mount" value={formatMicros(chain.consumeChain.tailMountTimestamp)} />
        </>
      ) : null}
    </div>
  )
}
