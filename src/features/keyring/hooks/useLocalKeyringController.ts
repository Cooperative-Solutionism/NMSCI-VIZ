import { useCallback, useEffect, useRef, useState } from 'react'
import { useKeyVault, type SecretCodec } from '../../../hooks/useKeyVault'
import {
  hasLegacyPlaintextConsumeNodes,
  loadLocalConsumeNodes,
  saveLocalConsumeNodes,
  saveLocalConsumeNodesPlaintext,
  type LocalConsumeNode,
} from '../../../lib/consumeNodeStorage'
import {
  hasLegacyPlaintextFlowNodes,
  loadLocalFlowNodes,
  saveLocalFlowNodes,
  saveLocalFlowNodesPlaintext,
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
  const [keyringReady, setKeyringReady] = useState(false)
  const keyringLoadedRef = useRef(false)
  const activeStorageModeRef = useRef<'encrypted' | 'plaintext'>(
    vault.codec ? 'encrypted' : 'plaintext',
  )
  // 每个存储键一条写入队列：所有落盘按提交顺序串行执行，避免在途加密写入与后续写入（含关闭保险库的明文重存）
  // 竞争同一 localStorage 键导致最后写入者覆盖、留下无法解密的孤立密文。
  const flowWriteRef = useRef<Promise<unknown>>(Promise.resolve())
  const consumeWriteRef = useRef<Promise<unknown>>(Promise.resolve())

  useEffect(() => {
    activeStorageModeRef.current = vault.codec ? 'encrypted' : 'plaintext'
  }, [vault.codec])

  const enqueueFlowNodeSave = useCallback((nodes: LocalFlowNode[], codec: SecretCodec | null) => {
    flowWriteRef.current = flowWriteRef.current
      .catch(() => {})
      .then(() => {
        if (codec && activeStorageModeRef.current !== 'encrypted') return
        return saveLocalFlowNodes(nodes, codec)
      })
      .catch((persistError) => {
        console.error(
          `Failed to persist ${codec ? 'encrypted' : 'plaintext'} flow-node keyring:`,
          persistError,
        )
      })
    return flowWriteRef.current
  }, [])

  const enqueueConsumeNodeSave = useCallback(
    (nodes: LocalConsumeNode[], codec: SecretCodec | null) => {
      consumeWriteRef.current = consumeWriteRef.current
        .catch(() => {})
        .then(() => {
          if (codec && activeStorageModeRef.current !== 'encrypted') return
          return saveLocalConsumeNodes(nodes, codec)
        })
        .catch((persistError) => {
          console.error(
            `Failed to persist ${codec ? 'encrypted' : 'plaintext'} consume-node keyring:`,
            persistError,
          )
        })
      return consumeWriteRef.current
    },
    [],
  )

  const persistLocalFlowNodes = useCallback(
    (updater: (currentNodes: LocalFlowNode[]) => LocalFlowNode[]) => {
      setLocalFlowNodes((currentNodes) => {
        const nextNodes = updater(currentNodes)
        void enqueueFlowNodeSave(nextNodes, vault.codec)
        return nextNodes
      })
    },
    [enqueueFlowNodeSave, vault.codec],
  )

  const persistLocalConsumeNodes = useCallback(
    (updater: (currentNodes: LocalConsumeNode[]) => LocalConsumeNode[]) => {
      setLocalConsumeNodes((currentNodes) => {
        const nextNodes = updater(currentNodes)
        void enqueueConsumeNodeSave(nextNodes, vault.codec)
        return nextNodes
      })
    },
    [enqueueConsumeNodeSave, vault.codec],
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
    setKeyringReady(false)
    setLocalFlowNodes([])
    setLocalConsumeNodes([])
    clearSelectedLocalNode()
  }, [clearSelectedLocalNode, vault])

  // 关闭保险库：先同步写入明文快照并清空会话密钥/盐，确保立即刷新也不再进入解锁流程。
  // 随后把同一份明文快照追加到写入队列尾部，避免任何在途加密写入最后覆盖回密文。
  const handleDisableVault = useCallback(() => {
    const disableWithSnapshot = (
      flowNodesSnapshot: LocalFlowNode[],
      consumeNodesSnapshot: LocalConsumeNode[],
    ) => {
      activeStorageModeRef.current = 'plaintext'
      try {
        saveLocalFlowNodesPlaintext(flowNodesSnapshot)
        saveLocalConsumeNodesPlaintext(consumeNodesSnapshot)
      } catch (persistError) {
        console.error('Failed to persist plaintext keyring before disabling vault:', persistError)
        return
      }

      setLocalFlowNodes(flowNodesSnapshot)
      setLocalConsumeNodes(consumeNodesSnapshot)
      vault.disable()

      void enqueueFlowNodeSave(flowNodesSnapshot, null)
      void enqueueConsumeNodeSave(consumeNodesSnapshot, null)
    }

    const codec = vault.codec
    if (codec && !keyringReady) {
      void (async () => {
        try {
          const [flowNodesSnapshot, consumeNodesSnapshot] = await Promise.all([
            loadLocalFlowNodes(codec),
            loadLocalConsumeNodes(codec),
          ])
          disableWithSnapshot(flowNodesSnapshot, consumeNodesSnapshot)
        } catch (loadError) {
          console.error('Failed to load keyring before disabling vault:', loadError)
        }
      })()
      return
    }

    disableWithSnapshot(localFlowNodes, localConsumeNodes)
  }, [
    enqueueConsumeNodeSave,
    enqueueFlowNodeSave,
    keyringReady,
    localConsumeNodes,
    localFlowNodes,
    vault,
  ])

  useEffect(() => {
    // 锁定/设置态不加载密钥环（需先解锁/创建口令）。关闭态(codec=null)与解锁态(codec≠null)都加载。
    if (vault.status === 'locked' || vault.status === 'setup') {
      keyringLoadedRef.current = false
      return
    }
    if (keyringLoadedRef.current) return
    keyringLoadedRef.current = true
    const codec = vault.codec
    let cancelled = false
    void (async () => {
      try {
        const flowNodes = await loadLocalFlowNodes(codec)
        const consumeNodes = await loadLocalConsumeNodes(codec)
        if (cancelled) return
        setLocalFlowNodes(flowNodes)
        setLocalConsumeNodes(consumeNodes)
        if (cancelled) return
        // 仅在已启用并解锁（codec≠null）时把旧版/明文私钥迁移为密文；关闭态保持明文。
        if (codec) {
          const migrations: Array<Promise<unknown>> = []
          if (hasLegacyPlaintextFlowNodes()) migrations.push(enqueueFlowNodeSave(flowNodes, codec))
          if (hasLegacyPlaintextConsumeNodes()) {
            migrations.push(enqueueConsumeNodeSave(consumeNodes, codec))
          }
          await Promise.all(migrations)
        }
      } catch (loadError) {
        console.error('Failed to load keyring:', loadError)
      } finally {
        if (!cancelled) setKeyringReady(true)
      }
    })()
    return () => {
      cancelled = true
      keyringLoadedRef.current = false
    }
  }, [enqueueConsumeNodeSave, enqueueFlowNodeSave, vault.status, vault.codec])

  return {
    handleDisableVault,
    handleLockVault,
    keyringReady,
    localConsumeNodes,
    localFlowNodes,
    localTxRecords,
    persistLocalConsumeNodes,
    persistLocalFlowNodes,
    persistTxRecords,
    vault,
  }
}
