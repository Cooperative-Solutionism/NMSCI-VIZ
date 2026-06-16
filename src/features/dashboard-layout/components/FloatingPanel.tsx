import { ChevronLeft, GripVertical } from 'lucide-react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { useDraggable } from '../../../shared/hooks/useDraggable'
import type { DashboardPoint } from '../dashboardLayout'

type FloatingPanelProps = {
  title: string
  position: DashboardPoint
  children: ReactNode
  onCollapse: () => void
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

export function FloatingPanel({
  title,
  position,
  children,
  onCollapse,
  onPositionChange,
}: FloatingPanelProps) {
  const { elementRef, nudgeBy, onPointerDown, style } = useDraggable<HTMLDivElement>({
    initialPosition: position,
    onDragEnd: onPositionChange,
  })
  const panelRef = elementRef as unknown as Ref<HTMLElement>

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = arrowKeyDelta(event.key)
    if (!delta) return

    event.preventDefault()
    nudgeBy(delta)
  }

  return (
    <section
      ref={panelRef}
      className="floating-panel"
      style={style}
      role="dialog"
      aria-label={title}
      onPointerDown={onPointerDown}
    >
      <div
        className="floating-panel__header"
        data-drag-handle
        role="button"
        tabIndex={0}
        aria-label={`移动${title}面板`}
        onKeyDown={handleHeaderKeyDown}
      >
        <GripVertical size={18} aria-hidden="true" />
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={`折叠${title}面板`}
          onClick={onCollapse}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="floating-panel__body">{children}</div>
    </section>
  )
}
