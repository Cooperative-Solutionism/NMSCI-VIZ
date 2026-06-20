import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { TransactionMountDialog } from './TransactionMountDialog'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import type { LocalTxRecord } from '../../../lib/txRecordStorage'

const flowNodeA: LocalFlowNode = {
  id: 'flow-a',
  label: 'Flow A',
  publicKeyHex: '02'.padEnd(66, 'a'),
  privateKeyHex: '11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  authorizations: [],
}

const flowNodeB: LocalFlowNode = {
  id: 'flow-b',
  label: 'Flow B',
  publicKeyHex: '02'.padEnd(66, 'b'),
  privateKeyHex: '22',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  authorizations: [],
}

const flowNodes: LocalFlowNode[] = [flowNodeA, flowNodeB]

const records: LocalTxRecord[] = [
  {
    id: 'record-a',
    uuid: 'record-a',
    amount: '100',
    currencyType: 1,
    consumeNodePubkey: '02'.padEnd(66, 'c'),
    flowNodePubkey: flowNodeA.publicKeyHex,
    centralPubkey: '02'.padEnd(66, 'd'),
    rawBytesHex: 'aa',
    status: 'sent',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'record-b',
    uuid: 'record-b',
    amount: '200',
    currencyType: 1,
    consumeNodePubkey: '02'.padEnd(66, 'e'),
    flowNodePubkey: flowNodeB.publicKeyHex,
    centralPubkey: '02'.padEnd(66, 'f'),
    rawBytesHex: 'bb',
    status: 'sent',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('TransactionMountDialog', () => {
  it('submits the selected record and flow node from non-Radix choice controls under StrictMode', () => {
    const onMount = vi.fn()
    render(
      <StrictMode>
        <TransactionMountDialog
          open
          busy={false}
          canViewChain={false}
          error={null}
          flowNodes={flowNodes}
          miningAttempts={null}
          records={records}
          status={null}
          onMount={onMount}
          onOpenChange={vi.fn()}
          onViewChain={vi.fn()}
        />
      </StrictMode>,
    )

    fireEvent.click(screen.getByRole('button', { name: `选择消费记录 ${records[1]!.id}` }))
    fireEvent.click(screen.getByRole('button', { name: `选择流转节点 ${flowNodeB.publicKeyHex}` }))
    fireEvent.click(screen.getByRole('button', { name: /^提交挂载$/ }))

    expect(onMount).toHaveBeenCalledWith(records[1]!.id, flowNodeB.publicKeyHex)
  })
})
