import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { KeyRound } from 'lucide-react'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import { PanelHeader } from './PanelHeader'
import { FlowNodeKeyDetails } from './flow-node-operate/FlowNodeKeyDetails'

// 注册/授权/记录/挂载等操作已迁移到画布右键菜单与弹窗；详情面板仅保留密钥详情与管理操作。
export function FlowNodeOperatePanel({
  displayName,
  node,
  nodeState,
  onCopy,
  onDelete,
  onExportPrivateKey,
  onRename,
}: {
  displayName: string
  node: LocalFlowNode
  nodeState?: FlowNodeStateResponseDTO
  onCopy: (value: string, label: string) => void
  onDelete: () => void
  onExportPrivateKey: () => void
  onRename: () => void
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<KeyRound size={16} />} title="流转节点" />
      <FlowNodeKeyDetails
        displayName={displayName}
        node={node}
        nodeState={nodeState}
        onCopy={onCopy}
        onDelete={onDelete}
        onExportPrivateKey={onExportPrivateKey}
        onRename={onRename}
      />
    </div>
  )
}
