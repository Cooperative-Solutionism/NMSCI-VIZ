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
  /** 拖拽范围限制在该容器内（通常是定位父级）。 */
  boundsRef?: { current: HTMLElement | null }
  /** 面板与容器边缘保留的间距。 */
  margin?: number
}

/**
 * 让一个绝对定位的元素可用鼠标/触摸拖动。
 *
 * 监听器在 pointerdown 时同步挂载（而非通过 effect），避免按下到挂载之间丢失首批 move 事件；
 * 拖拽期间直接改写 element.style.left/top，避免每帧触发整棵 React 树重渲染；松手时再把最终
 * 坐标提交到 state，保证 React 模型与 DOM 一致。
 */
export function useDraggable({ boundsRef, margin = 8 }: UseDraggableOptions = {}) {
  const elementRef = useRef<HTMLElement | null>(null)
  const positionRef = useRef<Point | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [position, setPosition] = useState<Point | null>(null)
  const [dragging, setDragging] = useState(false)

  // 卸载时兜底清理可能残留的拖拽监听器。
  useEffect(() => () => cleanupRef.current?.(), [])

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      // 交互控件（按钮/输入等）上的按下不触发拖拽。
      if ((event.target as HTMLElement).closest('button, a, input, textarea, select, [data-no-drag]')) return
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

  const style: CSSProperties | undefined = position ? { left: position.x, top: position.y } : undefined

  return { elementRef, onPointerDown, dragging, style }
}
