import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { Search } from 'lucide-react'
import { formatDateTime, maskSecret } from '../../lib/format'
import type { LocalFlowNode } from '../../lib/flowNodeStorage'
import { DetailRow } from '../DetailRow'
import { formatRegistrationStatus } from './formatRegistrationStatus'

interface FlowNodeKeyDetailsProps {
  node: LocalFlowNode
  nodeState?: FlowNodeStateResponseDTO
  onCopy: (value: string, label: string) => void
  onDelete: () => void
  onExportPrivateKey: () => void
  onQuery: () => void
  onRename: () => void
}

export function FlowNodeKeyDetails({
  node,
  nodeState,
  onCopy,
  onDelete,
  onExportPrivateKey,
  onQuery,
  onRename,
}: FlowNodeKeyDetailsProps) {
  const chainState = nodeState
    ? `${nodeState.registered ? '已注册' : '未注册'}${nodeState.authorized ? ' · 已授权' : ''}${nodeState.locked ? ' · 已锁定' : ''}`
    : '-'

  return (
    <div className="node-key-box">
      <DetailRow
        label="公钥"
        value={
          <span className="copyable-value">
            <code translate="no">{node.publicKeyHex}</code>
            <button type="button" onClick={() => onCopy(node.publicKeyHex, '公钥')}>
              复制
            </button>
          </span>
        }
      />
      <DetailRow
        label="注册 ID"
        value={
          node.registration?.id ? (
            <span className="copyable-value">
              <code translate="no">{node.registration.id}</code>
              <button type="button" onClick={() => onCopy(node.registration?.id ?? '', '注册 ID')}>
                复制
              </button>
            </span>
          ) : (
            '-'
          )
        }
      />
      <DetailRow
        label="私钥"
        value={<code translate="no">{maskSecret(node.privateKeyHex)}</code>}
      />
      <DetailRow label="保存时间" value={formatDateTime(node.createdAt)} />
      <DetailRow label="注册状态" value={formatRegistrationStatus(node.registration?.status)} />
      <DetailRow label="授权数" value={node.authorizations.length} />
      <DetailRow label="链上状态" value={chainState} />
      <button className="secondary-button" type="button" onClick={onQuery}>
        <Search size={15} />
        查询此节点
      </button>
      <button className="secondary-button" type="button" onClick={onExportPrivateKey}>
        导出私钥
      </button>
      <button className="secondary-button" type="button" onClick={onRename}>
        重命名
      </button>
      <button className="secondary-button danger" type="button" onClick={onDelete}>
        删除
      </button>
    </div>
  )
}
