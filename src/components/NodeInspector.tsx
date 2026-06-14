import { CircleDot } from 'lucide-react'
import { formatAmount, shortId } from '../lib/chainGraph'
import { formatOptional } from '../lib/format'
import type { ChainGraphNode, FlowNodeRegisterMsgRaw, QueryMode } from '../lib/types'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'

type NodeDetailStatus = 'idle' | 'loading' | 'loaded' | 'error'

export function NodeInspector({
  detail,
  detailError,
  detailStatus,
  disabled,
  extendLoading,
  node,
  onExtendEnd,
  onExtendNode,
  onExtendStart,
}: {
  detail?: FlowNodeRegisterMsgRaw
  detailError: string | null
  detailStatus: NodeDetailStatus
  disabled: boolean
  extendLoading: QueryMode | null
  node: ChainGraphNode
  onExtendEnd: () => void
  onExtendNode: () => void
  onExtendStart: () => void
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<CircleDot size={16} />} title="Selected node" />
      <div className="node-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={onExtendNode}
        >
          {extendLoading === 'node' ? 'Loading' : 'Load node'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={onExtendStart}
        >
          {extendLoading === 'start' ? 'Extending' : 'Extend start'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={onExtendEnd}
        >
          {extendLoading === 'end' ? 'Extending' : 'Extend end'}
        </button>
      </div>
      <DetailRow label="Node" value={<code>{node.id}</code>} />
      <DetailRow label="Label" value={shortId(node.id)} />
      <DetailRow label="Touches" value={node.chainCount} />
      <DetailRow label="Volume" value={formatAmount(node.volume, 1)} />
      <div className="section-title">Backend detail</div>
      {detailStatus === 'loading' ? <div className="detail-state">Loading node detail...</div> : null}
      {detailStatus === 'error' ? (
        <div className="detail-state error">{detailError ?? 'Node detail request failed.'}</div>
      ) : null}
      {detail ? (
        <>
          <DetailRow label="Msg type" value={formatOptional(detail.msgType)} />
          <DetailRow label="Nonce" value={formatOptional(detail.nonce)} />
          <DetailRow label="Difficulty" value={formatOptional(detail.registerDifficultyTarget)} />
          <DetailRow label="Pubkey" value={<code>{formatOptional(detail.flowNodePubkey)}</code>} />
          <DetailRow label="TxID" value={<code>{formatOptional(detail.txid)}</code>} />
          <DetailRow label="Signature" value={<code>{formatOptional(detail.flowNodeSignature)}</code>} />
        </>
      ) : null}
    </div>
  )
}
