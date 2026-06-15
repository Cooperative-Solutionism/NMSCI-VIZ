import type { SystemStatusDTORaw } from '@nmsci/sdk'

export function SystemStatusStrip({ status }: { status: SystemStatusDTORaw | null }) {
  if (!status) return null
  return (
    <div className="system-status" aria-label="系统状态">
      <span>高度 {status.latestBlockHeight ?? '-'}</span>
      <span className="status-divider" />
      <span>{status.pendingMessageCount} 条待处理</span>
      {status.currentCentralPubkeyLocked ? (
        <>
          <span className="status-divider" />
          <span className="frozen-badge" role="status">
            中心公钥已冻结
          </span>
        </>
      ) : null}
    </div>
  )
}
