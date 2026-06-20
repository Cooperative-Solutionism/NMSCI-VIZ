import type { ApiClient } from '@nmsci/sdk'
import { useCallback, useMemo, useState } from 'react'
import type { LocalConsumeNode } from '../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import type { LocalTxRecord } from '../lib/txRecordStorage'
import { type FlowNodeBusyState, useOperationFeedback } from './flow-node-registration/feedback'
import { useFlowNodeLifecycleActions } from './flow-node-registration/useFlowNodeLifecycleActions'
import { useFlowNodeTransactionActions } from './flow-node-registration/useFlowNodeTransactionActions'

export type { FlowNodeBusyState }

interface UseFlowNodeRegistrationParams {
  client: ApiClient
  localFlowNodes: LocalFlowNode[]
  localConsumeNodes: LocalConsumeNode[]
  localTxRecords: LocalTxRecord[]
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  persistTxRecords: (updater: (records: LocalTxRecord[]) => LocalTxRecord[]) => void
  reloadLocalNodeState: (pubkey: string) => void
  loadConsumeChain: (nodePubkey: string) => Promise<void>
  clearSelectedLocalNode: () => void
}

export function useFlowNodeRegistration({
  client,
  localFlowNodes,
  localConsumeNodes,
  localTxRecords,
  persistLocalFlowNodes,
  persistTxRecords,
  reloadLocalNodeState,
  loadConsumeChain,
  clearSelectedLocalNode,
}: UseFlowNodeRegistrationParams) {
  const { busy, status, error, dispatch, notifyStatus, notifyError } = useOperationFeedback()
  const [miningAttempts, setMiningAttempts] = useState<number | null>(null)
  const [lastRawBytes, setLastRawBytes] = useState('')

  const clearLastRawBytes = useCallback(() => {
    setLastRawBytes('')
  }, [])

  const lifecycleActions = useFlowNodeLifecycleActions({
    client,
    dispatch,
    persistLocalFlowNodes,
    reloadLocalNodeState,
    setLastRawBytes,
    setMiningAttempts,
  })
  const transactionActions = useFlowNodeTransactionActions({
    clearSelectedLocalNode,
    client,
    dispatch,
    localConsumeNodes,
    localFlowNodes,
    localTxRecords,
    loadConsumeChain,
    persistTxRecords,
    setMiningAttempts,
  })

  return useMemo(
    () => ({
      busy,
      status,
      error,
      miningAttempts,
      lastRawBytes,
      mountedPubkey: transactionActions.mountedPubkey,
      registerFlowNode: lifecycleActions.registerFlowNode,
      authorizeCentralPubkey: lifecycleActions.authorizeCentralPubkey,
      createTransactionRecord: transactionActions.createTransactionRecord,
      createTransactionMount: transactionActions.createTransactionMount,
      viewConsumeChain: transactionActions.viewConsumeChain,
      clearMountedPubkey: transactionActions.clearMountedPubkey,
      notifyStatus,
      notifyError,
      clearLastRawBytes,
    }),
    [
      busy,
      clearLastRawBytes,
      error,
      lastRawBytes,
      lifecycleActions,
      miningAttempts,
      notifyError,
      notifyStatus,
      status,
      transactionActions,
    ],
  )
}
