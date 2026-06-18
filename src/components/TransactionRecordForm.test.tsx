import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TransactionRecordForm } from './TransactionRecordForm'

const consumeNodes = [
  {
    id: 'alpha-consume-node',
    label: '消费节点 A',
    publicKeyHex: `03${'1'.repeat(64)}`,
  },
  {
    id: 'bravo-consume-node',
    label: '消费节点 B',
    publicKeyHex: `03${'2'.repeat(64)}`,
  },
]

describe('TransactionRecordForm', () => {
  it('renders consume node choices by local node id instead of label or pubkey', () => {
    render(
      <TransactionRecordForm
        busy={false}
        consumeNodes={consumeNodes}
        defaultCentralPubkey={`02${'c'.repeat(64)}`}
        defaultDifficulty="1d00ffff"
        error={null}
        miningAttempts={null}
        onCreate={vi.fn()}
        status={null}
      />,
    )

    expect(screen.getByRole('option', { name: 'BRAVO-' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /消费节点 B|032222/ })).toBeNull()
  })
})
