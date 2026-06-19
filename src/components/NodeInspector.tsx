import { CircleDot } from 'lucide-react'
import type { FlowNodeStateResponseDTO, ReturningFlowRateResponseDTO } from '@nmsci/sdk'
import { formatVolumeByCurrency, shortId } from '../lib/chainGraph'
import type { ChainGraphNode, QueryMode } from '../lib/types'
import { DetailRow } from './DetailRow'
import { PanelHeader } from './PanelHeader'
import { ReturnFlowCard } from './ReturnFlowCard'
import { Button } from './ui/button'

type NodeDetailStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface FlowRateView {
  data: ReturningFlowRateResponseDTO | null
  error: string | null
  status: NodeDetailStatus
}

export function NodeInspector({
  detailError,
  detailStatus,
  disabled,
  extendLoading,
  flowRate,
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
  flowRate: FlowRateView
  node: ChainGraphNode
  onExtendEnd: () => void
  onExtendNode: () => void
  onExtendStart: () => void
  state?: FlowNodeStateResponseDTO
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<CircleDot size={16} />} title="已选节点" />
      <div className="node-actions">
        <Button variant="secondary" type="button" disabled={disabled} onClick={onExtendNode}>
          {extendLoading === 'node' ? '加载中…' : '加载节点'}
        </Button>
        <Button variant="secondary" type="button" disabled={disabled} onClick={onExtendStart}>
          {extendLoading === 'start' ? '扩展中…' : '扩展起点'}
        </Button>
        <Button variant="secondary" type="button" disabled={disabled} onClick={onExtendEnd}>
          {extendLoading === 'end' ? '扩展中…' : '扩展终点'}
        </Button>
      </div>
      <DetailRow label="节点" value={<code translate="no">{node.id}</code>} />
      <DetailRow label="标签" value={shortId(node.id)} />
      <DetailRow label="关联链数" value={node.chainCount} />
      <DetailRow label="吞吐量" value={formatVolumeByCurrency(node.volumeByCurrency)} />
      <div className="section-title">节点状态</div>
      {detailStatus === 'loading' ? (
        <div className="detail-state" role="status">
          正在加载节点状态…
        </div>
      ) : null}
      {detailStatus === 'error' ? (
        <div className="detail-state error" role="alert">
          {detailError ?? '节点状态请求失败。'}
        </div>
      ) : null}
      {state ? (
        <>
          <DetailRow label="已注册" value={state.registered ? '是' : '否'} />
          <DetailRow label="已授权" value={state.authorized ? '是' : '否'} />
          <DetailRow label="已锁定" value={state.locked ? '是' : '否'} />
          <DetailRow
            label="中心已授权"
            value={state.currentCentralPubkeyAuthorized ? '是' : '否'}
          />
        </>
      ) : detailStatus === 'idle' ? (
        <div className="detail-state">节点状态需要流转节点公钥（请通过公钥查询选择）。</div>
      ) : null}
      <ReturnFlowCard
        data={flowRate.data}
        error={flowRate.error}
        mode="node"
        status={flowRate.status}
      />
    </div>
  )
}
