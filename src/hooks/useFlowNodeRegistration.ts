import {
  getDifficulty,
  getLastBlock,
  getPublicKeyFromPrivate,
  sendCentralPubkeyEmpowerMsg,
  sendFlowNodeRegisterMsg,
  sendTransactionMountMsg,
  sendTransactionRecordMsg,
  type ApiClient,
} from '@nmsci/sdk'
import { useCallback, useMemo, useReducer, useState } from 'react'
import type { TransactionRecordDraft } from '../components'
import { shortId } from '../lib/chainGraph'
import { normalizeNBitsHex } from '../lib/difficulty'
import { errorMessage } from '../lib/errors'
import { type LocalConsumeNode } from '../lib/consumeNodeStorage'
import {
  patchLocalFlowNode,
  type LocalFlowNode,
  type LocalFlowNodeAuthorization,
  type LocalFlowNodeRegistration,
} from '../lib/flowNodeStorage'
import {
  buildEmpowerMessage,
  buildRegisterMessage,
  buildTransactionMountMessage,
  buildTransactionRecordMessage,
  makeMessageId,
  normalizePubkeyHex,
} from '../lib/messageBuilders'
import type { LocalTxRecord } from '../lib/txRecordStorage'
import type { QueryMode } from '../lib/types'

export type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | 'record' | 'mount' | null

interface OperationFeedbackState {
  busy: FlowNodeBusyState
  status: string | null
  error: string | null
}

type OperationFeedbackAction =
  | { type: 'START'; busy: FlowNodeBusyState }
  | { type: 'SUCCESS'; status: string }
  | { type: 'FAILURE'; error: string }
  | { type: 'SET_BUSY'; busy: FlowNodeBusyState }
  | { type: 'NOTIFY_STATUS'; status: string | null }
  | { type: 'NOTIFY_ERROR'; error: string | null }

interface UseFlowNodeRegistrationParams {
  client: ApiClient
  selectedLocalNode: LocalFlowNode | null
  localFlowNodes: LocalFlowNode[]
  localConsumeNodes: LocalConsumeNode[]
  localTxRecords: LocalTxRecord[]
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  persistTxRecords: (updater: (records: LocalTxRecord[]) => LocalTxRecord[]) => void
  reloadLocalNodeState: (pubkey: string) => void
  runQuery: (targetPage: number, override?: { mode: QueryMode; nodeId: string }) => Promise<void>
  clearSelectedLocalNode: () => void
}

const initialFeedbackState: OperationFeedbackState = {
  busy: null,
  status: null,
  error: null,
}

// 协议金额按 int64 序列化，无独立的经济上限常量；以 int64 结构上界做溢出兜底。
const INT64_MAX = 9223372036854775807n

export function useFlowNodeRegistration({
  client,
  selectedLocalNode,
  localFlowNodes,
  localConsumeNodes,
  localTxRecords,
  persistLocalFlowNodes,
  persistTxRecords,
  reloadLocalNodeState,
  runQuery,
  clearSelectedLocalNode,
}: UseFlowNodeRegistrationParams) {
  const [{ busy, status, error }, dispatch] = useReducer(feedbackReducer, initialFeedbackState)
  const [miningAttempts, setMiningAttempts] = useState<number | null>(null)
  const [lastRawBytes, setLastRawBytes] = useState('')
  const [registerDifficultyTarget, setRegisterDifficultyTarget] = useState('')
  const [centralPubkey, setCentralPubkey] = useState('')
  // 默认难度从 getDifficulty 拉取；拉取失败时退回此合法 nBits 占位（与表单 placeholder 一致），保证表单仍可用。
  const [txDifficulty, setTxDifficulty] = useState('1d00ffff')
  const [recordFormOpen, setRecordFormOpen] = useState(false)
  const [mountFormOpen, setMountFormOpen] = useState(false)
  const [mountedPubkey, setMountedPubkey] = useState<string | null>(null)

  const notifyStatus = useCallback((nextStatus: string | null) => {
    dispatch({ type: 'NOTIFY_STATUS', status: nextStatus })
  }, [])

  const notifyError = useCallback((nextError: string | null) => {
    dispatch({ type: 'NOTIFY_ERROR', error: nextError })
  }, [])

  const clearLastRawBytes = useCallback(() => {
    setLastRawBytes('')
  }, [])

  const toggleRecordForm = useCallback(() => {
    if (recordFormOpen) {
      setRecordFormOpen(false)
      return
    }
    // 先拉取交易难度作为表单默认值，再开表单（表单挂载时即带上默认难度）。
    void (async () => {
      try {
        setTxDifficulty((await getDifficulty(client)).data.transaction.nbitsHex)
      } catch (difficultyError) {
        // 默认难度拉取失败不阻塞表单（退回默认占位）；记录以便排查后端不可用。
        console.error('Failed to prefetch transaction difficulty:', difficultyError)
      }
      setRecordFormOpen(true)
    })()
  }, [client, recordFormOpen])

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
    [client, localConsumeNodes, persistTxRecords, selectedLocalNode],
  )

  const toggleMountForm = useCallback(() => {
    if (mountFormOpen) {
      setMountFormOpen(false)
      return
    }
    void (async () => {
      try {
        setTxDifficulty((await getDifficulty(client)).data.transaction.nbitsHex)
      } catch (difficultyError) {
        // 默认难度拉取失败不阻塞表单（退回默认占位）；记录以便排查后端不可用。
        console.error('Failed to prefetch transaction difficulty:', difficultyError)
      }
      setMountFormOpen(true)
    })()
  }, [client, mountFormOpen])

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
    [client, localConsumeNodes, localFlowNodes, localTxRecords],
  )

  const viewConsumeChain = useCallback(() => {
    if (!mountedPubkey) return
    clearSelectedLocalNode()
    setMountFormOpen(false)
    void runQuery(0, { mode: 'node', nodeId: mountedPubkey })
  }, [clearSelectedLocalNode, mountedPubkey, runQuery])

  const fetchRegisterDifficulty = useCallback(async () => {
    dispatch({ type: 'START', busy: 'difficulty' })

    try {
      const block = (await getLastBlock(client)).data
      if (!block.registerDifficultyTarget) {
        throw new Error('最新区块未包含 registerDifficultyTarget')
      }
      setRegisterDifficultyTarget(normalizeNBitsHex(block.registerDifficultyTarget, '注册难度目标'))
      if (block.centralPubkey) {
        setCentralPubkey(block.centralPubkey)
      }
      dispatch({ type: 'SUCCESS', status: `已从区块 ${block.height ?? '-'} 加载最新注册难度。` })
    } catch (operationError) {
      dispatch({
        type: 'FAILURE',
        error: errorMessage(operationError, '加载最新区块失败'),
      })
    } finally {
      dispatch({ type: 'SET_BUSY', busy: null })
    }
  }, [client])

  const registerFlowNode = useCallback(async () => {
    if (!selectedLocalNode) return

    dispatch({ type: 'START', busy: 'register' })
    setMiningAttempts(0)

    let difficultyTarget = ''
    let rawBytesHex = ''
    let nonce = 0
    try {
      difficultyTarget = normalizeNBitsHex(registerDifficultyTarget, '注册难度目标')
      const messageId = makeMessageId()
      const built = await buildRegisterMessage(
        {
          uuid: messageId,
          privateKeyHex: selectedLocalNode.privateKeyHex,
          publicKeyHex: selectedLocalNode.publicKeyHex,
          difficultyHex: difficultyTarget,
        },
        (attempts) => setMiningAttempts(attempts),
      )
      rawBytesHex = built.rawBytesHex
      nonce = built.nonce
      const response = (await sendFlowNodeRegisterMsg(client, built.bytes)).data
      const registration: LocalFlowNodeRegistration = {
        id: response.id ?? messageId,
        rawBytesHex: built.rawBytesHex,
        registerDifficultyTarget: difficultyTarget,
        nonce: built.nonce,
        txid: response.txid,
        status: 'sent',
        message: '注册消息已被后端接受。',
        updatedAt: new Date().toISOString(),
      }

      persistLocalFlowNodes((currentNodes) =>
        patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
          registration,
          updatedAt: registration.updatedAt,
        }),
      )
      setLastRawBytes(built.rawBytesHex)
      dispatch({
        type: 'SUCCESS',
        status: `已注册 ${shortId(selectedLocalNode.publicKeyHex)}，nonce 为 ${built.nonce}。`,
      })
      void reloadLocalNodeState(selectedLocalNode.publicKeyHex)
    } catch (operationError) {
      const message = errorMessage(operationError, '流转节点注册失败')
      const failedAt = new Date().toISOString()
      persistLocalFlowNodes((currentNodes) =>
        patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
          registration: {
            id: makeMessageId(),
            rawBytesHex,
            registerDifficultyTarget: difficultyTarget,
            nonce,
            status: 'failed',
            message,
            updatedAt: failedAt,
          },
          updatedAt: failedAt,
        }),
      )
      dispatch({ type: 'FAILURE', error: message })
    } finally {
      dispatch({ type: 'SET_BUSY', busy: null })
      setMiningAttempts(null)
    }
  }, [
    client,
    persistLocalFlowNodes,
    reloadLocalNodeState,
    registerDifficultyTarget,
    selectedLocalNode,
  ])

  const authorizeCentralPubkey = useCallback(async () => {
    if (!selectedLocalNode) return

    dispatch({ type: 'START', busy: 'authorize' })

    try {
      const normalizedCentralPubkey = normalizePubkeyHex(centralPubkey)
      const messageId = makeMessageId()
      const built = await buildEmpowerMessage({
        uuid: messageId,
        privateKeyHex: selectedLocalNode.privateKeyHex,
        flowNodePubkeyHex: selectedLocalNode.publicKeyHex,
        centralPubkeyHex: normalizedCentralPubkey,
      })
      const response = (await sendCentralPubkeyEmpowerMsg(client, built.bytes)).data
      const authorization: LocalFlowNodeAuthorization = {
        id: response.id ?? messageId,
        centralPubkeyHex: normalizedCentralPubkey,
        rawBytesHex: built.rawBytesHex,
        txid: response.txid,
        status: 'sent',
        message: '授权消息已被后端接受。',
        updatedAt: new Date().toISOString(),
      }

      persistLocalFlowNodes((currentNodes) =>
        patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
          authorizations: [authorization, ...selectedLocalNode.authorizations],
          updatedAt: authorization.updatedAt,
        }),
      )
      setLastRawBytes(built.rawBytesHex)
      dispatch({ type: 'SUCCESS', status: `已授权中心公钥 ${shortId(normalizedCentralPubkey)}。` })
      void reloadLocalNodeState(selectedLocalNode.publicKeyHex)
    } catch (operationError) {
      const message = errorMessage(operationError, '中心公钥授权失败')
      dispatch({ type: 'FAILURE', error: message })
    } finally {
      dispatch({ type: 'SET_BUSY', busy: null })
    }
  }, [centralPubkey, client, persistLocalFlowNodes, reloadLocalNodeState, selectedLocalNode])

  return useMemo(
    () => ({
      busy,
      status,
      error,
      miningAttempts,
      lastRawBytes,
      registerDifficultyTarget,
      setRegisterDifficultyTarget,
      centralPubkey,
      setCentralPubkey,
      txDifficulty,
      recordFormOpen,
      mountFormOpen,
      mountedPubkey,
      fetchRegisterDifficulty,
      registerFlowNode,
      authorizeCentralPubkey,
      createTransactionRecord,
      createTransactionMount,
      toggleRecordForm,
      toggleMountForm,
      viewConsumeChain,
      notifyStatus,
      notifyError,
      clearLastRawBytes,
    }),
    [
      authorizeCentralPubkey,
      busy,
      centralPubkey,
      createTransactionMount,
      createTransactionRecord,
      error,
      fetchRegisterDifficulty,
      lastRawBytes,
      miningAttempts,
      mountFormOpen,
      mountedPubkey,
      notifyError,
      notifyStatus,
      recordFormOpen,
      registerDifficultyTarget,
      registerFlowNode,
      status,
      toggleMountForm,
      toggleRecordForm,
      txDifficulty,
      viewConsumeChain,
      clearLastRawBytes,
    ],
  )
}

function feedbackReducer(
  state: OperationFeedbackState,
  action: OperationFeedbackAction,
): OperationFeedbackState {
  switch (action.type) {
    case 'START':
      return { ...state, busy: action.busy, error: null }
    case 'SUCCESS':
      return { ...state, busy: null, status: action.status }
    case 'FAILURE':
      return { ...state, busy: null, error: action.error }
    case 'SET_BUSY':
      return { ...state, busy: action.busy }
    case 'NOTIFY_STATUS':
      return { ...state, status: action.status, error: null }
    case 'NOTIFY_ERROR':
      return { ...state, status: null, error: action.error }
  }
}

// 校验存储的密钥对未被篡改：私钥派生出的公钥须与存储公钥一致，
// 否则签名会用错密钥、在后端校验前白挖 PoW。getPublicKeyFromPrivate 为确定性派生。
function assertKeypairIntegrity(node: { privateKeyHex: string; publicKeyHex: string }): void {
  if (getPublicKeyFromPrivate(node.privateKeyHex) !== node.publicKeyHex) {
    throw new Error('检测到密钥对损坏：存储的私钥与公钥不匹配。')
  }
}
