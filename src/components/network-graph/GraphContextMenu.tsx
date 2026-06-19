import { useEffect, useRef, type ReactNode } from 'react'
import type { CanvasPosition, ChainGraphNode, QueryMode } from '../../lib/types'
import { Button } from '../ui/button'
import type { ContextMenuState } from './types'

interface GraphContextMenuProps {
  menu: ContextMenuState
  onAddConsumeNode?: (position: CanvasPosition) => void
  onAddFlowNode?: (position: CanvasPosition) => void
  onRegisterFlowNode?: (node: ChainGraphNode) => void
  onAuthorizeFlowNode?: (node: ChainGraphNode) => void
  onGenerateRecord?: (node: ChainGraphNode) => void
  onMountRecord?: (node: ChainGraphNode) => void
  onLoadChain?: (node: ChainGraphNode, mode: QueryMode) => void
  onClose: () => void
}

export function GraphContextMenu({
  menu,
  onAddConsumeNode,
  onAddFlowNode,
  onRegisterFlowNode,
  onAuthorizeFlowNode,
  onGenerateRecord,
  onMountRecord,
  onLoadChain,
  onClose,
}: GraphContextMenuProps) {
  const node = menu.node
  const menuRef = useRef<HTMLDivElement>(null)
  const run = (action: () => void) => () => {
    action()
    onClose()
  }

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  const menuItem = (label: string, action: () => void): ReactNode => (
    <Button role="menuitem" variant="ghost" type="button" onClick={run(action)}>
      {label}
    </Button>
  )

  const loadItems = (target: ChainGraphNode): ReactNode => (
    <>
      {menuItem('加载前序消费链', () => onLoadChain?.(target, 'end'))}
      {menuItem('加载后续消费链', () => onLoadChain?.(target, 'start'))}
      {menuItem('加载完整消费链', () => onLoadChain?.(target, 'node'))}
    </>
  )

  let items: ReactNode
  if (!node) {
    items = (
      <>
        {menuItem('添加流转节点', () => onAddFlowNode?.(menu.position))}
        {menuItem('添加消费节点', () => onAddConsumeNode?.(menu.position))}
      </>
    )
  } else if (node.kind === 'local-flow') {
    items = (
      <>
        {menuItem('注册流转节点', () => onRegisterFlowNode?.(node))}
        {menuItem('授权中心公钥', () => onAuthorizeFlowNode?.(node))}
        {menuItem('生成消费记录', () => onGenerateRecord?.(node))}
        {menuItem('挂载消费记录', () => onMountRecord?.(node))}
        {loadItems(node)}
      </>
    )
  } else if (node.kind === 'local-consume') {
    items = (
      <>
        {menuItem('生成消费记录', () => onGenerateRecord?.(node))}
        {menuItem('挂载消费记录', () => onMountRecord?.(node))}
        {loadItems(node)}
      </>
    )
  } else {
    items = loadItems(node)
  }

  return (
    <div
      ref={menuRef}
      className="graph-context-menu"
      role="menu"
      aria-label="画布操作"
      style={{ left: menu.x, top: menu.y }}
    >
      {items}
    </div>
  )
}
