import { useCallback } from 'react'
import { patchLocalConsumeNode, type LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { createLocalConsumeNode } from './localNodeBuilders'
import type { RequestUserConfirm, RequestUserText } from './useUserPromptDialogs'

interface UseLocalConsumeNodeActionsParams {
  clearSelectedLocalNode: () => void
  markNodeOnCanvas: (publicKeyHex: string) => void
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  onCopyPrivateKey: (privateKeyHex: string) => Promise<void>
  persistLocalConsumeNodes: (updater: (nodes: LocalConsumeNode[]) => LocalConsumeNode[]) => void
  requestConfirm: RequestUserConfirm
  requestText: RequestUserText
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
  requestConfirm,
  requestText,
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

  // 目标节点可显式传入（画布右键菜单直接作用于右键的节点）；省略时回退到当前选中节点。
  const handleRenameConsumeNode = useCallback(
    async (target?: LocalConsumeNode) => {
      const node = target ?? selectedLocalConsumeNode
      if (!node) return
      const next = await requestText({
        title: '重命名消费节点',
        label: '节点名称',
        defaultValue: node.label,
        confirmLabel: '保存',
      })
      if (next == null) return
      const label = (next.trim() || node.label).slice(0, 64)
      persistLocalConsumeNodes((currentNodes) =>
        patchLocalConsumeNode(currentNodes, node.id, {
          label,
          updatedAt: new Date().toISOString(),
        }),
      )
      notifyStatus('消费节点已重命名。')
    },
    [notifyStatus, persistLocalConsumeNodes, requestText, selectedLocalConsumeNode],
  )

  const handleDeleteConsumeNode = useCallback(
    async (target?: LocalConsumeNode) => {
      const node = target ?? selectedLocalConsumeNode
      if (!node) return
      const confirmed = await requestConfirm({
        title: '删除消费节点',
        description: '对应私钥将从本地存储删除，此操作无法撤销。',
        confirmLabel: '删除',
        destructive: true,
      })
      if (!confirmed) return
      const removedPubkey = node.publicKeyHex
      persistLocalConsumeNodes((currentNodes) =>
        currentNodes.filter((current) => current.publicKeyHex !== removedPubkey),
      )
      clearSelectedLocalNode()
      notifyStatus('消费节点已删除。')
    },
    [
      clearSelectedLocalNode,
      notifyStatus,
      persistLocalConsumeNodes,
      requestConfirm,
      selectedLocalConsumeNode,
    ],
  )

  const handleExportConsumeKey = useCallback(
    async (target?: LocalConsumeNode) => {
      const node = target ?? selectedLocalConsumeNode
      if (!node) return
      const message =
        vaultStatus === 'disabled'
          ? '从 localStorage 导出私钥？私钥当前以明文存储，将直接复制。'
          : '从 localStorage 导出私钥？解锁后私钥会以明文复制。'
      const confirmed = await requestConfirm({
        title: '导出私钥',
        description: message,
        confirmLabel: '复制私钥',
        destructive: true,
      })
      if (!confirmed) return
      await onCopyPrivateKey(node.privateKeyHex)
    },
    [onCopyPrivateKey, requestConfirm, selectedLocalConsumeNode, vaultStatus],
  )

  return {
    handleAddConsumeNode,
    handleDeleteConsumeNode,
    handleExportConsumeKey,
    handleRenameConsumeNode,
  }
}
