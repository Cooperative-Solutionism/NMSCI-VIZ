import { ApiClient } from '@nmsci/sdk'
import { useCallback, useMemo } from 'react'
import { useFlowNodeRegistration } from '../../../hooks/useFlowNodeRegistration'
import { useNodeDetail } from '../../../hooks/useNodeDetail'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type { LocalTxRecord } from '../../../lib/txRecordStorage'

export type RegistrationController = ReturnType<typeof useFlowNodeRegistration>

export function useRegistrationController({
  apiBase,
  clearSelectedLocalNode,
  localConsumeNodes,
  localFlowNodes,
  localTxRecords,
  loadConsumeChain,
  persistLocalFlowNodes,
  persistTxRecords,
  selectedLocalNode,
}: {
  apiBase: string
  clearSelectedLocalNode: () => void
  localConsumeNodes: LocalConsumeNode[]
  localFlowNodes: LocalFlowNode[]
  localTxRecords: LocalTxRecord[]
  loadConsumeChain: (nodePubkey: string) => Promise<void>
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  persistTxRecords: (updater: (records: LocalTxRecord[]) => LocalTxRecord[]) => void
  selectedLocalNode: LocalFlowNode | null
}) {
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const { nodeState: localNodeState, loadNodeState: reloadLocalNodeState } = useNodeDetail(
    apiBase,
    selectedLocalNode?.publicKeyHex ?? null,
  )
  const reloadRegistrationNodeState = useCallback(
    (pubkey: string) => {
      void reloadLocalNodeState(pubkey)
    },
    [reloadLocalNodeState],
  )
  const registration = useFlowNodeRegistration({
    client,
    localFlowNodes,
    localConsumeNodes,
    localTxRecords,
    persistLocalFlowNodes,
    persistTxRecords,
    reloadLocalNodeState: reloadRegistrationNodeState,
    loadConsumeChain,
    clearSelectedLocalNode,
  })

  return {
    localNodeState,
    registration,
  }
}
