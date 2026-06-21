import { useRef, useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  it('exposes a labeled menu and moves focus into it on open', async () => {
    render(<GraphContextMenu menu={menu()} onClose={vi.fn()} />)

    const list = screen.getByRole('menu', { name: '画布操作' })
    // DropdownMenu 打开后将焦点移入菜单（容器接管方向键漫游），保证键盘可达。
    await waitFor(() => {
      expect(list === document.activeElement || list.contains(document.activeElement)).toBe(true)
    })
  })

  it('offers categorized add-node actions on the empty canvas and passes the click position', () => {
    const onAddFlowNode = vi.fn()
    const onAddConsumeNode = vi.fn()
    render(
      <GraphContextMenu
        menu={menu()}
        onAddFlowNode={onAddFlowNode}
        onAddConsumeNode={onAddConsumeNode}
        onClose={vi.fn()}
      />,
    )

    const list = screen.getByRole('menu', { name: '画布操作' })
    expect(within(list).getByText('添加节点')).toBeTruthy()
    expect(within(list).queryByRole('menuitem', { name: '注册流转节点' })).toBeNull()
    expect(within(list).queryByText('节点管理')).toBeNull()

    // 添加节点必须带上右键落点（画布放置坐标），这是该分组唯一的实质逻辑。
    fireEvent.click(within(list).getByRole('menuitem', { name: '添加流转节点' }))
    expect(onAddFlowNode).toHaveBeenCalledWith(menu().position)
    fireEvent.click(within(list).getByRole('menuitem', { name: '添加消费节点' }))
    expect(onAddConsumeNode).toHaveBeenCalledWith(menu().position)
  })

  it('groups a local flow node into 交易 / 消费链 / 节点管理 categories', () => {
    const onRegisterFlowNode = vi.fn()
    const onAuthorizeFlowNode = vi.fn()
    const onMountRecord = vi.fn()
    const onExportNodeKey = vi.fn()
    const onClose = vi.fn()
    const flowNode = node('local-flow')
    render(
      <GraphContextMenu
        menu={menu({ node: flowNode })}
        onRegisterFlowNode={onRegisterFlowNode}
        onAuthorizeFlowNode={onAuthorizeFlowNode}
        onMountRecord={onMountRecord}
        onExportNodeKey={onExportNodeKey}
        onClose={onClose}
      />,
    )

    const list = screen.getByRole('menu', { name: '画布操作' })
    expect(within(list).getByText('交易')).toBeTruthy()
    expect(within(list).getByText('消费链')).toBeTruthy()
    expect(within(list).getByText('节点管理')).toBeTruthy()

    // 交易类
    expect(within(list).getByRole('menuitem', { name: '注册流转节点' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '授权中心公钥' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '生成消费记录' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '挂载消费记录' })).toBeTruthy()
    // 消费链类
    expect(within(list).getByRole('menuitem', { name: '加载前序消费链' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '加载后续消费链' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '加载完整消费链' })).toBeTruthy()
    // 节点管理类
    expect(within(list).getByRole('menuitem', { name: '导出私钥' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '重命名' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '删除' })).toBeTruthy()

    fireEvent.click(within(list).getByRole('menuitem', { name: '注册流转节点' }))
    expect(onRegisterFlowNode).toHaveBeenCalledWith(flowNode)
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(within(list).getByRole('menuitem', { name: '授权中心公钥' }))
    expect(onAuthorizeFlowNode).toHaveBeenCalledWith(flowNode)
    fireEvent.click(within(list).getByRole('menuitem', { name: '挂载消费记录' }))
    expect(onMountRecord).toHaveBeenCalledWith(flowNode)
    fireEvent.click(within(list).getByRole('menuitem', { name: '导出私钥' }))
    expect(onExportNodeKey).toHaveBeenCalledWith(flowNode)
  })

  it('offers only load-chain actions for a non-local chain node', () => {
    const onLoadChain = vi.fn()
    const onClose = vi.fn()
    const chainNode = node('chain')
    render(
      <GraphContextMenu menu={menu({ node: chainNode })} onLoadChain={onLoadChain} onClose={onClose} />,
    )

    const list = screen.getByRole('menu', { name: '画布操作' })
    expect(within(list).getByText('消费链')).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '加载前序消费链' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '加载后续消费链' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '加载完整消费链' })).toBeTruthy()
    expect(within(list).queryByRole('menuitem', { name: '注册流转节点' })).toBeNull()
    expect(within(list).queryByText('节点管理')).toBeNull()
    expect(within(list).queryByRole('menuitem', { name: '添加流转节点' })).toBeNull()

    fireEvent.click(within(list).getByRole('menuitem', { name: '加载前序消费链' }))
    expect(onLoadChain).toHaveBeenCalledWith(chainNode, 'end')
    fireEvent.click(within(list).getByRole('menuitem', { name: '加载后续消费链' }))
    expect(onLoadChain).toHaveBeenCalledWith(chainNode, 'start')
    fireEvent.click(within(list).getByRole('menuitem', { name: '加载完整消费链' }))
    expect(onLoadChain).toHaveBeenCalledWith(chainNode, 'node')
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('dismisses via Escape (no action fired) and returns focus to the canvas ref', async () => {
    const onClose = vi.fn()
    const onRegisterFlowNode = vi.fn()

    function Harness() {
      const canvasRef = useRef<HTMLButtonElement>(null)
      const [open, setOpen] = useState(true)
      return (
        <>
          <button type="button" ref={canvasRef}>
            画布
          </button>
          {open ? (
            <GraphContextMenu
              menu={menu({ node: node('local-flow') })}
              onRegisterFlowNode={onRegisterFlowNode}
              returnFocusRef={canvasRef}
              onClose={() => {
                onClose()
                setOpen(false)
              }}
            />
          ) : null}
        </>
      )
    }

    render(<Harness />)
    const list = await screen.findByRole('menu', { name: '画布操作' })

    // Esc / 点击外部是移除旧 window 监听后唯一的“非选中”关闭路径，必须被验证。
    fireEvent.keyDown(list, { key: 'Escape', code: 'Escape' })

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onRegisterFlowNode).not.toHaveBeenCalled()
    // 关闭后焦点交还画布，而不是掉到 document.body。
    await waitFor(() => expect(screen.getByRole('button', { name: '画布' })).toHaveFocus())
  })

  it('offers local consume actions plus management and load-chain actions', () => {
    const onGenerateRecord = vi.fn()
    const onDeleteNode = vi.fn()
    const consumeNode = node('local-consume')
    render(
      <GraphContextMenu
        menu={menu({ node: consumeNode })}
        onGenerateRecord={onGenerateRecord}
        onDeleteNode={onDeleteNode}
        onClose={vi.fn()}
      />,
    )

    const list = screen.getByRole('menu', { name: '画布操作' })
    expect(within(list).getByRole('menuitem', { name: '生成消费记录' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '挂载消费记录' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '导出私钥' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '删除' })).toBeTruthy()
    expect(within(list).getByRole('menuitem', { name: '加载完整消费链' })).toBeTruthy()
    expect(within(list).queryByRole('menuitem', { name: '注册流转节点' })).toBeNull()
    expect(within(list).queryByRole('menuitem', { name: '授权中心公钥' })).toBeNull()

    fireEvent.click(within(list).getByRole('menuitem', { name: '生成消费记录' }))
    expect(onGenerateRecord).toHaveBeenCalledWith(consumeNode)
    fireEvent.click(within(list).getByRole('menuitem', { name: '删除' }))
    expect(onDeleteNode).toHaveBeenCalledWith(consumeNode)
  })
})
