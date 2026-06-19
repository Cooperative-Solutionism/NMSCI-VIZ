import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChainGraphNode } from '../../lib/types'
import { GraphContextMenu } from './GraphContextMenu'
import type { ContextMenuState } from './types'

function node(kind: ChainGraphNode['kind']): ChainGraphNode {
  return { id: `pk-${kind}`, label: kind, chainCount: 0, volumeByCurrency: new Map(), kind }
}

function menu(overrides: Partial<ContextMenuState> = {}): ContextMenuState {
  return { x: 10, y: 20, position: { x: 1, y: 2 }, ...overrides }
}

afterEach(cleanup)

describe('GraphContextMenu', () => {
  it('exposes a menu role and focuses the first item on open', () => {
    render(<GraphContextMenu menu={menu()} onClose={vi.fn()} />)

    const list = screen.getByRole('menu', { name: '画布操作' })
    const items = within(list).getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
  })

  it('offers add-node actions on the empty canvas', () => {
    render(<GraphContextMenu menu={menu()} onClose={vi.fn()} />)

    expect(screen.getByRole('menuitem', { name: '添加流转节点' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '添加消费节点' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '注册' })).toBeNull()
  })

  it('offers register/authorize/record/mount for a local flow node', () => {
    const onRegisterFlowNode = vi.fn()
    const onClose = vi.fn()
    const flowNode = node('local-flow')
    render(
      <GraphContextMenu
        menu={menu({ node: flowNode })}
        onRegisterFlowNode={onRegisterFlowNode}
        onClose={onClose}
      />,
    )

    expect(screen.getByRole('menuitem', { name: '注册' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '授权' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '生成消费记录' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '挂载消费记录' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '添加流转节点' })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: '注册' }))
    expect(onRegisterFlowNode).toHaveBeenCalledWith(flowNode)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers only record/mount for a local consume node', () => {
    const onGenerateRecord = vi.fn()
    const consumeNode = node('local-consume')
    render(
      <GraphContextMenu
        menu={menu({ node: consumeNode })}
        onGenerateRecord={onGenerateRecord}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('menuitem', { name: '生成消费记录' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '挂载消费记录' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '注册' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '授权' })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: '生成消费记录' }))
    expect(onGenerateRecord).toHaveBeenCalledWith(consumeNode)
  })
})
