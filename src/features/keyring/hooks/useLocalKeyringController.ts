import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeyVault } from '../../../hooks/useKeyVault'
import {
  hasLegacyPlaintextConsumeNodes,
  loadLocalConsumeNodes,
  saveLocalConsumeNodes,
  type LocalConsumeNode,
} from '../../../lib/consumeNodeStorage'
import {
  hasLegacyPlaintextFlowNodes,
  loadLocalFlowNodes,
  saveLocalFlowNodes,
  type LocalFlowNode,
} from '../../../lib/flowNodeStorage'
import {
  loadLocalTxRecords,
  saveLocalTxRecords,
  type LocalTxRecord,
} from '../../../lib/txRecordStorage'

export function useLocalKeyringController({
  clearSelectedLocalNode,
}: {
  clearSelectedLocalNode: () => void
}) {
  const vault = useKeyVault()
  const [localFlowNodes, setLocalFlowNodes] = useState<LocalFlowNode[]>([])
  const [localConsumeNodes, setLocalConsumeNodes] = useState<LocalConsumeNode[]>([])
  const [localTxRecords, setLocalTxRecords] = useState<LocalTxRecord[]>(() => loadLocalTxRecords())
  const keyringLoadedRef = useRef(false)

  const persistLocalFlowNodes = useCallback(
    (updater: (currentNodes: LocalFlowNode[]) => LocalFlowNode[]) => {
      setLocalFlowNodes((currentNodes) => {
        const nextNodes = updater(currentNodes)
        void saveLocalFlowNodes(nextNodes, vault.codec).catch((persistError) => {
          console.error('Failed to persist encrypted flow-node keyring:', persistError)
        })
        return nextNodes
      })
    },
    [vault.codec],
  )

  const persistLocalConsumeNodes = useCallback(
    (updater: (currentNodes: LocalConsumeNode[]) => LocalConsumeNode[]) => {
      setLocalConsumeNodes((currentNodes) => {
        const nextNodes = updater(currentNodes)
        void saveLocalConsumeNodes(nextNodes, vault.codec).catch((persistError) => {
          console.error('Failed to persist encrypted consume-node keyring:', persistError)
        })
        return nextNodes
      })
    },
    [vault.codec],
  )

  const persistTxRecords = useCallback(
    (updater: (currentRecords: LocalTxRecord[]) => LocalTxRecord[]) => {
      setLocalTxRecords((currentRecords) => {
        const nextRecords = updater(currentRecords)
        saveLocalTxRecords(nextRecords)
        return nextRecords
      })
    },
    [],
  )

  const handleLockVault = useCallback(() => {
    vault.lock()
    setLocalFlowNodes([])
    setLocalConsumeNodes([])
    clearSelectedLocalNode()
  }, [clearSelectedLocalNode, vault])

  useEffect(() => {
    if (vault.status !== 'unlocked') {
      keyringLoadedRef.current = false
      return
    }
    if (keyringLoadedRef.current) return
    keyringLoadedRef.current = true
    let cancelled = false
    void (async () => {
      try {
        const flowNodes = await loadLocalFlowNodes(vault.codec)
        const consumeNodes = await loadLocalConsumeNodes(vault.codec)
        if (cancelled) return
        setLocalFlowNodes(flowNodes)
        setLocalConsumeNodes(consumeNodes)
        if (hasLegacyPlaintextFlowNodes()) await saveLocalFlowNodes(flowNodes, vault.codec)
        if (hasLegacyPlaintextConsumeNodes()) await saveLocalConsumeNodes(consumeNodes, vault.codec)
      } catch (loadError) {
        console.error('Failed to load encrypted keyring:', loadError)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault.status, vault.codec])

  return {
    handleLockVault,
    localConsumeNodes,
    localFlowNodes,
    localTxRecords,
    persistLocalConsumeNodes,
    persistLocalFlowNodes,
    persistTxRecords,
    vault,
  }
}
