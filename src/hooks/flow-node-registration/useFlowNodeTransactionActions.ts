import {
  getLastBlock,
  sendTransactionMountMsg,
  sendTransactionRecordMsg,
  type ApiClient,
} from '@nmsci/sdk'
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { shortId } from '../../lib/chainGraph'
import type { LocalConsumeNode } from '../../lib/consumeNodeStorage'
import { normalizeNBitsHex } from '../../lib/difficulty'
import { errorMessage } from '../../lib/errors'
import type { LocalFlowNode } from '../../lib/flowNodeStorage'
import {
  buildTransactionMountMessage,
  buildTransactionRecordMessage,
  makeMessageId,
  normalizePubkeyHex,
} from '../../lib/messageBuilders'
import type { LocalTxRecord } from '../../lib/txRecordStorage'
import type { QueryMode } from '../../lib/types'
import type { OperationFeedbackAction } from './feedback'
import { assertKeypairIntegrity, INT64_MAX } from './validation'

// 一条消费记录由消费节点支付给流转节点；双方私钥都需在本地钥匙环里。
export interface TransactionRecordDraft {
  flowNodePubkey: string
  consumeNodePubkey: string
  amount: string
  currencyType: number
}

interface UseFlowNodeTransactionActionsParams {
  clearSelectedLocalNode: () => void
  client: ApiClient
  dispatch: Dispatch<OperationFeedbackAction>
  localConsumeNodes: LocalConsumeNode[]
  localFlowNodes: LocalFlowNode[]
  localTxRecords: LocalTxRecord[]
  persistTxRecords: (updater: (records: LocalTxRecord[]) => LocalTxRecord[]) => void
  runQuery: (override?: { mode: QueryMode; nodeId: string }) => Promise<void>
  setMiningAttempts: Dispatch<SetStateAction<number | null>>
}

// 难度目标与中心公钥统一从最新区块拉取（交易难度=transactionDifficultyTarget），无需手动填写。
async function fetchTransactionContext(client: ApiClient) {
  const block = (await getLastBlock(client)).data
  if (!block.transactionDifficultyTarget) {
    throw new Error('最新区块未包含交易难度目标')
  }
  if (!block.centralPubkey) {
    throw new Error('最新区块未包含中心公钥')
  }
  return {
    difficultyHex: normalizeNBitsHex(block.transactionDifficultyTarget, '交易难度'),
    centralPubkeyHex: normalizePubkeyHex(block.centralPubkey),
  }
}

export function useFlowNodeTransactionActions({
  clearSelectedLocalNode,
  client,
  dispatch,
  localConsumeNodes,
  localFlowNodes,
  localTxRecords,
  persistTxRecords,
  runQuery,
  setMiningAttempts,
}: UseFlowNodeTransactionActionsParams) {
  const [mountedPubkey, setMountedPubkey] = useState<string | null>(null)

  const createTransactionRecord = useCallback(
    async (draft: TransactionRecordDraft) => {
      const flowNode = localFlowNodes.find((node) => node.publicKeyHex === draft.flowNodePubkey)
      const consumeNode = localConsumeNodes.find(
        (node) => node.publicKeyHex === draft.consumeNodePubkey,
      )
      if (!flowNode) {
        dispatch({ type: 'FAILURE', error: '请选择一个当前钥匙环中的流转节点。' })
        return
      }
      if (!consumeNode) {
        dispatch({ type: 'FAILURE', error: '请选择一个当前钥匙环中的消费节点。' })
        return
      }
      dispatch({ type: 'START', busy: 'record' })
      setMiningAttempts(0)
      try {
        assertKeypairIntegrity(consumeNode)
        assertKeypairIntegrity(flowNode)
        const amountValue = BigInt(draft.amount)
        if (amountValue < 1n || amountValue > INT64_MAX) {
          throw new Error('金额必须是 int64 协议范围内的正整数。')
        }
        const { difficultyHex, centralPubkeyHex } = await fetchTransactionContext(client)
        const messageId = makeMessageId()
        const built = await buildTransactionRecordMessage(
          {
            uuid: messageId,
            amount: amountValue,
            currencyType: draft.currencyType,
            difficultyHex,
            consumeNodePubkeyHex: consumeNode.publicKeyHex,
            flowNodePubkeyHex: flowNode.publicKeyHex,
            centralPubkeyHex,
            consumePrivateKeyHex: consumeNode.privateKeyHex,
            flowPrivateKeyHex: flowNode.privateKeyHex,
          },
          (attempts) => setMiningAttempts(attempts),
        )
        const response = (await sendTransactionRecordMsg(client, built.bytes)).data
        const record: LocalTxRecord = {
          id: response.id ?? messageId,
          uuid: messageId,
          amount: draft.amount,
          currencyType: draft.currencyType,
          consumeNodePubkey: consumeNode.publicKeyHex,
          flowNodePubkey: flowNode.publicKeyHex,
          centralPubkey: centralPubkeyHex,
          txid: response.txid,
          rawBytesHex: built.rawBytesHex,
          status: 'sent',
          createdAt: new Date().toISOString(),
        }
        persistTxRecords((current) => [record, ...current])
        dispatch({ type: 'SUCCESS', status: `交易记录已创建（${shortId(record.id)}）。` })
      } catch (operationError) {
        dispatch({ type: 'FAILURE', error: errorMessage(operationError, '创建交易记录失败') })
      } finally {
        dispatch({ type: 'SET_BUSY', busy: null })
        setMiningAttempts(null)
      }
    },
    [client, dispatch, localConsumeNodes, localFlowNodes, persistTxRecords, setMiningAttempts],
  )

  const createTransactionMount = useCallback(
    async (recordId: string, flowNodePubkey: string) => {
      const record = localTxRecords.find((candidate) => candidate.id === recordId)
      if (!record) {
        dispatch({ type: 'FAILURE', error: '请选择一条已创建的交易记录。' })
        return
      }
      const consumeNode = localConsumeNodes.find(
        (node) => node.publicKeyHex === record.consumeNodePubkey,
      )
      const flowNode = localFlowNodes.find((node) => node.publicKeyHex === flowNodePubkey)
      if (!consumeNode) {
        dispatch({ type: 'FAILURE', error: '此记录对应的消费节点不在当前钥匙环中。' })
        return
      }
      if (!flowNode) {
        dispatch({ type: 'FAILURE', error: '请选择一个当前钥匙环中的流转节点。' })
        return
      }
      dispatch({ type: 'START', busy: 'mount' })
      setMiningAttempts(0)
      setMountedPubkey(null)
      try {
        assertKeypairIntegrity(consumeNode)
        assertKeypairIntegrity(flowNode)
        const { difficultyHex } = await fetchTransactionContext(client)
        const built = await buildTransactionMountMessage(
          {
            uuid: makeMessageId(),
            mountedTransactionRecordId: record.id,
            difficultyHex,
            consumeNodePubkeyHex: record.consumeNodePubkey,
            flowNodePubkeyHex: flowNode.publicKeyHex,
            centralPubkeyHex: record.centralPubkey,
            consumePrivateKeyHex: consumeNode.privateKeyHex,
            flowPrivateKeyHex: flowNode.privateKeyHex,
          },
          (attempts) => setMiningAttempts(attempts),
        )
        await sendTransactionMountMsg(client, built.bytes)
        setMountedPubkey(flowNode.publicKeyHex)
        dispatch({ type: 'SUCCESS', status: '交易已挂载。查看消费链即可在图谱中看到结果。' })
      } catch (operationError) {
        dispatch({ type: 'FAILURE', error: errorMessage(operationError, '挂载交易失败') })
      } finally {
        dispatch({ type: 'SET_BUSY', busy: null })
        setMiningAttempts(null)
      }
    },
    [client, dispatch, localConsumeNodes, localFlowNodes, localTxRecords, setMiningAttempts],
  )

  const viewConsumeChain = useCallback(() => {
    if (!mountedPubkey) return
    clearSelectedLocalNode()
    void runQuery({ mode: 'node', nodeId: mountedPubkey })
  }, [clearSelectedLocalNode, mountedPubkey, runQuery])

  const clearMountedPubkey = useCallback(() => setMountedPubkey(null), [])

  return {
    mountedPubkey,
    createTransactionRecord,
    createTransactionMount,
    viewConsumeChain,
    clearMountedPubkey,
  }
}
