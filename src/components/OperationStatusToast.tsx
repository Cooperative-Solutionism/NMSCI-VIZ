import type { FlowNodeBusyState } from '../hooks/useFlowNodeRegistration'
import { formatInteger } from '../lib/format'

const busyLabels: Record<NonNullable<FlowNodeBusyState>, string> = {
  difficulty: '加载难度中',
  register: '注册中',
  authorize: '授权中',
  record: '创建记录中',
  mount: '挂载中',
}

// 注册/授权等右键操作没有承载弹窗，这里给视力用户一个常驻可见的进度/结果提示。
// AT 仍由 App 的 sr-only live region 播报，故此处 aria-hidden 避免重复朗读。
export function OperationStatusToast({
  busy,
  status,
  error,
  miningAttempts,
}: {
  busy: FlowNodeBusyState
  status: string | null
  error: string | null
  miningAttempts: number | null
}) {
  if (!busy && !status && !error) return null

  const tone = busy ? 'busy' : error ? 'error' : 'ok'
  const message = busy
    ? `${busyLabels[busy]}${miningAttempts != null ? ` · 挖矿 ${formatInteger(miningAttempts)}` : ''}…`
    : (error ?? status)

  return (
    <div className="operation-status-toast" data-tone={tone} aria-hidden="true">
      {busy ? <span className="operation-status-toast__spinner" /> : null}
      <span className="operation-status-toast__text">{message}</span>
    </div>
  )
}
