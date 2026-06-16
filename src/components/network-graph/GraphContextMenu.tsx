import type { CanvasPosition } from '../../lib/types'
import type { ContextMenuState } from './types'

interface GraphContextMenuProps {
  menu: ContextMenuState
  onAddConsumeNode?: (position: CanvasPosition) => void
  onAddFlowNode?: (position: CanvasPosition) => void
  onClose: () => void
}

export function GraphContextMenu({
  menu,
  onAddConsumeNode,
  onAddFlowNode,
  onClose,
}: GraphContextMenuProps) {
  return (
    <div className="graph-context-menu" aria-label="添加节点" style={{ left: menu.x, top: menu.y }}>
      <button
        type="button"
        onClick={() => {
          onAddFlowNode?.(menu.position)
          onClose()
        }}
      >
        添加流转节点
      </button>
      <button
        type="button"
        onClick={() => {
          onAddConsumeNode?.(menu.position)
          onClose()
        }}
      >
        添加消费节点
      </button>
    </div>
  )
}
