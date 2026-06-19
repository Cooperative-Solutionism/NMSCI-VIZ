import { useCallback } from 'react'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import { errorMessage } from '../../../lib/errors'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { useLocalConsumeNodeActions } from './useLocalConsumeNodeActions'
import { useLocalFlowNodeActions } from './useLocalFlowNodeActions'

export function useLocalNodeActions({
  clearLastRawBytes,
  clearSelectedLocalNode,
  notifyError,
  notifyStatus,
  persistLocalConsumeNodes,
  persistLocalFlowNodes,
  selectLocalNode,
  selectedLocalConsumeNode,
  selectedLocalNode,
  vaultStatus,
}: {
  clearLastRawBytes: () => void
  clearSelectedLocalNode: () => void
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  persistLocalConsumeNodes: (updater: (nodes: LocalConsumeNode[]) => LocalConsumeNode[]) => void
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  selectLocalNode: (id: string) => void
  selectedLocalConsumeNode: LocalConsumeNode | null
  selectedLocalNode: LocalFlowNode | null
  vaultStatus: VaultStatus
}) {
  const handleCopyText = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        notifyStatus(`${label}已复制。`)
      } catch (clipboardError) {
        notifyError(errorMessage(clipboardError, '剪贴板不可用'))
      }
    },
    [notifyError, notifyStatus],
  )

  const flowNodeActions = useLocalFlowNodeActions({
    clearLastRawBytes,
    clearSelectedLocalNode,
    notifyError,
    notifyStatus,
    onCopyPrivateKey: (privateKeyHex) => handleCopyText(privateKeyHex, '私钥'),
    persistLocalFlowNodes,
    selectLocalNode,
    selectedLocalNode,
    vaultStatus,
  })
  const consumeNodeActions = useLocalConsumeNodeActions({
    clearSelectedLocalNode,
    notifyError,
    notifyStatus,
    onCopyPrivateKey: (privateKeyHex) => handleCopyText(privateKeyHex, '私钥'),
    persistLocalConsumeNodes,
    selectLocalNode,
    selectedLocalConsumeNode,
    vaultStatus,
  })

  return {
    ...flowNodeActions,
    ...consumeNodeActions,
    handleCopyText,
  }
}
