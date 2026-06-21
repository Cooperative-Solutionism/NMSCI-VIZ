import { ChevronLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useDraggable } from '../../../shared/hooks/useDraggable'
import type { DashboardPoint } from '../dashboardLayout'

type FloatingPanelProps = {
  title: string
  position: DashboardPoint
  children: ReactNode
  boundsRef?: { current: HTMLElement | null }
  focusOnMount?: boolean
  onCollapse: () => void
  onClose: () => void
  onFocusMount?: () => void
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
  boundsRef,
  focusOnMount = false,
  onCollapse,
  onClose,
  onFocusMount,
  onPositionChange,
}: FloatingPanelProps) {
  const titleId = useId()
  const lastPositionRef = useRef(position)
  const handlePositionChange = (next: DashboardPoint) => {
    const current = lastPositionRef.current
    if (current.x === next.x && current.y === next.y) return

    lastPositionRef.current = next
    onPositionChange(next)
  }
  const { elementRef, nudgeBy, onPointerDown, style } = useDraggable<HTMLElement>({
    boundsRef,
    initialPosition: position,
    onDragEnd: handlePositionChange,
  })

  useEffect(() => {
    if (!focusOnMount) return

    elementRef.current?.focus({ preventScroll: true })
    onFocusMount?.()
  }, [elementRef, focusOnMount, onFocusMount])

  useEffect(() => {
    lastPositionRef.current = position
  }, [position])

  const handleHeaderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return

    const delta = arrowKeyDelta(event.key)
    if (!delta) return

    event.preventDefault()
    nudgeBy(delta)
  }

  return (
    <section
      ref={elementRef}
      className="floating-panel"
      style={style}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div
        className="floating-panel__header"
        role="toolbar"
        aria-label={`移动${title}面板`}
        tabIndex={0}
        onKeyDown={handleHeaderKeyDown}
        onPointerDown={onPointerDown}
      >
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="floating-panel__collapse"
          aria-label={`折叠${title}面板`}
          onClick={onCollapse}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 id={titleId}>{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="floating-panel__close"
          aria-label={`关闭${title}面板`}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="floating-panel__body">{children}</div>
    </section>
  )
}
