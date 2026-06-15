import { Lock, LockOpen, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { VaultStatus } from '../hooks/useKeyVault'

interface VaultGateProps {
  status: VaultStatus
  error: string | null
  onSetup: (passphrase: string) => void
  onUnlock: (passphrase: string) => void
  onLock: () => void
}

export function VaultGate({ status, error, onSetup, onUnlock, onLock }: VaultGateProps) {
  const [passphrase, setPassphrase] = useState('')

  if (status === 'unlocked') {
    return (
      <div className="vault-gate unlocked">
        <span className="vault-state">
          <LockOpen size={14} aria-hidden="true" /> 密钥保险库已解锁
        </span>
        <button className="ghost-button" type="button" onClick={onLock}>
          锁定
        </button>
      </div>
    )
  }

  const isSetup = status === 'setup'
  const submit = () => {
    if (passphrase.length === 0) return
    if (isSetup) onSetup(passphrase)
    else onUnlock(passphrase)
    setPassphrase('')
  }

  return (
    <div className="vault-gate">
      <p className="vault-headline">
        {isSetup ? (
          <ShieldCheck size={14} aria-hidden="true" />
        ) : (
          <Lock size={14} aria-hidden="true" />
        )}
        {isSetup ? '保护你的私钥' : '解锁密钥保险库'}
      </p>
      <p className="field-hint">
        {isSetup
          ? '设置口令后，私钥会以 AES-GCM 加密存储；口令不会被保存。'
          : '输入口令以解密本次会话的本地密钥环。'}
      </p>
      <div className="action-row two">
        <input
          name="vaultPassphrase"
          type="password"
          aria-label={isSetup ? '新保险库口令' : '保险库口令'}
          autoComplete={isSetup ? 'new-password' : 'current-password'}
          value={passphrase}
          onChange={(event) => setPassphrase(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <button className="primary-button" type="button" onClick={submit}>
          {isSetup ? '创建保险库' : '解锁'}
        </button>
      </div>
      {error ? (
        <p className="operation-message error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
