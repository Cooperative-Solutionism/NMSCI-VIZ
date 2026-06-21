import type { FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { KeyRound } from 'lucide-react'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import { PanelHeader } from './PanelHeader'
import { FlowNodeKeyDetails } from './flow-node-operate/FlowNodeKeyDetails'

// 注册/授权/记录/挂载与导出私钥/重命名/删除等操作均已迁移到画布右键菜单；详情面板仅展示密钥详情。
export function FlowNodeOperatePanel({
  displayName,
  node,
  nodeState,
  onCopy,
}: {
  displayName: string
  node: LocalFlowNode
  nodeState?: FlowNodeStateResponseDTO
  onCopy: (value: string, label: string) => void
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<KeyRound size={16} />} title="流转节点" />
      <FlowNodeKeyDetails
        displayName={displayName}
        node={node}
        nodeState={nodeState}
        onCopy={onCopy}
      />
    </div>
  )
}
