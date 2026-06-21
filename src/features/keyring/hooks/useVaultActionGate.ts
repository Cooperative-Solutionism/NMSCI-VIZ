import { useCallback, useEffect, useRef, useState } from 'react'
import type { VaultStatus } from '../../../hooks/useKeyVault'

interface PendingVaultAction {
  reason: string
  run?: () => void
}

// 保险库关闭或已解锁时，私钥已可直接使用，操作无需口令弹窗；仅锁定/设置态才排队并提示。
function keysAvailable(vaultStatus: VaultStatus): boolean {
  return vaultStatus === 'unlocked' || vaultStatus === 'disabled'
}

export function useVaultActionGate(
  vaultStatus: VaultStatus,
  { ready = keysAvailable(vaultStatus) }: { ready?: boolean } = {},
) {
  const pendingActionsRef = useRef<PendingVaultAction[]>([])
  const [reason, setReason] = useState<string | null>(null)
  const canRunNow = keysAvailable(vaultStatus) && ready

  const requestVault = useCallback(
    (nextReason: string, run?: () => void) => {
      if (canRunNow) {
        run?.()
        return
      }

      pendingActionsRef.current = [...pendingActionsRef.current, { reason: nextReason, run }]
      setReason(nextReason)
    },
    [canRunNow],
  )

  const closeVaultPrompt = useCallback(() => {
    pendingActionsRef.current = []
    setReason(null)
  }, [])

  useEffect(() => {
    if (!canRunNow) return
    const pendingActions = pendingActionsRef.current
    if (pendingActions.length === 0) return

    pendingActionsRef.current = []
    setReason(null)
    pendingActions.forEach((pending) => pending.run?.())
  }, [canRunNow])

  return {
    closeVaultPrompt,
    requestVault,
    // 关闭态不弹窗（私钥已是明文可用）；仅在启用但未解锁时才显示弹窗。
    vaultPromptOpen: reason !== null && !keysAvailable(vaultStatus),
    vaultPromptReason: reason,
  }
}
