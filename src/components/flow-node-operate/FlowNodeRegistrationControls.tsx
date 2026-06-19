import { BadgeCheck, RefreshCw } from 'lucide-react'
import { formatInteger } from '../../lib/format'
import type { FlowNodeBusyState } from '../FlowNodeOperatePanel'
import { Button } from '../ui/button'
import { Field, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'

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
      <Field>
        <FieldLabel htmlFor="register-difficulty-target">注册难度目标</FieldLabel>
        <Input
          id="register-difficulty-target"
          name="registerDifficultyTarget"
          autoComplete="off"
          value={registerDifficultyTarget}
          onChange={(event) => onDifficultyChange(event.currentTarget.value)}
          inputMode="text"
          spellCheck={false}
          placeholder="例如 1d00ffff…"
        />
      </Field>
      <Button
        variant="secondary"
        type="button"
        disabled={busy === 'difficulty'}
        onClick={onFetchDifficulty}
      >
        <RefreshCw data-icon="inline-start" />
        {busy === 'difficulty' ? '加载中…' : '使用最新难度'}
      </Button>
      {centralLocked ? (
        <p className="operation-message error" role="alert">
          中心公钥已冻结，注册和授权已禁用。
        </p>
      ) : null}
      <Button type="button" disabled={registerDisabled} onClick={onRegister}>
        <BadgeCheck data-icon="inline-start" />
        {busy === 'register'
          ? miningAttempts != null
            ? `挖矿 ${formatInteger(miningAttempts)}…`
            : '注册中…'
          : '注册节点'}
      </Button>
    </>
  )
}
