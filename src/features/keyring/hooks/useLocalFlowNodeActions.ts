import { useCallback } from 'react'
import { patchLocalFlowNode, type LocalFlowNode } from '../../../lib/flowNodeStorage'
import { errorMessage } from '../../../lib/errors'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { createLocalFlowNode, importLocalFlowNode } from './localNodeBuilders'

interface UseLocalFlowNodeActionsParams {
  clearLastRawBytes: () => void
  clearSelectedLocalNode: () => void
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  onCopyPrivateKey: (privateKeyHex: string) => Promise<void>
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  selectLocalNode: (id: string) => void
  selectedLocalNode: LocalFlowNode | null
  vaultStatus: VaultStatus
}

export function useLocalFlowNodeActions({
  clearLastRawBytes,
  clearSelectedLocalNode,
  notifyError,
  notifyStatus,
  onCopyPrivateKey,
  persistLocalFlowNodes,
  selectLocalNode,
  selectedLocalNode,
  vaultStatus,
}: UseLocalFlowNodeActionsParams) {
  const handleAddFlowNode = useCallback(
    (position?: { x: number; y: number }) => {
      if (vaultStatus !== 'unlocked') {
        notifyError('添加节点前请先解锁密钥保险库。')
        return
      }
      const node = createLocalFlowNode(position)
      persistLocalFlowNodes((currentNodes) => [node, ...currentNodes])
      selectLocalNode(node.publicKeyHex)
      notifyStatus('流转节点已添加。')
      clearLastRawBytes()
    },
    [
      clearLastRawBytes,
      notifyError,
      notifyStatus,
      persistLocalFlowNodes,
      selectLocalNode,
      vaultStatus,
    ],
  )

  const handleImportLocalNode = useCallback(() => {
    if (vaultStatus !== 'unlocked') {
      notifyError('导入节点前请先解锁密钥保险库。')
      return
    }
    const privateKeyHex = window.prompt('粘贴私钥（hex）')?.trim()
    if (!privateKeyHex) return
    try {
      const node = importLocalFlowNode(privateKeyHex)
      persistLocalFlowNodes((currentNodes) => [
        node,
        ...currentNodes.filter((current) => current.publicKeyHex !== node.publicKeyHex),
      ])
      selectLocalNode(node.publicKeyHex)
      notifyStatus('流转节点已导入。')
    } catch (importError) {
      notifyError(errorMessage(importError, '私钥无效'))
    }
  }, [notifyError, notifyStatus, persistLocalFlowNodes, selectLocalNode, vaultStatus])

  const handleRenameLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    const next = window.prompt('重命名流转节点', selectedLocalNode.label)
    if (next == null) return
    const label = (next.trim() || selectedLocalNode.label).slice(0, 64)
    persistLocalFlowNodes((currentNodes) =>
      patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
        label,
        updatedAt: new Date().toISOString(),
      }),
    )
    notifyStatus('流转节点已重命名。')
  }, [notifyStatus, persistLocalFlowNodes, selectedLocalNode])

  const handleDeleteLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    if (!window.confirm('删除此本地流转节点？对应私钥将丢失。')) return
    const removedPubkey = selectedLocalNode.publicKeyHex
    persistLocalFlowNodes((currentNodes) =>
      currentNodes.filter((current) => current.publicKeyHex !== removedPubkey),
    )
    clearSelectedLocalNode()
    notifyStatus('流转节点已删除。')
  }, [clearSelectedLocalNode, notifyStatus, persistLocalFlowNodes, selectedLocalNode])

  const handleExportPrivateKey = useCallback(async () => {
    if (!selectedLocalNode) return
    const confirmed = window.confirm('从 localStorage 导出私钥？解锁后私钥会以明文复制。')
    if (!confirmed) return
    await onCopyPrivateKey(selectedLocalNode.privateKeyHex)
  }, [onCopyPrivateKey, selectedLocalNode])

  return {
    handleAddFlowNode,
    handleDeleteLocalNode,
    handleExportPrivateKey,
    handleImportLocalNode,
    handleRenameLocalNode,
  }
}
