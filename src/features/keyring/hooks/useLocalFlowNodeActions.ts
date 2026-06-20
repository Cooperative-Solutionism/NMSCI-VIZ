import { useCallback } from 'react'
import { patchLocalFlowNode, type LocalFlowNode } from '../../../lib/flowNodeStorage'
import { errorMessage } from '../../../lib/errors'
import type { VaultStatus } from '../../../hooks/useKeyVault'
import { createLocalFlowNode, importLocalFlowNode } from './localNodeBuilders'
import type { RequestUserConfirm, RequestUserText } from './useUserPromptDialogs'

interface UseLocalFlowNodeActionsParams {
  clearLastRawBytes: () => void
  clearSelectedLocalNode: () => void
  markNodeOnCanvas: (publicKeyHex: string) => void
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  onCopyPrivateKey: (privateKeyHex: string) => Promise<void>
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  requestConfirm: RequestUserConfirm
  requestText: RequestUserText
  selectLocalNode: (id: string) => void
  selectedLocalNode: LocalFlowNode | null
  vaultStatus: VaultStatus
}

export function useLocalFlowNodeActions({
  clearLastRawBytes,
  clearSelectedLocalNode,
  markNodeOnCanvas,
  notifyError,
  notifyStatus,
  onCopyPrivateKey,
  persistLocalFlowNodes,
  requestConfirm,
  requestText,
  selectLocalNode,
  selectedLocalNode,
  vaultStatus,
}: UseLocalFlowNodeActionsParams) {
  const handleAddFlowNode = useCallback(
    (position?: { x: number; y: number }) => {
      // 关闭态(disabled)与解锁态都可直接操作；仅锁定/设置态需先解锁。
      if (vaultStatus === 'locked' || vaultStatus === 'setup') {
        notifyError('添加节点前请先解锁密钥保险库。')
        return
      }
      const node = createLocalFlowNode(position)
      persistLocalFlowNodes((currentNodes) => [node, ...currentNodes])
      selectLocalNode(node.publicKeyHex)
      // 右键画布放置的节点直接显示；面板新建（无落点）则等待"添加到画布"。
      if (position) markNodeOnCanvas(node.publicKeyHex)
      notifyStatus('流转节点已添加。')
      clearLastRawBytes()
    },
    [
      clearLastRawBytes,
      markNodeOnCanvas,
      notifyError,
      notifyStatus,
      persistLocalFlowNodes,
      selectLocalNode,
      vaultStatus,
    ],
  )

  const handleImportLocalNode = useCallback(async () => {
    if (vaultStatus === 'locked' || vaultStatus === 'setup') {
      notifyError('导入节点前请先解锁密钥保险库。')
      return
    }
    const privateKeyHex = (
      await requestText({
        title: '导入流转节点',
        description: '粘贴本地流转节点私钥，导入后会按当前保险库状态保存。',
        label: '私钥（hex）',
        confirmLabel: '导入',
        placeholder: '64 位十六进制私钥',
      })
    )?.trim()
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
  }, [notifyError, notifyStatus, persistLocalFlowNodes, requestText, selectLocalNode, vaultStatus])

  // 目标节点可显式传入（画布右键菜单直接作用于右键的节点）；省略时回退到当前选中节点。
  const handleRenameLocalNode = useCallback(
    async (target?: LocalFlowNode) => {
      const node = target ?? selectedLocalNode
      if (!node) return
      const next = await requestText({
        title: '重命名流转节点',
        label: '节点名称',
        defaultValue: node.label,
        confirmLabel: '保存',
      })
      if (next == null) return
      const label = (next.trim() || node.label).slice(0, 64)
      persistLocalFlowNodes((currentNodes) =>
        patchLocalFlowNode(currentNodes, node.id, {
          label,
          updatedAt: new Date().toISOString(),
        }),
      )
      notifyStatus('流转节点已重命名。')
    },
    [notifyStatus, persistLocalFlowNodes, requestText, selectedLocalNode],
  )

  const handleDeleteLocalNode = useCallback(
    async (target?: LocalFlowNode) => {
      const node = target ?? selectedLocalNode
      if (!node) return
      const confirmed = await requestConfirm({
        title: '删除本地流转节点',
        description: '对应私钥将从本地存储删除，此操作无法撤销。',
        confirmLabel: '删除',
        destructive: true,
      })
      if (!confirmed) return
      const removedPubkey = node.publicKeyHex
      persistLocalFlowNodes((currentNodes) =>
        currentNodes.filter((current) => current.publicKeyHex !== removedPubkey),
      )
      clearSelectedLocalNode()
      notifyStatus('流转节点已删除。')
    },
    [clearSelectedLocalNode, notifyStatus, persistLocalFlowNodes, requestConfirm, selectedLocalNode],
  )

  const handleExportPrivateKey = useCallback(
    async (target?: LocalFlowNode) => {
      const node = target ?? selectedLocalNode
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
    [onCopyPrivateKey, requestConfirm, selectedLocalNode, vaultStatus],
  )

  return {
    handleAddFlowNode,
    handleDeleteLocalNode,
    handleExportPrivateKey,
    handleImportLocalNode,
    handleRenameLocalNode,
  }
}
