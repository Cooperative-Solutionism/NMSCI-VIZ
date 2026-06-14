import { CircleDot } from 'lucide-react'
import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { formatVolumeByCurrency, shortId } from '../lib/chainGraph'
import type { ChainGraphNode, QueryMode } from '../lib/types'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'

type NodeDetailStatus = 'idle' | 'loading' | 'loaded' | 'error'

export function NodeInspector({
  detailError,
  detailStatus,
  disabled,
  extendLoading,
  node,
  onExtendEnd,
  onExtendNode,
  onExtendStart,
  state,
}: {
  detailError: string | null
  detailStatus: NodeDetailStatus
  disabled: boolean
  extendLoading: QueryMode | null
  node: ChainGraphNode
  onExtendEnd: () => void
  onExtendNode: () => void
  onExtendStart: () => void
  state?: FlowNodeStateResponseDTO
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
      <DetailRow label="Throughput" value={formatVolumeByCurrency(node.volumeByCurrency)} />
      <div className="section-title">Node state</div>
      {detailStatus === 'loading' ? <div className="detail-state">Loading node state...</div> : null}
      {detailStatus === 'error' ? (
        <div className="detail-state error">{detailError ?? 'Node state request failed.'}</div>
      ) : null}
      {state ? (
        <>
          <DetailRow label="Registered" value={state.registered ? 'Yes' : 'No'} />
          <DetailRow label="Authorized" value={state.authorized ? 'Yes' : 'No'} />
          <DetailRow label="Locked" value={state.locked ? 'Yes' : 'No'} />
          <DetailRow label="Central authorized" value={state.currentCentralPubkeyAuthorized ? 'Yes' : 'No'} />
        </>
      ) : detailStatus === 'idle' ? (
        <div className="detail-state">Node state needs the flow node public key (select via a pubkey query).</div>
      ) : null}
    </div>
  )
}
