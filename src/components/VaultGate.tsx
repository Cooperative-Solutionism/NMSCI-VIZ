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

// 私钥保险库的开关面板：首次建库 / 解锁 / 已解锁三态。
// 私钥以 AES-GCM 静态加密存于 localStorage，解锁后才载入内存供签名使用。
export function VaultGate({ status, error, onSetup, onUnlock, onLock }: VaultGateProps) {
  const [passphrase, setPassphrase] = useState('')

  if (status === 'unlocked') {
    return (
      <div className="vault-gate unlocked">
        <span className="vault-state">
          <LockOpen size={14} aria-hidden="true" /> Key vault unlocked
        </span>
        <button className="ghost-button" type="button" onClick={onLock}>
          Lock
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
        {isSetup ? <ShieldCheck size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
        {isSetup ? 'Protect your private keys' : 'Unlock your key vault'}
      </p>
      <p className="field-hint">
        {isSetup
          ? 'Set a passphrase. Private keys are encrypted (AES-GCM) at rest; the passphrase is never stored.'
          : 'Enter your passphrase to decrypt the local keyring for this session.'}
      </p>
      <div className="action-row two">
        <input
          type="password"
          aria-label={isSetup ? 'New vault passphrase' : 'Vault passphrase'}
          autoComplete={isSetup ? 'new-password' : 'current-password'}
          placeholder="Passphrase"
          value={passphrase}
          onChange={(event) => setPassphrase(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <button className="primary-button" type="button" disabled={passphrase.length === 0} onClick={submit}>
          {isSetup ? 'Create vault' : 'Unlock'}
        </button>
      </div>
      {error ? <p className="operation-message error">{error}</p> : null}
    </div>
  )
}
