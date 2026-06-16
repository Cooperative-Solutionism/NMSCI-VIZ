import { useEffect, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
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

function samePosition(left: DashboardPoint, right: DashboardPoint) {
  return left.x === right.x && left.y === right.y
}

export function DockIcon({
  label,
  icon: Icon,
  position,
  onOpen,
  onPositionChange,
}: DockIconProps) {
  const lastPositionRef = useRef(position)
  const pointerCleanupRef = useRef<(() => void) | null>(null)
  const suppressNextClickRef = useRef(false)
  const handlePositionChange = (next: DashboardPoint) => {
    if (samePosition(lastPositionRef.current, next)) return

    lastPositionRef.current = next
    onPositionChange(next)
  }
  const { elementRef, nudgeBy, onPointerDown, style } = useDraggable<HTMLButtonElement>({
    initialPosition: position,
    onDragEnd: handlePositionChange,
  })

  useEffect(() => {
    lastPositionRef.current = position
  }, [position])

  useEffect(() => () => pointerCleanupRef.current?.(), [])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = arrowKeyDelta(event.key)
    if (!delta) return

    event.preventDefault()
    nudgeBy(delta)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return

    pointerCleanupRef.current?.()
    const start = { x: event.clientX, y: event.clientY }
    let moved = false

    const handleMove = (move: PointerEvent) => {
      if (moved) return
      if (move.clientX === start.x && move.clientY === start.y) return

      moved = true
      suppressNextClickRef.current = true
    }
    const teardown = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', teardown)
      pointerCleanupRef.current = null

      if (moved) {
        window.setTimeout(() => {
          suppressNextClickRef.current = false
        }, 0)
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', teardown)
    pointerCleanupRef.current = teardown
    onPointerDown(event)
  }

  const handleClick = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false
      return
    }

    onOpen()
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
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
