import {
  getLastBlock,
  sendCentralPubkeyEmpowerMsg,
  sendFlowNodeRegisterMsg,
  type ApiClient,
} from '@nmsci/sdk'
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { shortId } from '../../lib/chainGraph'
import { normalizeNBitsHex } from '../../lib/difficulty'
import { errorMessage } from '../../lib/errors'
import {
  patchLocalFlowNode,
  type LocalFlowNode,
  type LocalFlowNodeAuthorization,
  type LocalFlowNodeRegistration,
} from '../../lib/flowNodeStorage'
import {
  buildEmpowerMessage,
  buildRegisterMessage,
  makeMessageId,
  normalizePubkeyHex,
} from '../../lib/messageBuilders'
import type { OperationFeedbackAction } from './feedback'

interface UseFlowNodeLifecycleActionsParams {
  client: ApiClient
  dispatch: Dispatch<OperationFeedbackAction>
  persistLocalFlowNodes: (updater: (nodes: LocalFlowNode[]) => LocalFlowNode[]) => void
  reloadLocalNodeState: (pubkey: string) => void
  selectedLocalNode: LocalFlowNode | null
  setLastRawBytes: Dispatch<SetStateAction<string>>
  setMiningAttempts: Dispatch<SetStateAction<number | null>>
}

export function useFlowNodeLifecycleActions({
  client,
  dispatch,
  persistLocalFlowNodes,
  reloadLocalNodeState,
  selectedLocalNode,
  setLastRawBytes,
  setMiningAttempts,
}: UseFlowNodeLifecycleActionsParams) {
  const [registerDifficultyTarget, setRegisterDifficultyTarget] = useState('')
  const [centralPubkey, setCentralPubkey] = useState('')

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
  }, [client, dispatch])

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
    dispatch,
    persistLocalFlowNodes,
    registerDifficultyTarget,
    reloadLocalNodeState,
    selectedLocalNode,
    setLastRawBytes,
    setMiningAttempts,
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
  }, [
    centralPubkey,
    client,
    dispatch,
    persistLocalFlowNodes,
    reloadLocalNodeState,
    selectedLocalNode,
    setLastRawBytes,
  ])

  return {
    registerDifficultyTarget,
    setRegisterDifficultyTarget,
    centralPubkey,
    setCentralPubkey,
    fetchRegisterDifficulty,
    registerFlowNode,
    authorizeCentralPubkey,
  }
}
