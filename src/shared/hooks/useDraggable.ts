import {
  useCallback,
  useEffect,
  useLayoutEffect,
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

function positionFromInitial(initialX: number | undefined, initialY: number | undefined) {
  return initialX === undefined || initialY === undefined ? null : { x: initialX, y: initialY }
}

export function useDraggable({
  boundsRef,
  margin = 8,
  initialPosition = null,
  onDragEnd,
}: UseDraggableOptions = {}) {
  const initialX = initialPosition?.x
  const initialY = initialPosition?.y
  const initialPoint = positionFromInitial(initialX, initialY)
  const elementRef = useRef<HTMLElement | null>(null)
  const positionRef = useRef<Point | null>(initialPoint)
  const onDragEndRef = useRef(onDragEnd)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [positionState, setPositionState] = useState(() => ({
    initialX,
    initialY,
    position: initialPoint,
  }))
  const [dragging, setDragging] = useState(false)
  const initialPositionChanged =
    positionState.initialX !== initialX || positionState.initialY !== initialY
  const position = initialPositionChanged ? initialPoint : positionState.position

  if (initialPositionChanged) {
    setPositionState({ initialX, initialY, position: initialPoint })
  }

  useEffect(() => () => cleanupRef.current?.(), [])

  useLayoutEffect(() => {
    positionRef.current = position
  }, [position])

  useLayoutEffect(() => {
    onDragEndRef.current = onDragEnd
  })

  const setCurrentPosition = useCallback((next: Point) => {
    positionRef.current = next
    setPositionState((current) => ({ ...current, position: next }))
  }, [])

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
      setCurrentPosition(clamped)
      return clamped
    },
    [clampPosition, setCurrentPosition],
  )

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement
      const handle = target.closest('[data-drag-handle]')
      const isDedicatedHandle =
        event.currentTarget.hasAttribute('data-drag-handle') ||
        (handle !== null && event.currentTarget.contains(handle))
      if (
        !isDedicatedHandle &&
        target.closest('button, a, input, textarea, select, [data-no-drag]')
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
        setCurrentPosition(last)
        setDragging(false)
        onDragEndRef.current?.(last)
      }

      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      cleanupRef.current = teardown
      setDragging(true)
      event.preventDefault()
    },
    [clampPosition, currentPosition, setCurrentPosition],
  )

  const nudgeBy = useCallback(
    (delta: Point) => {
      const el = elementRef.current
      if (!el) return
      const current = currentPosition(el)
      const next = setElementPosition(el, { x: current.x + delta.x, y: current.y + delta.y })
      onDragEndRef.current?.(next)
    },
    [currentPosition, setElementPosition],
  )

  const style: CSSProperties | undefined = position
    ? { left: position.x, top: position.y }
    : undefined

  return { elementRef, onPointerDown, dragging, nudgeBy, style }
}
