import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  const draggable = useDraggable({ initialPosition, onDragEnd })
  return (
    <div
      ref={(element) => {
        draggable.elementRef.current = element
      }}
      style={draggable.style}
      onPointerDown={draggable.onPointerDown}
      data-testid="drag-target"
      data-dragging={draggable.dragging ? 'true' : 'false'}
    >
      <button data-testid="nested-button">nested</button>
      <button type="button" onClick={() => draggable.nudgeBy({ x: 8, y: -4 })}>
        nudge
      </button>
    </div>
  )
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
})
