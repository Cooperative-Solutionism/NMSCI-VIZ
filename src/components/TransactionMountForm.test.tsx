import { createElement, type ComponentType } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LocalFlowNode } from '../lib/flowNodeStorage'
import type { LocalTxRecord } from '../lib/txRecordStorage'
import { TransactionMountForm } from './TransactionMountForm'

const records: LocalTxRecord[] = [
  {
    id: '11111111-1111-4111-8111-1111111111aa',
    uuid: '11111111-1111-4111-8111-1111111111aa',
    amount: '5000',
    currencyType: 1,
    consumeNodePubkey: `03${'a'.repeat(64)}`,
    flowNodePubkey: `02${'1'.repeat(64)}`,
    centralPubkey: `02${'c'.repeat(64)}`,
    rawBytesHex: '00',
    status: 'sent',
    createdAt: '2026-06-19T00:00:00.000Z',
  },
]

const flowNodes: LocalFlowNode[] = [
  {
    id: 'alpha-flow-node',
    label: '流转节点 A',
    publicKeyHex: `02${'1'.repeat(64)}`,
    privateKeyHex: '1'.repeat(64),
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    authorizations: [],
  },
  {
    id: 'bravo-flow-node',
    label: '流转节点 B',
    publicKeyHex: `02${'2'.repeat(64)}`,
    privateKeyHex: '2'.repeat(64),
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    authorizations: [],
  },
]

describe('TransactionMountForm', () => {
  it('lets users choose which flow node receives an existing consume record mount', async () => {
    const onMount = vi.fn()
    const TestMountForm = TransactionMountForm as ComponentType<Record<string, unknown>>

    render(
      createElement(TestMountForm, {
        busy: false,
        canViewChain: false,
        defaultDifficulty: '1d00ffff',
        defaultFlowNodePubkey: flowNodes[0]?.publicKeyHex,
        error: null,
        flowNodes,
        miningAttempts: null,
        onMount,
        onViewChain: vi.fn(),
        records,
        status: null,
      }),
    )

    fireEvent.pointerDown(screen.getByRole('combobox', { name: '挂载流转节点' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    })

    const targetFlowNode = await screen.findByRole('option', { name: '未注册2' })

    expect(targetFlowNode).toBeTruthy()
    expect(screen.queryByRole('option', { name: /BRAVO-|流转节点 B|022222/ })).toBeNull()

    fireEvent.click(targetFlowNode)
    fireEvent.click(screen.getByRole('button', { name: '提交挂载' }))

    expect(onMount).toHaveBeenCalledWith(records[0]?.id, flowNodes[1]?.publicKeyHex, '1d00ffff')
  })
})
