import { BadgeCheck, RefreshCw } from 'lucide-react'
import { formatInteger } from '../../lib/format'
import { Field } from '../Field'
import type { FlowNodeBusyState } from '../FlowNodeOperatePanel'

interface FlowNodeRegistrationControlsProps {
  busy: FlowNodeBusyState
  centralLocked: boolean
  miningAttempts: number | null
  onDifficultyChange: (value: string) => void
  onFetchDifficulty: () => void
  onRegister: () => void
  registerDifficultyTarget: string
}

export function FlowNodeRegistrationControls({
  busy,
  centralLocked,
  miningAttempts,
  onDifficultyChange,
  onFetchDifficulty,
  onRegister,
  registerDifficultyTarget,
}: FlowNodeRegistrationControlsProps) {
  const registerDisabled =
    registerDifficultyTarget.trim().length === 0 || busy !== null || centralLocked

  return (
    <>
      <div className="section-title">注册</div>
      <Field label="注册难度目标">
        <input
          name="registerDifficultyTarget"
          autoComplete="off"
          value={registerDifficultyTarget}
          onChange={(event) => onDifficultyChange(event.currentTarget.value)}
          inputMode="text"
          spellCheck={false}
          placeholder="例如 1d00ffff…"
        />
      </Field>
      <button
        className="secondary-button"
        type="button"
        disabled={busy === 'difficulty'}
        onClick={onFetchDifficulty}
      >
        <RefreshCw size={15} />
        {busy === 'difficulty' ? '加载中…' : '使用最新难度'}
      </button>
      {centralLocked ? (
        <p className="operation-message error" role="alert">
          中心公钥已冻结，注册和授权已禁用。
        </p>
      ) : null}
      <button
        className="primary-button"
        type="button"
        disabled={registerDisabled}
        onClick={onRegister}
      >
        <BadgeCheck size={16} />
        {busy === 'register'
          ? miningAttempts != null
            ? `挖矿 ${formatInteger(miningAttempts)}…`
            : '注册中…'
          : '注册节点'}
      </button>
    </>
  )
}
