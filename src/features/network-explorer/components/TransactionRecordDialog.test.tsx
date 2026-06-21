import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TransactionRecordDialog } from './TransactionRecordDialog'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'

const consumeNode: LocalConsumeNode = {
  id: 'consume-a',
  label: 'Consume A',
  publicKeyHex: '02'.padEnd(66, 'a'),
  privateKeyHex: '11',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const flowNode: LocalFlowNode = {
  id: 'flow-a',
  label: 'Flow A',
  publicKeyHex: '02'.padEnd(66, 'b'),
  privateKeyHex: '22',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  authorizations: [],
}

afterEach(cleanup)

describe('TransactionRecordDialog', () => {
  it('offers mounting the created record to a canvas node', () => {
    const onMountToNode = vi.fn()

    render(
      <TransactionRecordDialog
        open
        busy={false}
        consumeNodes={[consumeNode]}
        createdRecordId="record-1"
        error={null}
        flowNodes={[flowNode]}
        miningAttempts={null}
        status="created"
        onCreate={vi.fn()}
        onMountToNode={onMountToNode}
        onOpenChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '挂载至节点' }))

    expect(onMountToNode).toHaveBeenCalledWith('record-1')
  })
})
