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
    // 空白画布不提供加载消费链。
    expect(screen.queryByRole('menuitem', { name: '加载全部消费链' })).toBeNull()
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
    // 本地流转节点同样提供加载消费链。
    expect(screen.getByRole('menuitem', { name: '加载前消费链' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '加载后消费链' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '加载全部消费链' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '添加流转节点' })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: '注册' }))
    expect(onRegisterFlowNode).toHaveBeenCalledWith(flowNode)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers only load-chain actions for a non-local chain node', () => {
    const onLoadChain = vi.fn()
    const onClose = vi.fn()
    const chainNode = node('chain')
    render(
      <GraphContextMenu menu={menu({ node: chainNode })} onLoadChain={onLoadChain} onClose={onClose} />,
    )

    expect(screen.getByRole('menuitem', { name: '加载前消费链' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '加载后消费链' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '加载全部消费链' })).toBeTruthy()
    // 非本地节点不提供任何操作选项。
    expect(screen.queryByRole('menuitem', { name: '注册' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '生成消费记录' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '添加流转节点' })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: '加载前消费链' }))
    expect(onLoadChain).toHaveBeenCalledWith(chainNode, 'end')
    fireEvent.click(screen.getByRole('menuitem', { name: '加载后消费链' }))
    expect(onLoadChain).toHaveBeenCalledWith(chainNode, 'start')
    fireEvent.click(screen.getByRole('menuitem', { name: '加载全部消费链' }))
    expect(onLoadChain).toHaveBeenCalledWith(chainNode, 'node')
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('offers local consume actions plus load-chain actions', () => {
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
    expect(screen.getByRole('menuitem', { name: '加载前消费链' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '加载后消费链' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: '加载全部消费链' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '注册' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '授权' })).toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: '生成消费记录' }))
    expect(onGenerateRecord).toHaveBeenCalledWith(consumeNode)
  })
})
