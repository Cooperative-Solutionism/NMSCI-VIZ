import type { SystemStatusDTORaw } from '@nmsci/sdk'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'

export function SystemStatusStrip({ status }: { status: SystemStatusDTORaw | null }) {
  if (!status) return null
  return (
    <div className="system-status" aria-label="系统状态">
      <span>高度 {status.latestBlockHeight ?? '-'}</span>
      <Separator orientation="vertical" className="status-divider" />
      <span>{status.pendingMessageCount} 条待处理</span>
      {status.currentCentralPubkeyLocked ? (
        <>
          <Separator orientation="vertical" className="status-divider" />
          <Badge variant="destructive" role="status">
            中心公钥已冻结
          </Badge>
        </>
      ) : null}
    </div>
  )
}
