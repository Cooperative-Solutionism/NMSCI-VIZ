import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LocalFlowNode } from '../../lib/flowNodeStorage'
import { FlowNodeKeyDetails } from './FlowNodeKeyDetails'

const unregisteredNode: LocalFlowNode = {
  id: 'local-generated-flow-node-id',
  label: 'LOCAL-GENERATED',
  publicKeyHex: `02${'1'.repeat(64)}`,
  privateKeyHex: '1'.repeat(64),
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
  authorizations: [],
}

describe('FlowNodeKeyDetails', () => {
  it('shows an unregistered sequence name instead of a generated local id', () => {
    render(<FlowNodeKeyDetails displayName="未注册1" node={unregisteredNode} onCopy={vi.fn()} />)

    expect(screen.getByText('节点名称')).toBeTruthy()
    expect(screen.getByText('未注册1')).toBeTruthy()
    expect(screen.queryByText('local-generated-flow-node-id')).toBeNull()
  })
})
