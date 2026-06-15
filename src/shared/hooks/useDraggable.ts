import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface Point {
  x: number
  y: number
}

interface UseDraggableOptions {
  boundsRef?: { current: HTMLElement | null }
  margin?: number
}

export function useDraggable({ boundsRef, margin = 8 }: UseDraggableOptions = {}) {
  const elementRef = useRef<HTMLElement | null>(null)
  const positionRef = useRef<Point | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [position, setPosition] = useState<Point | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => () => cleanupRef.current?.(), [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      if (
        (event.target as HTMLElement).closest('button, a, input, textarea, select, [data-no-drag]')
      )
        return
      const el = elementRef.current
      if (!el) return

      const parentRect = (el.offsetParent as HTMLElement | null)?.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      const baseX = positionRef.current?.x ?? rect.left - (parentRect?.left ?? 0)
      const baseY = positionRef.current?.y ?? rect.top - (parentRect?.top ?? 0)
      const pointerX = event.clientX
      const pointerY = event.clientY
      let last: Point = { x: baseX, y: baseY }

      const handleMove = (move: PointerEvent) => {
        let x = baseX + (move.clientX - pointerX)
        let y = baseY + (move.clientY - pointerY)
        const bounds = boundsRef?.current
        if (bounds) {
          const maxX = Math.max(margin, bounds.clientWidth - el.offsetWidth - margin)
          const maxY = Math.max(margin, bounds.clientHeight - el.offsetHeight - margin)
          x = Math.min(Math.max(margin, x), maxX)
          y = Math.min(Math.max(margin, y), maxY)
        }
        last = { x, y }
        el.style.left = `${x}px`
        el.style.top = `${y}px`
      }
      const teardown = () => {
        window.removeEventListener('pointermove', handleMove)
        window.removeEventListener('pointerup', handleUp)
        cleanupRef.current = null
      }
      const handleUp = () => {
        teardown()
        positionRef.current = last
        setPosition(last)
        setDragging(false)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      cleanupRef.current = teardown
      setDragging(true)
      event.preventDefault()
    },
    [boundsRef, margin],
  )

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y }
    : undefined

  return { elementRef, onPointerDown, dragging, style }
}
