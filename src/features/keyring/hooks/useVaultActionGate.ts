import { useCallback, useEffect, useRef, useState } from 'react'
import type { VaultStatus } from '../../../hooks/useKeyVault'

interface PendingVaultAction {
  reason: string
  run?: () => void
}

export function useVaultActionGate(
  vaultStatus: VaultStatus,
  { ready = vaultStatus === 'unlocked' }: { ready?: boolean } = {},
) {
  const pendingActionsRef = useRef<PendingVaultAction[]>([])
  const [reason, setReason] = useState<string | null>(null)

  const requestVault = useCallback(
    (nextReason: string, run?: () => void) => {
      if (vaultStatus === 'unlocked' && ready) {
        run?.()
        return
      }

      pendingActionsRef.current = [...pendingActionsRef.current, { reason: nextReason, run }]
      setReason(nextReason)
    },
    [ready, vaultStatus],
  )

  const closeVaultPrompt = useCallback(() => {
    pendingActionsRef.current = []
    setReason(null)
  }, [])

  useEffect(() => {
    if (vaultStatus !== 'unlocked' || !ready) return
    const pendingActions = pendingActionsRef.current
    if (pendingActions.length === 0) return

    pendingActionsRef.current = []
    setReason(null)
    pendingActions.forEach((pending) => pending.run?.())
  }, [ready, vaultStatus])

  return {
    closeVaultPrompt,
    requestVault,
    vaultPromptOpen: reason !== null && vaultStatus !== 'unlocked',
    vaultPromptReason: reason,
  }
}
