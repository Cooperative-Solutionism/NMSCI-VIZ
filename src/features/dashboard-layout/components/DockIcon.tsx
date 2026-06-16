import type { KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useDraggable } from '../../../shared/hooks/useDraggable'
import type { DashboardPoint } from '../dashboardLayout'

type DockIconProps = {
  label: string
  icon: LucideIcon
  position: DashboardPoint
  onOpen: () => void
  onPositionChange: (position: DashboardPoint) => void
}

function arrowKeyDelta(key: string): DashboardPoint | null {
  switch (key) {
    case 'ArrowDown':
      return { x: 0, y: 8 }
    case 'ArrowLeft':
      return { x: -8, y: 0 }
    case 'ArrowRight':
      return { x: 8, y: 0 }
    case 'ArrowUp':
      return { x: 0, y: -8 }
    default:
      return null
  }
}

export function DockIcon({
  label,
  icon: Icon,
  position,
  onOpen,
  onPositionChange,
}: DockIconProps) {
  const { elementRef, nudgeBy, onPointerDown, style } = useDraggable<HTMLButtonElement>({
    initialPosition: position,
    onDragEnd: onPositionChange,
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = arrowKeyDelta(event.key)
    if (!delta) return

    event.preventDefault()
    nudgeBy(delta)
  }

  return (
    <button
      ref={elementRef}
      type="button"
      className="dock-icon"
      style={style}
      aria-label={`打开${label}面板`}
      aria-expanded="false"
      title={label}
      data-drag-handle
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
