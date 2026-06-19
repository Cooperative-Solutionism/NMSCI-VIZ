import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LocalConsumeNode } from '../../../lib/consumeNodeStorage'
import type { LocalFlowNode } from '../../../lib/flowNodeStorage'
import { LocalNodePanel, type LocalNodePanelProps } from './LocalNodePanel'

function flowNode(overrides: Partial<LocalFlowNode> = {}): LocalFlowNode {
  return {
    id: 'flow-id-aaaaaa',
    label: '流转标签',
    publicKeyHex: '03aaaaaa1111',
    privateKeyHex: 'priv-flow',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    authorizations: [],
    ...overrides,
  }
}

function consumeNode(overrides: Partial<LocalConsumeNode> = {}): LocalConsumeNode {
  return {
    id: 'consume-id-bbbbbb',
    label: '消费标签',
    publicKeyHex: '03bbbbbb2222',
    privateKeyHex: 'priv-consume',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderPanel(overrides: Partial<LocalNodePanelProps> = {}) {
  const props: LocalNodePanelProps = {
    localFlowNodes: [],
    localConsumeNodes: [],
    onAddConsumeNode: vi.fn(),
    onAddFlowNode: vi.fn(),
    onImportLocalNode: vi.fn(),
    onLockVault: vi.fn(),
    onOpenVault: vi.fn(),
    vaultStatus: 'unlocked',
    ...overrides,
  }

  return { props, ...render(<LocalNodePanel {...props} />) }
}

afterEach(cleanup)

describe('LocalNodePanel', () => {
  it('always exposes the create-node actions', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: '新建流转节点' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '新建消费节点' })).toBeTruthy()
  })

  it('shows a locked hint and no table when the vault is not unlocked', () => {
    renderPanel({ vaultStatus: 'locked' })

    expect(screen.queryByRole('table', { name: '本地节点列表' })).toBeNull()
    expect(screen.getByText('解锁密钥保险库后可查看本地节点。')).toBeTruthy()
  })

  it('shows an empty hint when unlocked with no nodes', () => {
    renderPanel({ vaultStatus: 'unlocked' })

    expect(screen.queryByRole('table', { name: '本地节点列表' })).toBeNull()
    expect(screen.getByText('尚无本地节点，点击上方按钮创建。')).toBeTruthy()
  })

  it('renders one row per local node with name, type, public key, and status', () => {
    renderPanel({
      localFlowNodes: [flowNode()],
      localConsumeNodes: [consumeNode()],
    })

    const table = screen.getByRole('table', { name: '本地节点列表' })
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + two node rows

    const flowRow = within(screen.getByText('未注册1').closest('tr') as HTMLElement)
    expect(flowRow.getByText('流转')).toBeTruthy()
    expect(flowRow.getByText('03AAAA')).toBeTruthy() // shortId(publicKeyHex)
    expect(flowRow.getByText('未注册')).toBeTruthy()

    const consumeRow = within(screen.getByText('CONSUM').closest('tr') as HTMLElement)
    expect(consumeRow.getByText('消费')).toBeTruthy()
    expect(consumeRow.getByText('03BBBB')).toBeTruthy()
    expect(consumeRow.getByText('消费节点')).toBeTruthy()
  })

  it('maps each flow-node registration state to a status badge', () => {
    renderPanel({
      localFlowNodes: [
        flowNode({
          id: 'failed',
          publicKeyHex: '03f00001',
          registration: {
            id: 'reg-failed',
            rawBytesHex: '00',
            registerDifficultyTarget: '20ffffff',
            nonce: 1,
            status: 'failed',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        }),
        flowNode({
          id: 'registered',
          publicKeyHex: '03f00002',
          registration: {
            id: 'reg-sent',
            rawBytesHex: '00',
            registerDifficultyTarget: '20ffffff',
            nonce: 1,
            status: 'sent',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        }),
        flowNode({
          id: 'authorized',
          publicKeyHex: '03f00003',
          registration: {
            id: 'reg-auth',
            rawBytesHex: '00',
            registerDifficultyTarget: '20ffffff',
            nonce: 1,
            status: 'sent',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          authorizations: [
            {
              id: 'auth-1',
              centralPubkeyHex: '02cc',
              rawBytesHex: '00',
              status: 'sent',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
        }),
      ],
    })

    expect(screen.getByText('注册失败')).toBeTruthy()
    expect(screen.getByText('已注册')).toBeTruthy()
    expect(screen.getByText('已授权')).toBeTruthy()
  })

  it('selects a node by its public key when its row button is activated', () => {
    const onSelectLocalNode = vi.fn()
    renderPanel({
      localFlowNodes: [flowNode()],
      onSelectLocalNode,
    })

    fireEvent.click(screen.getByRole('button', { name: '选择本地节点 未注册1' }))

    expect(onSelectLocalNode).toHaveBeenCalledTimes(1)
    expect(onSelectLocalNode).toHaveBeenCalledWith('03aaaaaa1111')
  })

  it('marks the selected row as current', () => {
    renderPanel({
      localFlowNodes: [flowNode()],
      localConsumeNodes: [consumeNode()],
      onSelectLocalNode: vi.fn(),
      selectedLocalId: '03bbbbbb2222',
    })

    const selectedButton = screen.getByRole('button', { name: '选择本地节点 CONSUM' })
    expect(selectedButton).toHaveAttribute('aria-current', 'true')
    expect(selectedButton.closest('tr')).toHaveAttribute('data-state', 'selected')

    const otherButton = screen.getByRole('button', { name: '选择本地节点 未注册1' })
    expect(otherButton).not.toHaveAttribute('aria-current')
    expect(otherButton.closest('tr')).not.toHaveAttribute('data-state')
  })

  it('renders plain node names when no selection handler is provided', () => {
    renderPanel({ localFlowNodes: [flowNode()] })

    expect(screen.queryByRole('button', { name: '选择本地节点 未注册1' })).toBeNull()
    expect(screen.getByText('未注册1')).toBeTruthy()
  })
})
