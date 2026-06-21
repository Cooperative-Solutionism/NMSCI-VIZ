import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(cleanup)

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

  it('closes from the view-chain action without a recursive Radix focus update', () => {
    const onViewChain = vi.fn()

    function Harness() {
      const [open, setOpen] = useState(true)

      return (
        <TransactionMountDialog
          open={open}
          busy={false}
          canViewChain
          error={null}
          flowNodes={flowNodes}
          miningAttempts={null}
          records={records}
          status="交易已挂载"
          onMount={vi.fn()}
          onOpenChange={setOpen}
          onViewChain={() => {
            setOpen(false)
            onViewChain()
          }}
        />
      )
    }

    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )

    fireEvent.click(screen.getByRole('button', { name: /查看消费链/ }))

    expect(onViewChain).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
