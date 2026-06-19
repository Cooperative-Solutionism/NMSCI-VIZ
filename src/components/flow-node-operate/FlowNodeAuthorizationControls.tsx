import { ShieldCheck } from 'lucide-react'
import type { FlowNodeBusyState } from '../FlowNodeOperatePanel'
import { Button } from '../ui/button'
import { Field, FieldLabel } from '../ui/field'
import { Textarea } from '../ui/textarea'

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
      <Field>
        <FieldLabel htmlFor="authorization-central-pubkey">中心公钥</FieldLabel>
        <Textarea
          id="authorization-central-pubkey"
          name="authorizationCentralPubkey"
          autoComplete="off"
          rows={3}
          value={centralPubkey}
          onChange={(event) => onCentralPubkeyChange(event.currentTarget.value)}
          spellCheck={false}
          placeholder="例如 02 后接 64 位 hex…"
        />
      </Field>
      <Button
        type="button"
        disabled={centralPubkey.trim().length === 0 || busy !== null || centralLocked}
        onClick={onAuthorize}
      >
        <ShieldCheck data-icon="inline-start" />
        {busy === 'authorize' ? '授权中…' : '授权中心'}
      </Button>
    </>
  )
}
