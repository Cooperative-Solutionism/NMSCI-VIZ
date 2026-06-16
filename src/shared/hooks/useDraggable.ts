import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

type Point = {
  x: number
  y: number
}

type UseDraggableOptions = {
  boundsRef?: { current: HTMLElement | null }
  margin?: number
  initialPosition?: Point | null
  onDragEnd?: (position: Point) => void
}

export function useDraggable({
  boundsRef,
  margin = 8,
  initialPosition = null,
  onDragEnd,
}: UseDraggableOptions = {}) {
  const initialX = initialPosition?.x
  const initialY = initialPosition?.y
  const elementRef = useRef<HTMLElement | null>(null)
  const positionRef = useRef<Point | null>(initialPosition)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [position, setPosition] = useState<Point | null>(initialPosition)
  const [dragging, setDragging] = useState(false)

  useEffect(() => () => cleanupRef.current?.(), [])

  useEffect(() => {
    const next =
      initialX === undefined || initialY === undefined ? null : { x: initialX, y: initialY }
    positionRef.current = next
    setPosition(next)
  }, [initialX, initialY])

  const clampPosition = useCallback(
    (element: HTMLElement, next: Point): Point => {
      const bounds = boundsRef?.current
      if (!bounds) return next
      const maxX = Math.max(margin, bounds.clientWidth - element.offsetWidth - margin)
      const maxY = Math.max(margin, bounds.clientHeight - element.offsetHeight - margin)
      return {
        x: Math.min(Math.max(margin, next.x), maxX),
        y: Math.min(Math.max(margin, next.y), maxY),
      }
    },
    [boundsRef, margin],
  )

  const currentPosition = useCallback((element: HTMLElement): Point => {
    const parentRect = (element.offsetParent as HTMLElement | null)?.getBoundingClientRect()
    const rect = element.getBoundingClientRect()
    return {
      x: positionRef.current?.x ?? rect.left - (parentRect?.left ?? 0),
      y: positionRef.current?.y ?? rect.top - (parentRect?.top ?? 0),
    }
  }, [])

  const setElementPosition = useCallback(
    (element: HTMLElement, next: Point) => {
      const clamped = clampPosition(element, next)
      element.style.left = `${clamped.x}px`
      element.style.top = `${clamped.y}px`
      positionRef.current = clamped
      setPosition(clamped)
      return clamped
    },
    [clampPosition],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const isDedicatedHandle = event.currentTarget.hasAttribute('data-drag-handle')
      if (
        !isDedicatedHandle &&
        (event.target as HTMLElement).closest('button, a, input, textarea, select, [data-no-drag]')
      )
        return
      const el = elementRef.current
      if (!el) return

      const base = currentPosition(el)
      const pointerX = event.clientX
      const pointerY = event.clientY
      let last: Point = base

      const handleMove = (move: PointerEvent) => {
        last = clampPosition(el, {
          x: base.x + (move.clientX - pointerX),
          y: base.y + (move.clientY - pointerY),
        })
        el.style.left = `${last.x}px`
        el.style.top = `${last.y}px`
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
        onDragEnd?.(last)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      cleanupRef.current = teardown
      setDragging(true)
      event.preventDefault()
    },
    [clampPosition, currentPosition, onDragEnd],
  )

  const nudgeBy = useCallback(
    (delta: Point) => {
      const el = elementRef.current
      if (!el) return
      const current = currentPosition(el)
      const next = setElementPosition(el, { x: current.x + delta.x, y: current.y + delta.y })
      onDragEnd?.(next)
    },
    [currentPosition, onDragEnd, setElementPosition],
  )

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y }
    : undefined

  return { elementRef, onPointerDown, dragging, nudgeBy, style }
}
