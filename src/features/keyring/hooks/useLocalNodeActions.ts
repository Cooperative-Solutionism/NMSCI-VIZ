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
        notifyError('Unlock your key vault before adding nodes.')
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
      notifyStatus('Flow node added.')
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
        notifyError('Unlock your key vault before adding nodes.')
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
      notifyStatus('Consume node added.')
    },
    [notifyError, notifyStatus, persistLocalConsumeNodes, selectLocalNode, vaultStatus],
  )

  const handleImportLocalNode = useCallback(() => {
    if (vaultStatus !== 'unlocked') {
      notifyError('Unlock your key vault before importing a node.')
      return
    }
    const privateKeyHex = window.prompt('Paste a private key (hex)')?.trim()
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
      notifyStatus('Flow node imported.')
    } catch (importError) {
      notifyError(errorMessage(importError, 'Invalid private key'))
    }
  }, [notifyError, notifyStatus, persistLocalFlowNodes, selectLocalNode, vaultStatus])

  const handleRenameLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    const next = window.prompt('Rename flow node', selectedLocalNode.label)
    if (next == null) return
    const label = (next.trim() || selectedLocalNode.label).slice(0, 64)
    persistLocalFlowNodes((currentNodes) =>
      patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
        label,
        updatedAt: new Date().toISOString(),
      }),
    )
    notifyStatus('Flow node renamed.')
  }, [notifyStatus, persistLocalFlowNodes, selectedLocalNode])

  const handleDeleteLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    if (!window.confirm('Delete this local flow node? Its private key will be lost.')) return
    const removedPubkey = selectedLocalNode.publicKeyHex
    persistLocalFlowNodes((currentNodes) =>
      currentNodes.filter((current) => current.publicKeyHex !== removedPubkey),
    )
    clearSelectedLocalNode()
    notifyStatus('Flow node deleted.')
  }, [clearSelectedLocalNode, notifyStatus, persistLocalFlowNodes, selectedLocalNode])

  const handleRenameConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    const next = window.prompt('Rename consume node', selectedLocalConsumeNode.label)
    if (next == null) return
    const label = (next.trim() || selectedLocalConsumeNode.label).slice(0, 64)
    persistLocalConsumeNodes((currentNodes) =>
      patchLocalConsumeNode(currentNodes, selectedLocalConsumeNode.id, {
        label,
        updatedAt: new Date().toISOString(),
      }),
    )
    notifyStatus('Consume node renamed.')
  }, [notifyStatus, persistLocalConsumeNodes, selectedLocalConsumeNode])

  const handleDeleteConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('Delete this consume node? Its private key will be lost.')) return
    const removedPubkey = selectedLocalConsumeNode.publicKeyHex
    persistLocalConsumeNodes((currentNodes) =>
      currentNodes.filter((current) => current.publicKeyHex !== removedPubkey),
    )
    clearSelectedLocalNode()
    notifyStatus('Consume node deleted.')
  }, [clearSelectedLocalNode, notifyStatus, persistLocalConsumeNodes, selectedLocalConsumeNode])

  const handleQuerySelectedFlowNode = useCallback(() => {
    if (!selectedLocalNode) return
    setMode('node')
    setNodeId(selectedLocalNode.publicKeyHex)
    notifyStatus('Flow node public key filled into query.')
  }, [notifyStatus, selectedLocalNode, setMode, setNodeId])

  const handleCopyText = useCallback(
    async (value: string, label: string) => {
      try {
        await navigator.clipboard.writeText(value)
        notifyStatus(`${label} copied.`)
      } catch (clipboardError) {
        notifyError(errorMessage(clipboardError, 'Clipboard unavailable'))
      }
    },
    [notifyError, notifyStatus],
  )

  const handleExportPrivateKey = useCallback(async () => {
    if (!selectedLocalNode) return
    const confirmed = window.confirm(
      'Export private key from localStorage? It is stored in clear text.',
    )
    if (!confirmed) return
    await handleCopyText(selectedLocalNode.privateKeyHex, 'Private key')
  }, [handleCopyText, selectedLocalNode])

  const handleExportConsumeKey = useCallback(async () => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('Export private key from localStorage? It is stored in clear text.')) return
    await handleCopyText(selectedLocalConsumeNode.privateKeyHex, 'Private key')
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
