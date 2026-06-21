import { Fragment, type RefObject } from 'react'
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  FilePlus,
  GitBranch,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  ShieldCheck,
  Stamp,
  Trash2,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { CanvasPosition, ChainGraphNode, QueryMode } from '../../lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
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
  onExportNodeKey?: (node: ChainGraphNode) => void
  onRenameNode?: (node: ChainGraphNode) => void
  onDeleteNode?: (node: ChainGraphNode) => void
  onClose: () => void
  // 菜单关闭时把焦点交还给画布（键盘用户经 Shift+F10 / ContextMenu 打开后不丢失焦点）。
  returnFocusRef?: RefObject<HTMLElement | null>
}

interface MenuAction {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  variant?: 'default' | 'destructive'
}

interface MenuSection {
  key: string
  label: string
  actions: MenuAction[]
}

// 画布右键菜单：使用 shadcn DropdownMenu，按“交易 / 消费链 / 节点管理”分类。
// 通过受控 open + 不可见锚点定位到右键坐标（菜单内容经 Portal 渲染并自动避让视口边缘）。
export function GraphContextMenu({
  menu,
  onAddConsumeNode,
  onAddFlowNode,
  onRegisterFlowNode,
  onAuthorizeFlowNode,
  onGenerateRecord,
  onMountRecord,
  onLoadChain,
  onExportNodeKey,
  onRenameNode,
  onDeleteNode,
  onClose,
  returnFocusRef,
}: GraphContextMenuProps) {
  const node = menu.node

  const loadActions = (target: ChainGraphNode): MenuAction[] => [
    {
      key: 'load-end',
      label: '加载前序消费链',
      icon: ArrowLeftToLine,
      onSelect: () => onLoadChain?.(target, 'end'),
    },
    {
      key: 'load-start',
      label: '加载后续消费链',
      icon: ArrowRightToLine,
      onSelect: () => onLoadChain?.(target, 'start'),
    },
    {
      key: 'load-node',
      label: '加载完整消费链',
      icon: GitBranch,
      onSelect: () => onLoadChain?.(target, 'node'),
    },
  ]

  // 节点管理（私钥相关）：仅本地节点可用，操作直接作用于右键的节点。
  const manageActions = (target: ChainGraphNode): MenuAction[] => [
    { key: 'export', label: '导出私钥', icon: KeyRound, onSelect: () => onExportNodeKey?.(target) },
    { key: 'rename', label: '重命名', icon: Pencil, onSelect: () => onRenameNode?.(target) },
    {
      key: 'delete',
      label: '删除',
      icon: Trash2,
      onSelect: () => onDeleteNode?.(target),
      variant: 'destructive',
    },
  ]

  let sections: MenuSection[]
  if (!node) {
    sections = [
      {
        key: 'add',
        label: '添加节点',
        actions: [
          {
            key: 'add-flow',
            label: '添加流转节点',
            icon: Plus,
            onSelect: () => onAddFlowNode?.(menu.position),
          },
          {
            key: 'add-consume',
            label: '添加消费节点',
            icon: Wallet,
            onSelect: () => onAddConsumeNode?.(menu.position),
          },
        ],
      },
    ]
  } else if (node.kind === 'local-flow') {
    sections = [
      {
        key: 'tx',
        label: '交易',
        actions: [
          {
            key: 'register',
            label: '注册流转节点',
            icon: Stamp,
            onSelect: () => onRegisterFlowNode?.(node),
          },
          {
            key: 'authorize',
            label: '授权中心公钥',
            icon: ShieldCheck,
            onSelect: () => onAuthorizeFlowNode?.(node),
          },
          {
            key: 'record',
            label: '生成消费记录',
            icon: FilePlus,
            onSelect: () => onGenerateRecord?.(node),
          },
          {
            key: 'mount',
            label: '挂载消费记录',
            icon: Link2,
            onSelect: () => onMountRecord?.(node),
          },
        ],
      },
      { key: 'chain', label: '消费链', actions: loadActions(node) },
      { key: 'manage', label: '节点管理', actions: manageActions(node) },
    ]
  } else if (node.kind === 'local-consume') {
    sections = [
      {
        key: 'tx',
        label: '交易',
        actions: [
          {
            key: 'record',
            label: '生成消费记录',
            icon: FilePlus,
            onSelect: () => onGenerateRecord?.(node),
          },
          {
            key: 'mount',
            label: '挂载消费记录',
            icon: Link2,
            onSelect: () => onMountRecord?.(node),
          },
        ],
      },
      { key: 'chain', label: '消费链', actions: loadActions(node) },
      { key: 'manage', label: '节点管理', actions: manageActions(node) },
    ]
  } else {
    sections = [{ key: 'chain', label: '消费链', actions: loadActions(node) }]
  }

  return (
    <DropdownMenu
      open
      // 非模态：画布右键菜单不应锁滚动 / 置 body pointer-events:none / aria-hide 整块画布，
      // 否则打开期间无法平移缩放或右键另一个节点，且画布对辅助技术不可见。
      modal={false}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DropdownMenuTrigger
        aria-label="画布操作"
        tabIndex={-1}
        className="graph-context-menu-anchor"
        style={{
          position: 'absolute',
          left: menu.x,
          top: menu.y,
          width: 0,
          height: 0,
          padding: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <DropdownMenuContent
        aria-label="画布操作"
        align="start"
        className="graph-context-menu-content min-w-44"
        onCloseAutoFocus={(event) => {
          // 阻止 radix 把焦点送回不可见的锚点，改为交还给画布容器。
          event.preventDefault()
          returnFocusRef?.current?.focus()
        }}
      >
        {sections.map((section, index) => (
          <Fragment key={section.key}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
            <DropdownMenuGroup>
              {section.actions.map((action) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem
                    key={action.key}
                    variant={action.variant}
                    onSelect={action.onSelect}
                  >
                    <Icon aria-hidden="true" />
                    {action.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
