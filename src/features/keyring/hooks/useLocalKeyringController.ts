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
  const [keyringReady, setKeyringReady] = useState(false)
  const keyringLoadedRef = useRef(false)
  // 每个存储键一条写入队列：所有落盘按提交顺序串行执行，避免在途加密写入与后续写入（含关闭保险库的明文重存）
  // 竞争同一 localStorage 键导致最后写入者覆盖、留下无法解密的孤立密文。
  const flowWriteRef = useRef<Promise<unknown>>(Promise.resolve())
  const consumeWriteRef = useRef<Promise<unknown>>(Promise.resolve())

  const persistLocalFlowNodes = useCallback(
    (updater: (currentNodes: LocalFlowNode[]) => LocalFlowNode[]) => {
      setLocalFlowNodes((currentNodes) => {
        const nextNodes = updater(currentNodes)
        const codec = vault.codec
        flowWriteRef.current = flowWriteRef.current
          .catch(() => {})
          .then(() => saveLocalFlowNodes(nextNodes, codec))
          .catch((persistError) => {
            console.error(
              `Failed to persist ${codec ? 'encrypted' : 'plaintext'} flow-node keyring:`,
              persistError,
            )
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
        const codec = vault.codec
        consumeWriteRef.current = consumeWriteRef.current
          .catch(() => {})
          .then(() => saveLocalConsumeNodes(nextNodes, codec))
          .catch((persistError) => {
            console.error(
              `Failed to persist ${codec ? 'encrypted' : 'plaintext'} consume-node keyring:`,
              persistError,
            )
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
    setKeyringReady(false)
    setLocalFlowNodes([])
    setLocalConsumeNodes([])
    clearSelectedLocalNode()
  }, [clearSelectedLocalNode, vault])

  // 关闭保险库：把明文重存追加到写入队列尾部（排在任何在途加密写入之后），落盘确认后再清空会话密钥/盐
  // 回到关闭态——保证关闭时磁盘上已是明文，绝不留下因丢钥而无法解密的孤立密文。
  const handleDisableVault = useCallback(() => {
    flowWriteRef.current = flowWriteRef.current
      .catch(() => {})
      .then(() => saveLocalFlowNodes(localFlowNodes, null))
      .catch((persistError) => {
        console.error('Failed to persist plaintext flow-node keyring:', persistError)
      })
    consumeWriteRef.current = consumeWriteRef.current
      .catch(() => {})
      .then(() => saveLocalConsumeNodes(localConsumeNodes, null))
      .catch((persistError) => {
        console.error('Failed to persist plaintext consume-node keyring:', persistError)
      })
    void Promise.allSettled([flowWriteRef.current, consumeWriteRef.current]).then(() => {
      vault.disable()
    })
  }, [localConsumeNodes, localFlowNodes, vault])

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
        // 仅在已启用并解锁（codec≠null）时把旧版/明文私钥迁移为密文；关闭态保持明文。
        if (codec) {
          if (hasLegacyPlaintextFlowNodes()) await saveLocalFlowNodes(flowNodes, codec)
          if (hasLegacyPlaintextConsumeNodes()) await saveLocalConsumeNodes(consumeNodes, codec)
        }
      } catch (loadError) {
        console.error('Failed to load keyring:', loadError)
      } finally {
        if (!cancelled) setKeyringReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [vault.status, vault.codec])

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
