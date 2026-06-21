import { useCallback } from 'react'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import { errorMessage } from '../../../lib/errors'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { useLocalConsumeNodeActions } from './useLocalConsumeNodeActions'
import { useLocalFlowNodeActions } from './useLocalFlowNodeActions'
import type { RequestUserConfirm, RequestUserText } from './useUserPromptDialogs'

export function useLocalNodeActions({
  clearLastRawBytes,
  clearSelectedLocalNode,
  markNodeOnCanvas,
  notifyError,
  notifyStatus,
  persistLocalConsumeNodes,
  persistLocalFlowNodes,
  requestConfirm,
  requestText,
  selectLocalNode,
  selectedLocalConsumeNode,
  selectedLocalNode,
  vaultStatus,
}: {
  clearLastRawBytes: () => void
  clearSelectedLocalNode: () => void
  markNodeOnCanvas: (publicKeyHex: string) => void
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  persistLocalConsumeNodes: (updater: (nodes: LocalConsumeNode[]) => LocalConsumeNode[]) => void
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  requestConfirm: RequestUserConfirm
  requestText: RequestUserText
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
    markNodeOnCanvas,
    notifyError,
    notifyStatus,
    onCopyPrivateKey: (privateKeyHex) => handleCopyText(privateKeyHex, '私钥'),
    persistLocalFlowNodes,
    requestConfirm,
    requestText,
    selectLocalNode,
    selectedLocalNode,
    vaultStatus,
  })
  const consumeNodeActions = useLocalConsumeNodeActions({
    clearSelectedLocalNode,
    markNodeOnCanvas,
    notifyError,
    notifyStatus,
    onCopyPrivateKey: (privateKeyHex) => handleCopyText(privateKeyHex, '私钥'),
    persistLocalConsumeNodes,
    requestConfirm,
    requestText,
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
