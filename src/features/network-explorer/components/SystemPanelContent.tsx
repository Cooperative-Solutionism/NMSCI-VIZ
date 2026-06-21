import type { SystemStatusDTORaw } from '@nmsci/sdk'
import { AlertCircle, Info, RefreshCw } from 'lucide-react'
import { DetailRow, SystemStatusStrip } from '../../../components'
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { formatInteger, formatMicros, shortHex } from '../../../lib/format'

// 微秒时间戳（API.md：confirmTimestamp 等均为微秒），null 时显示占位。
function formatTimestamp(value: number | null): string {
  return value == null ? '-' : formatMicros(value)
}

// 出块间隔后端固定为毫秒（600000 = 10 分钟）。整分钟显示分钟，否则回退到秒。
function formatInterval(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '-'
  const minutes = milliseconds / 60000
  return Number.isInteger(minutes) ? `${minutes} 分钟` : `${Math.round(milliseconds / 1000)} 秒`
}

export function SystemPanelContent({
  status,
  error,
  onRefresh,
}: {
  status: SystemStatusDTORaw | null
  error?: string | null
  onRefresh?: () => void
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info aria-hidden="true" />
          系统状态
        </CardTitle>
        {onRefresh ? (
          <CardAction>
            <Button variant="outline" size="sm" type="button" onClick={onRefresh}>
              <RefreshCw data-icon="inline-start" />
              刷新
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <SystemStatusStrip status={status} />

        {error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>系统状态加载失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {status ? (
          <div className="flex flex-col gap-2">
            <DetailRow
              label="最新高度"
              value={
                status.latestBlockHeight == null ? '-' : formatInteger(status.latestBlockHeight)
              }
            />
            <DetailRow
              label="最新区块"
              value={
                status.latestBlockHash ? (
                  <code translate="no">{shortHex(status.latestBlockHash)}</code>
                ) : (
                  '-'
                )
              }
            />
            <DetailRow label="出块时间" value={formatTimestamp(status.latestBlockTimestamp)} />
            <DetailRow label="出块间隔" value={formatInterval(status.blockIntervalMs)} />
            <DetailRow
              label="待处理消息"
              value={`${formatInteger(status.pendingMessageCount)} 条`}
            />
            <DetailRow
              label="最早待确认"
              value={formatTimestamp(status.oldestPendingConfirmTimestamp)}
            />
            <DetailRow
              label="中心公钥"
              value={
                status.currentCentralPubkeyLocked ? (
                  <Badge variant="destructive">已冻结</Badge>
                ) : (
                  <Badge variant="outline">正常</Badge>
                )
              }
            />
          </div>
        ) : error ? null : (
          <p className="text-sm text-muted-foreground">正在加载系统状态…</p>
        )}
      </CardContent>
    </Card>
  )
}
