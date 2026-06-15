import { generateKeyPair, getPublicKeyFromPrivate } from '@nmsci/sdk'
import { useCallback } from 'react'
import { shortId } from '../../../lib/chainGraph'
import { patchLocalConsumeNode, type LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import { errorMessage } from '../../../lib/errors'
import { patchLocalFlowNode, type LocalFlowNode } from '../../../lib/flowNodeStorage'
import { makeMessageId } from '../../../lib/messageBuilders'
import type { QueryMode } from '../../../lib/types'
import type { VaultStatus } from '../../../hooks/useKeyVault'

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
  setMode,
  setNodeId,
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
  setMode: (mode: QueryMode) => void
  setNodeId: (nodeId: string) => void
  vaultStatus: VaultStatus
}) {
  const handleAddFlowNode = useCallback(
    (position?: { x: number; y: number }) => {
      if (vaultStatus !== 'unlocked') {
        notifyError('添加节点前请先解锁密钥保险库。')
        return
      }
      const keypair = generateKeyPair()
      const now = new Date().toISOString()
      const node: LocalFlowNode = {
        id: makeMessageId(),
        label: shortId(keypair.publicKey),
        privateKeyHex: keypair.privateKey,
        publicKeyHex: keypair.publicKey,
        createdAt: now,
        updatedAt: now,
        position,
        authorizations: [],
      }
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

  const handleAddConsumeNode = useCallback(
    (position?: { x: number; y: number }) => {
      if (vaultStatus !== 'unlocked') {
        notifyError('添加节点前请先解锁密钥保险库。')
        return
      }
      const keypair = generateKeyPair()
      const now = new Date().toISOString()
      const node: LocalConsumeNode = {
        id: makeMessageId(),
        label: shortId(keypair.publicKey),
        privateKeyHex: keypair.privateKey,
        publicKeyHex: keypair.publicKey,
        createdAt: now,
        updatedAt: now,
        position,
      }
      persistLocalConsumeNodes((currentNodes) => [node, ...currentNodes])
      selectLocalNode(node.publicKeyHex)
      notifyStatus('消费节点已添加。')
    },
    [notifyError, notifyStatus, persistLocalConsumeNodes, selectLocalNode, vaultStatus],
  )

  const handleImportLocalNode = useCallback(() => {
    if (vaultStatus !== 'unlocked') {
      notifyError('导入节点前请先解锁密钥保险库。')
      return
    }
    const privateKeyHex = window.prompt('粘贴私钥（hex）')?.trim()
    if (!privateKeyHex) return
    try {
      const publicKeyHex = getPublicKeyFromPrivate(privateKeyHex)
      const now = new Date().toISOString()
      const node: LocalFlowNode = {
        id: makeMessageId(),
        label: shortId(publicKeyHex),
        privateKeyHex,
        publicKeyHex,
        createdAt: now,
        updatedAt: now,
        authorizations: [],
      }
      persistLocalFlowNodes((currentNodes) => [
        node,
        ...currentNodes.filter((current) => current.publicKeyHex !== publicKeyHex),
      ])
      selectLocalNode(publicKeyHex)
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

  const handleQuerySelectedFlowNode = useCallback(() => {
    if (!selectedLocalNode) return
    setMode('node')
    setNodeId(selectedLocalNode.publicKeyHex)
    notifyStatus('流转节点公钥已填入查询。')
  }, [notifyStatus, selectedLocalNode, setMode, setNodeId])

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

  const handleExportPrivateKey = useCallback(async () => {
    if (!selectedLocalNode) return
    const confirmed = window.confirm('从 localStorage 导出私钥？解锁后私钥会以明文复制。')
    if (!confirmed) return
    await handleCopyText(selectedLocalNode.privateKeyHex, '私钥')
  }, [handleCopyText, selectedLocalNode])

  const handleExportConsumeKey = useCallback(async () => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('从 localStorage 导出私钥？解锁后私钥会以明文复制。')) return
    await handleCopyText(selectedLocalConsumeNode.privateKeyHex, '私钥')
  }, [handleCopyText, selectedLocalConsumeNode])

  return {
    handleAddConsumeNode,
    handleAddFlowNode,
    handleCopyText,
    handleDeleteConsumeNode,
    handleDeleteLocalNode,
    handleExportConsumeKey,
    handleExportPrivateKey,
    handleImportLocalNode,
    handleQuerySelectedFlowNode,
    handleRenameConsumeNode,
    handleRenameLocalNode,
  }
}
