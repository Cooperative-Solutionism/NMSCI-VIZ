import type { SystemStatusDTORaw } from '@nmsci/sdk'

// 顶栏系统健康条：高度 / 未入块消息数 / 中心公钥冻结告警。
export function SystemStatusStrip({ status }: { status: SystemStatusDTORaw | null }) {
  if (!status) return null
  return (
    <div className="system-status" aria-label="System status">
      <span>height {status.latestBlockHeight ?? '-'}</span>
      <span className="status-divider" />
      <span>{status.pendingMessageCount} pending</span>
      {status.currentCentralPubkeyLocked ? (
        <>
          <span className="status-divider" />
          <span className="frozen-badge" role="status">Central key FROZEN</span>
        </>
      ) : null}
    </div>
  )
}
