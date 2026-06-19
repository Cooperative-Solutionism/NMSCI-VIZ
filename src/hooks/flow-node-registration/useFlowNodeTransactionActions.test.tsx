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

const buildTransactionRecordMessageMock = vi.hoisted(() =>
  vi.fn(async () => ({
    bytes: new Uint8Array([4, 5, 6]),
    rawBytesHex: '040506',
    nonce: 7,
  })),
)

const sendTransactionRecordMsgMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: { id: 'tx-rec-1', txid: 'record-txid' },
  })),
)

// 注册难度与交易难度刻意取不同值，以验证记录/挂载读取的是 transactionDifficultyTarget 而非 register。
const getLastBlockMock = vi.hoisted(() =>
  vi.fn(async () => ({
    data: {
      height: 100,
      registerDifficultyTarget: '20ffffff',
      transactionDifficultyTarget: '1d00ffff',
      centralPubkey: `02${'c'.repeat(64)}`,
    },
  })),
)

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    sendTransactionMountMsg: sendTransactionMountMsgMock,
    sendTransactionRecordMsg: sendTransactionRecordMsgMock,
    getLastBlock: getLastBlockMock,
  }
})

vi.mock('../../lib/messageBuilders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/messageBuilders')>()
  return {
    ...actual,
    buildTransactionMountMessage: buildTransactionMountMessageMock,
    buildTransactionRecordMessage: buildTransactionRecordMessageMock,
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
    buildTransactionRecordMessageMock.mockClear()
    sendTransactionRecordMsgMock.mockClear()
    getLastBlockMock.mockClear()
  })

  it('signs a record as consume(payer)→flow(payee) using the latest transaction difficulty', async () => {
    const dispatch = vi.fn()
    const persistTxRecords = vi.fn()
    const { result } = renderHook(() =>
      useFlowNodeTransactionActions({
        clearSelectedLocalNode: vi.fn(),
        client: {} as ApiClient,
        dispatch,
        localConsumeNodes: [consumeNode],
        localFlowNodes: [originalFlowNode, targetFlowNode],
        localTxRecords: [],
        persistTxRecords,
        runQuery: vi.fn(),
        setMiningAttempts: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.createTransactionRecord({
        consumeNodePubkey: consumeNode.publicKeyHex,
        flowNodePubkey: targetFlowNode.publicKeyHex,
        amount: '5000',
        currencyType: 1,
      })
    })

    expect(buildTransactionRecordMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // 消费节点是付款方、流转节点是收款方：字段不能写反。
        consumeNodePubkeyHex: consumeNode.publicKeyHex,
        flowNodePubkeyHex: targetFlowNode.publicKeyHex,
        consumePrivateKeyHex: consumeNode.privateKeyHex,
        flowPrivateKeyHex: targetFlowNode.privateKeyHex,
        // 取交易难度（1d00ffff），而非注册难度（20ffffff）。
        difficultyHex: '1d00ffff',
        centralPubkeyHex: `02${'c'.repeat(64)}`,
        amount: 5000n,
        currencyType: 1,
      }),
      expect.any(Function),
    )
    expect(sendTransactionRecordMsgMock).toHaveBeenCalled()
    expect(persistTxRecords).toHaveBeenCalled()
  })

  it('builds an existing-record mount with the user-selected flow node and the latest difficulty', async () => {
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
        setMiningAttempts: vi.fn(),
      }),
    )

    await act(async () => {
      await result.current.createTransactionMount(record.id, targetFlowNode.publicKeyHex)
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
