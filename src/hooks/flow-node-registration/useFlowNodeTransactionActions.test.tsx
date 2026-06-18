import { act, renderHook } from '@testing-library/react'
import type { ApiClient } from '@nmsci/sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocalConsumeNode } from '../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../lib/flowNodeStorage'
import type { LocalTxRecord } from '../../lib/txRecordStorage'
import { useFlowNodeTransactionActions } from './useFlowNodeTransactionActions'

const buildTransactionMountMessageMock = vi.hoisted(() =>
  vi.fn(async () => ({
    bytes: new Uint8Array([1, 2, 3]),
    rawBytesHex: '010203',
    nonce: 9,
  })),
)

const sendTransactionMountMsgMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: {
      id: '22222222-2222-4222-8222-2222222222bb',
      txid: 'mount-txid',
    },
  })),
)

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    sendTransactionMountMsg: sendTransactionMountMsgMock,
  }
})

vi.mock('../../lib/messageBuilders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/messageBuilders')>()
  return {
    ...actual,
    buildTransactionMountMessage: buildTransactionMountMessageMock,
  }
})

vi.mock('./validation', () => ({
  INT64_MAX: 9223372036854775807n,
  assertKeypairIntegrity: vi.fn(),
}))

const consumeNode: LocalConsumeNode = {
  id: 'consume-1',
  label: '消费节点',
  publicKeyHex: `03${'a'.repeat(64)}`,
  privateKeyHex: 'a'.repeat(64),
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
}

const originalFlowNode: LocalFlowNode = {
  id: 'flow-1',
  label: '原记录流转节点',
  publicKeyHex: `02${'1'.repeat(64)}`,
  privateKeyHex: '1'.repeat(64),
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
  authorizations: [],
}

const targetFlowNode: LocalFlowNode = {
  id: 'flow-2',
  label: '目标挂载流转节点',
  publicKeyHex: `02${'2'.repeat(64)}`,
  privateKeyHex: '2'.repeat(64),
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
  authorizations: [],
}

const record: LocalTxRecord = {
  id: '11111111-1111-4111-8111-1111111111aa',
  uuid: '11111111-1111-4111-8111-1111111111aa',
  amount: '5000',
  currencyType: 1,
  consumeNodePubkey: consumeNode.publicKeyHex,
  flowNodePubkey: originalFlowNode.publicKeyHex,
  centralPubkey: `02${'c'.repeat(64)}`,
  rawBytesHex: '00',
  status: 'sent',
  createdAt: '2026-06-19T00:00:00.000Z',
}

describe('useFlowNodeTransactionActions', () => {
  beforeEach(() => {
    buildTransactionMountMessageMock.mockClear()
    sendTransactionMountMsgMock.mockClear()
  })

  it('builds an existing-record mount with the user-selected flow node', async () => {
    const dispatch = vi.fn()
    const { result } = renderHook(() =>
      useFlowNodeTransactionActions({
        clearSelectedLocalNode: vi.fn(),
        client: {} as ApiClient,
        dispatch,
        localConsumeNodes: [consumeNode],
        localFlowNodes: [originalFlowNode, targetFlowNode],
        localTxRecords: [record],
        persistTxRecords: vi.fn(),
        runQuery: vi.fn(),
        selectedLocalNode: originalFlowNode,
        setMiningAttempts: vi.fn(),
      }),
    )
    const createMount = result.current.createTransactionMount as unknown as (
      recordId: string,
      flowNodePubkey: string,
      difficultyHex: string,
    ) => Promise<void>

    await act(async () => {
      await createMount(record.id, targetFlowNode.publicKeyHex, '1d00ffff')
    })

    expect(buildTransactionMountMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mountedTransactionRecordId: record.id,
        difficultyHex: '1d00ffff',
        consumeNodePubkeyHex: consumeNode.publicKeyHex,
        flowNodePubkeyHex: targetFlowNode.publicKeyHex,
        centralPubkeyHex: record.centralPubkey,
        consumePrivateKeyHex: consumeNode.privateKeyHex,
        flowPrivateKeyHex: targetFlowNode.privateKeyHex,
      }),
      expect.any(Function),
    )
    expect(sendTransactionMountMsgMock).toHaveBeenCalled()
  })
})
