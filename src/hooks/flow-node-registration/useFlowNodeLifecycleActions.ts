import {
  getLastBlock,
  sendCentralPubkeyEmpowerMsg,
  sendFlowNodeRegisterMsg,
  type ApiClient,
} from '@nmsci/sdk'
import { useCallback, type Dispatch, type SetStateAction } from 'react'
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
  setLastRawBytes: Dispatch<SetStateAction<string>>
  setMiningAttempts: Dispatch<SetStateAction<number | null>>
}

// 注册与授权都对"右键选中的流转节点"直接生效，难度目标与中心公钥统一从最新区块即时拉取，
// 不再依赖手动填写/拉取。
export function useFlowNodeLifecycleActions({
  client,
  dispatch,
  persistLocalFlowNodes,
  reloadLocalNodeState,
  setLastRawBytes,
  setMiningAttempts,
}: UseFlowNodeLifecycleActionsParams) {
  const registerFlowNode = useCallback(
    async (node: LocalFlowNode) => {
      dispatch({ type: 'START', busy: 'register' })
      setMiningAttempts(0)

      let difficultyTarget = ''
      let rawBytesHex = ''
      let nonce = 0
      try {
        const block = (await getLastBlock(client)).data
        if (!block.registerDifficultyTarget) {
          throw new Error('最新区块未包含注册难度目标')
        }
        difficultyTarget = normalizeNBitsHex(block.registerDifficultyTarget, '注册难度目标')
        const messageId = makeMessageId()
        const built = await buildRegisterMessage(
          {
            uuid: messageId,
            privateKeyHex: node.privateKeyHex,
            publicKeyHex: node.publicKeyHex,
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
          patchLocalFlowNode(currentNodes, node.id, {
            registration,
            updatedAt: registration.updatedAt,
          }),
        )
        setLastRawBytes(built.rawBytesHex)
        dispatch({
          type: 'SUCCESS',
          status: `已注册 ${shortId(registration.id)}，nonce 为 ${built.nonce}。`,
        })
        void reloadLocalNodeState(node.publicKeyHex)
      } catch (operationError) {
        const message = errorMessage(operationError, '流转节点注册失败')
        const failedAt = new Date().toISOString()
        persistLocalFlowNodes((currentNodes) =>
          patchLocalFlowNode(currentNodes, node.id, {
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
    },
    [
      client,
      dispatch,
      persistLocalFlowNodes,
      reloadLocalNodeState,
      setLastRawBytes,
      setMiningAttempts,
    ],
  )

  const authorizeCentralPubkey = useCallback(
    async (node: LocalFlowNode) => {
      dispatch({ type: 'START', busy: 'authorize' })

      try {
        const block = (await getLastBlock(client)).data
        if (!block.centralPubkey) {
          throw new Error('最新区块未包含中心公钥')
        }
        const normalizedCentralPubkey = normalizePubkeyHex(block.centralPubkey)
        const messageId = makeMessageId()
        const built = await buildEmpowerMessage({
          uuid: messageId,
          privateKeyHex: node.privateKeyHex,
          flowNodePubkeyHex: node.publicKeyHex,
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
          patchLocalFlowNode(currentNodes, node.id, {
            authorizations: [authorization, ...node.authorizations],
            updatedAt: authorization.updatedAt,
          }),
        )
        setLastRawBytes(built.rawBytesHex)
        dispatch({
          type: 'SUCCESS',
          status: `已授权中心公钥 ${shortId(normalizedCentralPubkey)}。`,
        })
        void reloadLocalNodeState(node.publicKeyHex)
      } catch (operationError) {
        dispatch({ type: 'FAILURE', error: errorMessage(operationError, '中心公钥授权失败') })
      } finally {
        dispatch({ type: 'SET_BUSY', busy: null })
      }
    },
    [client, dispatch, persistLocalFlowNodes, reloadLocalNodeState, setLastRawBytes],
  )

  return {
    registerFlowNode,
    authorizeCentralPubkey,
  }
}
