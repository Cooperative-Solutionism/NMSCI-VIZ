import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Search } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DockIcon } from './DockIcon'
import { FloatingPanel } from './FloatingPanel'

afterEach(cleanup)

describe('DockIcon', () => {
  it('renders a draggable collapsed button with Chinese labels and opens on click', () => {
    const onOpen = vi.fn()

    render(
      <DockIcon
        label="查询"
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={onOpen}
        onPositionChange={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: '打开查询面板' })

    expect(button).toHaveClass('dock-icon')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('title', '查询')
    expect(button).toHaveStyle({ left: '24px', top: '32px' })
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

    fireEvent.click(button)

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('nudges by 8 pixels from arrow keys and reports the updated position', () => {
    const onPositionChange = vi.fn()

    render(
      <DockIcon
        label="查询"
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={vi.fn()}
        onPositionChange={onPositionChange}
      />,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: '打开查询面板' }), {
      key: 'ArrowRight',
    })

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith({ x: 32, y: 32 })
  })
})

describe('FloatingPanel', () => {
  it('renders a dialog by Chinese title and body children', () => {
    render(
      <FloatingPanel
        title="查询"
        position={{ x: 72, y: 16 }}
        onCollapse={vi.fn()}
        onPositionChange={vi.fn()}
      >
        <p>查询条件</p>
      </FloatingPanel>,
    )

    const dialog = screen.getByRole('dialog', { name: '查询' })

    expect(dialog).toHaveClass('floating-panel')
    expect(dialog).toHaveStyle({ left: '72px', top: '16px' })
    expect(screen.getByRole('heading', { name: '查询' })).toBeInTheDocument()
    expect(screen.getByText('查询条件')).toBeInTheDocument()
  })

  it('calls onCollapse from the collapse button', () => {
    const onCollapse = vi.fn()

    render(
      <FloatingPanel
        title="查询"
        position={{ x: 72, y: 16 }}
        onCollapse={onCollapse}
        onPositionChange={vi.fn()}
      >
        <p>查询条件</p>
      </FloatingPanel>,
    )

    fireEvent.click(screen.getByRole('button', { name: '折叠查询面板' }))

    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('nudges by 8 pixels from header arrow keys and reports the updated position', () => {
    const onPositionChange = vi.fn()

    render(
      <FloatingPanel
        title="查询"
        position={{ x: 72, y: 16 }}
        onCollapse={vi.fn()}
        onPositionChange={onPositionChange}
      >
        <p>查询条件</p>
      </FloatingPanel>,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: '移动查询面板' }), {
      key: 'ArrowDown',
    })

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith({ x: 72, y: 24 })
  })

  it('reports the updated position after pointer dragging from the panel header', () => {
    const onPositionChange = vi.fn()

    render(
      <FloatingPanel
        title="查询"
        position={{ x: 72, y: 16 }}
        onCollapse={vi.fn()}
        onPositionChange={onPositionChange}
      >
        <p>查询条件</p>
      </FloatingPanel>,
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: '移动查询面板' }), {
      button: 0,
      clientX: 100,
      clientY: 200,
    })
    fireEvent.pointerMove(window, { clientX: 118, clientY: 225 })

    expect(onPositionChange).not.toHaveBeenCalled()

    fireEvent.pointerUp(window)

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith({ x: 90, y: 41 })
  })
})
