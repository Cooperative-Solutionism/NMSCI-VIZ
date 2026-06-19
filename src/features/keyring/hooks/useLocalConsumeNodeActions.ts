import { useCallback } from 'react'
import { patchLocalConsumeNode, type LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { createLocalConsumeNode } from './localNodeBuilders'

interface UseLocalConsumeNodeActionsParams {
  clearSelectedLocalNode: () => void
  markNodeOnCanvas: (publicKeyHex: string) => void
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
  markNodeOnCanvas,
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
      // 关闭态(disabled)与解锁态都可直接操作；仅锁定/设置态需先解锁。
      if (vaultStatus === 'locked' || vaultStatus === 'setup') {
        notifyError('添加节点前请先解锁密钥保险库。')
        return
      }
      const node = createLocalConsumeNode(position)
      persistLocalConsumeNodes((currentNodes) => [node, ...currentNodes])
      selectLocalNode(node.publicKeyHex)
      // 右键画布放置的节点直接显示；面板新建（无落点）则等待"添加到画布"。
      if (position) markNodeOnCanvas(node.publicKeyHex)
      notifyStatus('消费节点已添加。')
    },
    [
      markNodeOnCanvas,
      notifyError,
      notifyStatus,
      persistLocalConsumeNodes,
      selectLocalNode,
      vaultStatus,
    ],
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
    const message =
      vaultStatus === 'disabled'
        ? '从 localStorage 导出私钥？私钥当前以明文存储，将直接复制。'
        : '从 localStorage 导出私钥？解锁后私钥会以明文复制。'
    if (!window.confirm(message)) return
    await onCopyPrivateKey(selectedLocalConsumeNode.privateKeyHex)
  }, [onCopyPrivateKey, selectedLocalConsumeNode, vaultStatus])

  return {
    handleAddConsumeNode,
    handleDeleteConsumeNode,
    handleExportConsumeKey,
    handleRenameConsumeNode,
  }
}
