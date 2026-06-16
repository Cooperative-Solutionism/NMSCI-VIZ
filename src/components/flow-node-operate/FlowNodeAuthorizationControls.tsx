import { ShieldCheck } from 'lucide-react'
import { Field } from '../Field'
import type { FlowNodeBusyState } from '../FlowNodeOperatePanel'

interface FlowNodeAuthorizationControlsProps {
  busy: FlowNodeBusyState
  centralLocked: boolean
  centralPubkey: string
  onAuthorize: () => void
  onCentralPubkeyChange: (value: string) => void
}

export function FlowNodeAuthorizationControls({
  busy,
  centralLocked,
  centralPubkey,
  onAuthorize,
  onCentralPubkeyChange,
}: FlowNodeAuthorizationControlsProps) {
  return (
    <>
      <div className="section-title">授权中心公钥</div>
      <Field label="中心公钥">
        <textarea
          name="authorizationCentralPubkey"
          autoComplete="off"
          rows={3}
          value={centralPubkey}
          onChange={(event) => onCentralPubkeyChange(event.currentTarget.value)}
          spellCheck={false}
          placeholder="例如 02 后接 64 位 hex…"
        />
      </Field>
      <button
        className="primary-button"
        type="button"
        disabled={centralPubkey.trim().length === 0 || busy !== null || centralLocked}
        onClick={onAuthorize}
      >
        <ShieldCheck size={16} />
        {busy === 'authorize' ? '授权中…' : '授权中心'}
      </button>
    </>
  )
}
