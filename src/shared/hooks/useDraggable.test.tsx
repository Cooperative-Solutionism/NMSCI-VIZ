import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDraggable } from './useDraggable'

type Point = { x: number; y: number }

function DragProbe({
  initialPosition,
  onDragEnd,
}: {
  initialPosition?: Point | null
  onDragEnd?: (position: Point) => void
}) {
  const { dragging, elementRef, nudgeBy, onPointerDown, style } = useDraggable({
    initialPosition,
    onDragEnd,
  })
  return (
    <div
      ref={elementRef}
      style={style}
      onPointerDown={onPointerDown}
      data-testid="drag-target"
      data-dragging={dragging ? 'true' : 'false'}
    >
      <button data-testid="nested-button">nested</button>
      <button data-testid="nested-handle" type="button" data-drag-handle>
        handle
      </button>
      <button type="button" onClick={() => nudgeBy({ x: 8, y: -4 })}>
        nudge
      </button>
    </div>
  )
}

function BoundedDragProbe({
  initialPosition,
  onDragEnd,
}: {
  initialPosition?: Point | null
  onDragEnd?: (position: Point) => void
}) {
  const boundsRef = useRef<HTMLDivElement>(null)
  const { elementRef, nudgeBy, onPointerDown, style } = useDraggable({
    boundsRef,
    initialPosition,
    onDragEnd,
  })
  return (
    <div ref={boundsRef} data-testid="drag-bounds">
      <div
        ref={elementRef}
        style={style}
        onPointerDown={onPointerDown}
        data-testid="drag-target"
      >
        <button type="button" onClick={() => nudgeBy({ x: 100, y: 100 })}>
          nudge beyond bounds
        </button>
      </div>
    </div>
  )
}

function mockDimension(
  element: HTMLElement,
  property: 'clientWidth' | 'clientHeight' | 'offsetWidth' | 'offsetHeight',
  value: number,
) {
  Object.defineProperty(element, property, { configurable: true, value })
}

function mockBoundedLayout() {
  const bounds = screen.getByTestId('drag-bounds')
  const target = screen.getByTestId('drag-target')
  mockDimension(bounds, 'clientWidth', 120)
  mockDimension(bounds, 'clientHeight', 90)
  mockDimension(target, 'offsetWidth', 30)
  mockDimension(target, 'offsetHeight', 20)
  return { target }
}

afterEach(cleanup)

describe('useDraggable', () => {
  it('uses the initial position for left and top style', () => {
    render(<DragProbe initialPosition={{ x: 24, y: 36 }} />)

    expect(screen.getByTestId('drag-target')).toHaveStyle({ left: '24px', top: '36px' })
  })

  it('updates left and top style when initial position changes', () => {
    const { rerender } = render(<DragProbe initialPosition={{ x: 12, y: 18 }} />)

    expect(screen.getByTestId('drag-target')).toHaveStyle({ left: '12px', top: '18px' })

    rerender(<DragProbe initialPosition={{ x: 42, y: 54 }} />)

    expect(screen.getByTestId('drag-target')).toHaveStyle({ left: '42px', top: '54px' })
  })

  it('nudges by object delta and reports the final position', () => {
    const onDragEnd = vi.fn()
    render(<DragProbe initialPosition={{ x: 12, y: 16 }} onDragEnd={onDragEnd} />)

    fireEvent.click(screen.getByRole('button', { name: 'nudge' }))

    expect(screen.getByTestId('drag-target')).toHaveStyle({ left: '20px', top: '12px' })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 20, y: 12 })
  })

  it('reports pointer drag end once on pointer up', () => {
    const onDragEnd = vi.fn()
    render(<DragProbe initialPosition={{ x: 5, y: 10 }} onDragEnd={onDragEnd} />)

    fireEvent.pointerDown(screen.getByTestId('drag-target'), {
      button: 0,
      clientX: 100,
      clientY: 200,
    })
    fireEvent.pointerMove(window, { clientX: 112, clientY: 225 })

    expect(onDragEnd).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)

    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 17, y: 35 })
  })

  it('uses the latest onDragEnd callback when pointer drag finishes after rerender', () => {
    const firstOnDragEnd = vi.fn()
    const latestOnDragEnd = vi.fn()
    const { rerender } = render(
      <DragProbe initialPosition={{ x: 5, y: 10 }} onDragEnd={firstOnDragEnd} />,
    )

    fireEvent.pointerDown(screen.getByTestId('drag-target'), {
      button: 0,
      clientX: 100,
      clientY: 200,
    })

    rerender(<DragProbe initialPosition={{ x: 5, y: 10 }} onDragEnd={latestOnDragEnd} />)

    fireEvent.pointerMove(window, { clientX: 112, clientY: 225 })
    fireEvent.pointerUp(window)

    expect(firstOnDragEnd).not.toHaveBeenCalled()
    expect(latestOnDragEnd).toHaveBeenCalledTimes(1)
    expect(latestOnDragEnd).toHaveBeenCalledWith({ x: 17, y: 35 })
  })

  it('clamps nudgeBy updates to boundsRef', () => {
    const onDragEnd = vi.fn()
    render(<BoundedDragProbe initialPosition={{ x: 50, y: 50 }} onDragEnd={onDragEnd} />)
    const { target } = mockBoundedLayout()

    fireEvent.click(screen.getByRole('button', { name: 'nudge beyond bounds' }))

    expect(target).toHaveStyle({ left: '82px', top: '62px' })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 82, y: 62 })
  })

  it('clamps pointer dragging to boundsRef before reporting the final position', () => {
    const onDragEnd = vi.fn()
    render(<BoundedDragProbe initialPosition={{ x: 20, y: 20 }} onDragEnd={onDragEnd} />)
    const { target } = mockBoundedLayout()

    fireEvent.pointerDown(target, {
      button: 0,
      clientX: 0,
      clientY: 0,
    })
    fireEvent.pointerMove(window, { clientX: 200, clientY: 200 })

    expect(target).toHaveStyle({ left: '82px', top: '62px' })
    expect(onDragEnd).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)

    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 82, y: 62 })
  })

  it('does not begin dragging from a nested button', () => {
    const onDragEnd = vi.fn()
    render(<DragProbe initialPosition={{ x: 7, y: 9 }} onDragEnd={onDragEnd} />)

    fireEvent.pointerDown(screen.getByTestId('nested-button'), {
      button: 0,
      clientX: 20,
      clientY: 30,
    })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 50 })
    fireEvent.pointerUp(window)

    expect(screen.getByTestId('drag-target')).toHaveAttribute('data-dragging', 'false')
    expect(screen.getByTestId('drag-target')).toHaveStyle({ left: '7px', top: '9px' })
    expect(onDragEnd).not.toHaveBeenCalled()
  })

  it('begins dragging from a nested data-drag-handle button', () => {
    const onDragEnd = vi.fn()
    render(<DragProbe initialPosition={{ x: 7, y: 9 }} onDragEnd={onDragEnd} />)

    fireEvent.pointerDown(screen.getByTestId('nested-handle'), {
      button: 0,
      clientX: 20,
      clientY: 30,
    })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 50 })

    expect(onDragEnd).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)

    expect(screen.getByTestId('drag-target')).toHaveAttribute('data-dragging', 'false')
    expect(screen.getByTestId('drag-target')).toHaveStyle({ left: '27px', top: '29px' })
    expect(onDragEnd).toHaveBeenCalledTimes(1)
    expect(onDragEnd).toHaveBeenCalledWith({ x: 27, y: 29 })
  })
})
