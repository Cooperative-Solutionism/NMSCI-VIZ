import { useEffect, useRef, type ReactNode } from 'react'
import type { CanvasPosition, ChainGraphNode } from '../../lib/types'
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
  onClose,
}: GraphContextMenuProps) {
  const node = menu.node
  const menuRef = useRef<HTMLDivElement>(null)
  const run = (action: () => void) => () => {
    action()
    onClose()
  }

  // 菜单打开后把焦点移入第一个菜单项，便于键盘操作。
  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  let items: ReactNode
  if (node?.kind === 'local-flow') {
    items = (
      <>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onRegisterFlowNode?.(node))}
        >
          注册
        </Button>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onAuthorizeFlowNode?.(node))}
        >
          授权
        </Button>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onGenerateRecord?.(node))}
        >
          生成消费记录
        </Button>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onMountRecord?.(node))}
        >
          挂载消费记录
        </Button>
      </>
    )
  } else if (node?.kind === 'local-consume') {
    items = (
      <>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onGenerateRecord?.(node))}
        >
          生成消费记录
        </Button>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onMountRecord?.(node))}
        >
          挂载消费记录
        </Button>
      </>
    )
  } else {
    items = (
      <>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onAddFlowNode?.(menu.position))}
        >
          添加流转节点
        </Button>
        <Button
          role="menuitem"
          variant="ghost"
          type="button"
          onClick={run(() => onAddConsumeNode?.(menu.position))}
        >
          添加消费节点
        </Button>
      </>
    )
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
