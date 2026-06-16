import {
  getDifficulty,
  sendTransactionMountMsg,
  sendTransactionRecordMsg,
  type ApiClient,
} from '@nmsci/sdk'
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import type { TransactionRecordDraft } from '../../components'
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

interface UseFlowNodeTransactionActionsParams {
  clearSelectedLocalNode: () => void
  client: ApiClient
  dispatch: Dispatch<OperationFeedbackAction>
  localConsumeNodes: LocalConsumeNode[]
  localFlowNodes: LocalFlowNode[]
  localTxRecords: LocalTxRecord[]
  persistTxRecords: (updater: (records: LocalTxRecord[]) => LocalTxRecord[]) => void
  runQuery: (override?: { mode: QueryMode; nodeId: string }) => Promise<void>
  selectedLocalNode: LocalFlowNode | null
  setMiningAttempts: Dispatch<SetStateAction<number | null>>
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
  selectedLocalNode,
  setMiningAttempts,
}: UseFlowNodeTransactionActionsParams) {
  const [txDifficulty, setTxDifficulty] = useState('1d00ffff')
  const [recordFormOpen, setRecordFormOpen] = useState(false)
  const [mountFormOpen, setMountFormOpen] = useState(false)
  const [mountedPubkey, setMountedPubkey] = useState<string | null>(null)

  const prefetchTxDifficulty = useCallback(async () => {
    try {
      setTxDifficulty((await getDifficulty(client)).data.transaction.nbitsHex)
    } catch (difficultyError) {
      console.error('Failed to prefetch transaction difficulty:', difficultyError)
    }
  }, [client])

  const toggleRecordForm = useCallback(() => {
    if (recordFormOpen) {
      setRecordFormOpen(false)
      return
    }
    void (async () => {
      await prefetchTxDifficulty()
      setRecordFormOpen(true)
    })()
  }, [prefetchTxDifficulty, recordFormOpen])

  const createTransactionRecord = useCallback(
    async (draft: TransactionRecordDraft) => {
      if (!selectedLocalNode) return
      const consumeNode = localConsumeNodes.find(
        (node) => node.publicKeyHex === draft.consumeNodePubkey,
      )
      if (!consumeNode) {
        dispatch({ type: 'FAILURE', error: '请先添加或选择一个消费节点。' })
        return
      }
      dispatch({ type: 'START', busy: 'record' })
      setMiningAttempts(0)
      try {
        assertKeypairIntegrity(consumeNode)
        assertKeypairIntegrity(selectedLocalNode)
        const amountValue = BigInt(draft.amount)
        if (amountValue < 1n || amountValue > INT64_MAX) {
          throw new Error('金额必须是 int64 协议范围内的正整数。')
        }
        const messageId = makeMessageId()
        const centralPubkeyHex = normalizePubkeyHex(draft.centralPubkey)
        const built = await buildTransactionRecordMessage(
          {
            uuid: messageId,
            amount: amountValue,
            currencyType: draft.currencyType,
            difficultyHex: normalizeNBitsHex(draft.difficultyHex, '交易难度'),
            consumeNodePubkeyHex: consumeNode.publicKeyHex,
            flowNodePubkeyHex: selectedLocalNode.publicKeyHex,
            centralPubkeyHex,
            consumePrivateKeyHex: consumeNode.privateKeyHex,
            flowPrivateKeyHex: selectedLocalNode.privateKeyHex,
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
          flowNodePubkey: selectedLocalNode.publicKeyHex,
          centralPubkey: centralPubkeyHex,
          txid: response.txid,
          rawBytesHex: built.rawBytesHex,
          status: 'sent',
          createdAt: new Date().toISOString(),
        }
        persistTxRecords((current) => [record, ...current])
        setRecordFormOpen(false)
        dispatch({ type: 'SUCCESS', status: `交易记录已创建（${shortId(record.id)}）。` })
      } catch (operationError) {
        dispatch({
          type: 'FAILURE',
          error: errorMessage(operationError, '创建交易记录失败'),
        })
      } finally {
        dispatch({ type: 'SET_BUSY', busy: null })
        setMiningAttempts(null)
      }
    },
    [client, dispatch, localConsumeNodes, persistTxRecords, selectedLocalNode, setMiningAttempts],
  )

  const toggleMountForm = useCallback(() => {
    if (mountFormOpen) {
      setMountFormOpen(false)
      return
    }
    void (async () => {
      await prefetchTxDifficulty()
      setMountFormOpen(true)
    })()
  }, [mountFormOpen, prefetchTxDifficulty])

  const createTransactionMount = useCallback(
    async (recordId: string, difficultyHex: string) => {
      const record = localTxRecords.find((candidate) => candidate.id === recordId)
      if (!record) return
      const consumeNode = localConsumeNodes.find(
        (node) => node.publicKeyHex === record.consumeNodePubkey,
      )
      const flowNode = localFlowNodes.find((node) => node.publicKeyHex === record.flowNodePubkey)
      if (!consumeNode || !flowNode) {
        dispatch({ type: 'FAILURE', error: '此记录对应的消费/流转节点不在当前密钥环中。' })
        return
      }
      dispatch({ type: 'START', busy: 'mount' })
      setMiningAttempts(0)
      setMountedPubkey(null)
      try {
        assertKeypairIntegrity(consumeNode)
        assertKeypairIntegrity(flowNode)
        const built = await buildTransactionMountMessage(
          {
            uuid: makeMessageId(),
            mountedTransactionRecordId: record.id,
            difficultyHex: normalizeNBitsHex(difficultyHex, '挂载难度'),
            consumeNodePubkeyHex: record.consumeNodePubkey,
            flowNodePubkeyHex: record.flowNodePubkey,
            centralPubkeyHex: record.centralPubkey,
            consumePrivateKeyHex: consumeNode.privateKeyHex,
            flowPrivateKeyHex: flowNode.privateKeyHex,
          },
          (attempts) => setMiningAttempts(attempts),
        )
        await sendTransactionMountMsg(client, built.bytes)
        setMountedPubkey(record.flowNodePubkey)
        dispatch({ type: 'SUCCESS', status: '交易已挂载。查看消费链即可在图谱中看到结果。' })
      } catch (operationError) {
        dispatch({
          type: 'FAILURE',
          error: errorMessage(operationError, '挂载交易失败'),
        })
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
    setMountFormOpen(false)
    void runQuery({ mode: 'node', nodeId: mountedPubkey })
  }, [clearSelectedLocalNode, mountedPubkey, runQuery])

  return {
    txDifficulty,
    recordFormOpen,
    mountFormOpen,
    mountedPubkey,
    createTransactionRecord,
    createTransactionMount,
    toggleRecordForm,
    toggleMountForm,
    viewConsumeChain,
  }
}
