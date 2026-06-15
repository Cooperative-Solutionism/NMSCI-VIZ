import type { SystemStatusDTORaw } from '@nmsci/sdk'
import { SystemStatusStrip } from '../../../components'
import type { DataOrigin } from '../../../hooks/useConsumeChainQuery'

export function TopBar({
  edgeCount,
  nodeCount,
  origin,
  systemStatus,
}: {
  edgeCount: number
  nodeCount: number
  origin: DataOrigin
  systemStatus: SystemStatusDTORaw | null
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">NMSCI 消费网络</p>
        <h1>网络浏览器</h1>
      </div>
      <div className="topbar-status" aria-label="数据状态">
        <span className={`status-dot ${origin}`} />
        <span>{origin === 'backend' ? '后端数据' : '暂无数据'}</span>
        <span className="status-divider" />
        <span>{nodeCount} 个节点</span>
        <span>{edgeCount} 条边</span>
      </div>
      <SystemStatusStrip status={systemStatus} />
    </header>
  )
}
