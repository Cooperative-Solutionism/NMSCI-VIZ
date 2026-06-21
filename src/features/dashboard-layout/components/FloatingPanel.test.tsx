import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Search } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DockIcon } from './DockIcon'
import { FloatingPanel } from './FloatingPanel'

const queryLabel = '\u67e5\u8be2'
const queryContent = '\u67e5\u8be2\u6761\u4ef6'
const openQueryName = /\u6253\u5f00\u67e5\u8be2\u9762\u677f/
const collapseQueryName = /\u6298\u53e0\u67e5\u8be2\u9762\u677f/
const closeQueryName = /\u5173\u95ed\u67e5\u8be2\u9762\u677f/
const moveQueryName = /\u79fb\u52a8\u67e5\u8be2\u9762\u677f/

type PanelPosition = { x: number; y: number }

type RenderFloatingPanelOptions = {
  onCollapse?: () => void
  onClose?: () => void
  onPositionChange?: (position: PanelPosition) => void
  position?: PanelPosition
}

function cssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? ''
}

function renderFloatingPanel({
  onCollapse = vi.fn(),
  onClose = vi.fn(),
  onPositionChange = vi.fn(),
  position = { x: 72, y: 16 },
}: RenderFloatingPanelOptions = {}) {
  const panelActions = { onCollapse, onClose }

  return render(
    <FloatingPanel
      title={queryLabel}
      position={position}
      onPositionChange={onPositionChange}
      {...panelActions}
    >
      <p>{queryContent}</p>
    </FloatingPanel>,
  )
}

afterEach(cleanup)

describe('DockIcon', () => {
  it('opens exactly once for a normal click without persisting an unchanged position', () => {
    const onOpen = vi.fn()
    const onPositionChange = vi.fn()

    render(
      <DockIcon
        label={queryLabel}
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={onOpen}
        onPositionChange={onPositionChange}
      />,
    )

    const button = screen.getByRole('button', { name: openQueryName })

    fireEvent.pointerDown(button, {
      button: 0,
      clientX: 24,
      clientY: 32,
    })
    fireEvent.pointerUp(window)
    fireEvent.click(button)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('moves by pointer drag without opening the panel', () => {
    const onOpen = vi.fn()
    const onPositionChange = vi.fn()

    render(
      <DockIcon
        label={queryLabel}
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={onOpen}
        onPositionChange={onPositionChange}
      />,
    )

    const button = screen.getByRole('button', { name: openQueryName })

    fireEvent.pointerDown(button, {
      button: 0,
      clientX: 100,
      clientY: 200,
    })
    fireEvent.pointerMove(window, { clientX: 118, clientY: 225 })
    fireEvent.pointerUp(window)
    fireEvent.click(button)

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith({ x: 42, y: 57 })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('still opens when a click has minor pointer jitter', () => {
    const onOpen = vi.fn()

    render(
      <DockIcon
        label={queryLabel}
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={onOpen}
        onPositionChange={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: openQueryName })

    fireEvent.pointerDown(button, {
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(window, { clientX: 102, clientY: 101 })
    fireEvent.pointerUp(window)
    fireEvent.click(button)

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders a draggable collapsed button with Chinese labels and opens on click', () => {
    const onOpen = vi.fn()

    render(
      <DockIcon
        label={queryLabel}
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={onOpen}
        onPositionChange={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: openQueryName })

    expect(button).toHaveClass('dock-icon')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('title', queryLabel)
    expect(button).toHaveStyle({ left: '24px', top: '32px' })
    expect(button).toHaveTextContent(queryLabel)
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(button.querySelector('.dock-icon__expand')).toHaveAttribute('aria-hidden', 'true')

    fireEvent.click(button)

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('nudges by 8 pixels from arrow keys and reports the updated position', () => {
    const onPositionChange = vi.fn()

    render(
      <DockIcon
        label={queryLabel}
        icon={Search}
        position={{ x: 24, y: 32 }}
        onOpen={vi.fn()}
        onPositionChange={onPositionChange}
      />,
    )

    fireEvent.keyDown(screen.getByRole('button', { name: openQueryName }), {
      key: 'ArrowRight',
    })

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith({ x: 32, y: 32 })
  })

  it('sizes the collapsed button as a compact icon rail entry', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/dashboard-layout.css'), 'utf8')
    const dockRule = cssRule(css, '.dock-icon')

    expect(dockRule).toContain('width: 44px;')
    expect(dockRule).toContain('max-width: 44px;')
    expect(dockRule).toContain('justify-content: center;')
  })
})

describe('FloatingPanel', () => {
  it('does not drag or report position when clicking collapse', () => {
    const onCollapse = vi.fn()
    const onPositionChange = vi.fn()

    renderFloatingPanel({ onCollapse, onPositionChange })

    const collapseButton = screen.getByRole('button', { name: collapseQueryName })

    fireEvent.pointerDown(collapseButton, {
      button: 0,
      clientX: 100,
      clientY: 200,
    })
    fireEvent.pointerUp(window)
    fireEvent.click(collapseButton)

    expect(onCollapse).toHaveBeenCalledTimes(1)
    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('does not drag or report position when clicking close', () => {
    const onClose = vi.fn()
    const onPositionChange = vi.fn()

    renderFloatingPanel({ onClose, onPositionChange })

    const closeButton = screen.getByRole('button', { name: closeQueryName })

    fireEvent.pointerDown(closeButton, {
      button: 0,
      clientX: 100,
      clientY: 200,
    })
    fireEvent.pointerUp(window)
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('places collapse on the left, close on the right, and removes the move button', () => {
    renderFloatingPanel()

    const collapseButton = screen.getByRole('button', { name: collapseQueryName })
    const closeButton = screen.getByRole('button', { name: closeQueryName })
    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()
    expect(header?.firstElementChild).toBe(collapseButton)
    expect(header?.lastElementChild).toBe(closeButton)
    expect(screen.queryByRole('button', { name: moveQueryName })).not.toBeInTheDocument()
  })

  it('ignores non-arrow keys on the draggable header', () => {
    const onPositionChange = vi.fn()

    renderFloatingPanel({ onPositionChange })

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()
    expect(header).toHaveAttribute('tabindex', '0')

    fireEvent.keyDown(header as HTMLElement, { key: 'Escape' })

    expect(onPositionChange).not.toHaveBeenCalled()
  })

  it('renders a dialog by Chinese title and body children', () => {
    renderFloatingPanel()

    const dialog = screen.getByRole('dialog', { name: queryLabel })

    expect(dialog).toHaveClass('floating-panel')
    expect(dialog).toHaveStyle({ left: '72px', top: '16px' })
    expect(screen.getByRole('heading', { name: queryLabel })).toBeInTheDocument()
    expect(screen.getByText(queryContent)).toBeInTheDocument()
  })

  it('calls onCollapse from the collapse button', () => {
    const onCollapse = vi.fn()

    renderFloatingPanel({ onCollapse })

    fireEvent.click(screen.getByRole('button', { name: collapseQueryName }))

    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('calls onClose from the close button', () => {
    const onClose = vi.fn()

    renderFloatingPanel({ onClose })

    fireEvent.click(screen.getByRole('button', { name: closeQueryName }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('nudges by 8 pixels from focused header arrow keys and reports the updated position', () => {
    const onPositionChange = vi.fn()

    renderFloatingPanel({ onPositionChange })

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()

    fireEvent.keyDown(header as HTMLElement, {
      key: 'ArrowDown',
    })

    expect(onPositionChange).toHaveBeenCalledTimes(1)
    expect(onPositionChange).toHaveBeenCalledWith({ x: 72, y: 24 })
  })

  it('reports the updated position after pointer dragging from the panel header', () => {
    const onPositionChange = vi.fn()

    renderFloatingPanel({ onPositionChange })

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()

    fireEvent.pointerDown(header as HTMLElement, {
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
