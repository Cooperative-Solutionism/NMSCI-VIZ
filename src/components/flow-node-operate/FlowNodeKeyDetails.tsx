import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { formatDateTime, maskSecret } from '../../lib/format'
import type { LocalFlowNode } from '../../lib/flowNodeStorage'
import { DetailRow } from '../DetailRow'
import { Button } from '../ui/button'
import { formatRegistrationStatus } from './formatRegistrationStatus'

interface FlowNodeKeyDetailsProps {
  displayName: string
  node: LocalFlowNode
  nodeState?: FlowNodeStateResponseDTO
  onCopy: (value: string, label: string) => void
}

// 导出私钥 / 重命名 / 删除等管理操作已迁移到画布右键菜单；此处仅展示密钥详情。
export function FlowNodeKeyDetails({
  displayName,
  node,
  nodeState,
  onCopy,
}: FlowNodeKeyDetailsProps) {
  const chainState = nodeState
    ? `${nodeState.registered ? '已注册' : '未注册'}${nodeState.authorized ? ' · 已授权' : ''}${nodeState.locked ? ' · 已锁定' : ''}`
    : '-'

  return (
    <div className="node-key-box">
      <DetailRow label="节点名称" value={<code translate="no">{displayName}</code>} />
      <DetailRow
        label="公钥"
        value={
          <span className="copyable-value">
            <code translate="no">{node.publicKeyHex}</code>
            <Button
              variant="ghost"
              size="xs"
              type="button"
              onClick={() => onCopy(node.publicKeyHex, '公钥')}
            >
              复制
            </Button>
          </span>
        }
      />
      <DetailRow
        label="注册 ID"
        value={
          node.registration?.id ? (
            <span className="copyable-value">
              <code translate="no">{node.registration.id}</code>
              <Button
                variant="ghost"
                size="xs"
                type="button"
                onClick={() => onCopy(node.registration?.id ?? '', '注册 ID')}
              >
                复制
              </Button>
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
      <p className="field-hint">右键该节点可进行注册、授权、导出私钥、重命名、删除等操作。</p>
    </div>
  )
}
