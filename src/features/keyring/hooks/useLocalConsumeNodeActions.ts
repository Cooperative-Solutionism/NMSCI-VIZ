import { useCallback } from 'react'
import { patchLocalConsumeNode, type LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { createLocalConsumeNode } from './localNodeBuilders'

interface UseLocalConsumeNodeActionsParams {
  clearSelectedLocalNode: () => void
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  onCopyPrivateKey: (privateKeyHex: string) => Promise<void>
  persistLocalConsumeNodes: (updater: (nodes: LocalConsumeNode[]) => LocalConsumeNode[]) => void
  selectLocalNode: (id: string) => void
  selectedLocalConsumeNode: LocalConsumeNode | null
  vaultStatus: VaultStatus
}

export function useLocalConsumeNodeActions({
  clearSelectedLocalNode,
  notifyError,
  notifyStatus,
  onCopyPrivateKey,
  persistLocalConsumeNodes,
  selectLocalNode,
  selectedLocalConsumeNode,
  vaultStatus,
}: UseLocalConsumeNodeActionsParams) {
  const handleAddConsumeNode = useCallback(
    (position?: { x: number; y: number }) => {
      if (vaultStatus !== 'unlocked') {
        notifyError('添加节点前请先解锁密钥保险库。')
        return
      }
      const node = createLocalConsumeNode(position)
      persistLocalConsumeNodes((currentNodes) => [node, ...currentNodes])
      selectLocalNode(node.publicKeyHex)
      notifyStatus('消费节点已添加。')
    },
    [notifyError, notifyStatus, persistLocalConsumeNodes, selectLocalNode, vaultStatus],
  )

  const handleRenameConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    const next = window.prompt('重命名消费节点', selectedLocalConsumeNode.label)
    if (next == null) return
    const label = (next.trim() || selectedLocalConsumeNode.label).slice(0, 64)
    persistLocalConsumeNodes((currentNodes) =>
      patchLocalConsumeNode(currentNodes, selectedLocalConsumeNode.id, {
        label,
        updatedAt: new Date().toISOString(),
      }),
    )
    notifyStatus('消费节点已重命名。')
  }, [notifyStatus, persistLocalConsumeNodes, selectedLocalConsumeNode])

  const handleDeleteConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('删除此消费节点？对应私钥将丢失。')) return
    const removedPubkey = selectedLocalConsumeNode.publicKeyHex
    persistLocalConsumeNodes((currentNodes) =>
      currentNodes.filter((current) => current.publicKeyHex !== removedPubkey),
    )
    clearSelectedLocalNode()
    notifyStatus('消费节点已删除。')
  }, [clearSelectedLocalNode, notifyStatus, persistLocalConsumeNodes, selectedLocalConsumeNode])

  const handleExportConsumeKey = useCallback(async () => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('从 localStorage 导出私钥？解锁后私钥会以明文复制。')) return
    await onCopyPrivateKey(selectedLocalConsumeNode.privateKeyHex)
  }, [onCopyPrivateKey, selectedLocalConsumeNode])

  return {
    handleAddConsumeNode,
    handleDeleteConsumeNode,
    handleExportConsumeKey,
    handleRenameConsumeNode,
  }
}
