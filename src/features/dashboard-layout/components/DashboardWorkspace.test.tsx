import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DASHBOARD_LAYOUT_STORAGE_KEY, defaultDashboardLayout } from '../dashboardLayout'
import { dashboardPanelIcons, type DashboardPanelConfig } from '../panelRegistry'
import { DashboardWorkspace } from './DashboardWorkspace'

const queryLabel = '\u67e5\u8be2'
const detailsLabel = '\u8be6\u60c5'
const graphText = '\u4ea4\u6613\u56fe\u8c31'
const queryContent = '\u67e5\u8be2\u6761\u4ef6'
const detailsContent = '\u8282\u70b9\u8be6\u60c5'
const openQueryName = /\u6253\u5f00\u67e5\u8be2\u9762\u677f/
const openDetailsName = /\u6253\u5f00\u8be6\u60c5\u9762\u677f/
const collapseQueryName = /\u6298\u53e0\u67e5\u8be2\u9762\u677f/
const moveQueryName = /\u79fb\u52a8\u67e5\u8be2\u9762\u677f/

function panels(): DashboardPanelConfig[] {
  return [
    {
      id: 'query',
      label: queryLabel,
      icon: dashboardPanelIcons.query,
      content: <p>{queryContent}</p>,
    },
    {
      id: 'details',
      label: detailsLabel,
      icon: dashboardPanelIcons.details,
      content: <p>{detailsContent}</p>,
    },
  ]
}

function renderWorkspace() {
  return render(<DashboardWorkspace graph={<div>{graphText}</div>} panels={panels()} />)
}

function storedLayout() {
  return JSON.parse(window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) ?? '{}')
}

function mockDimension(
  element: HTMLElement,
  property: 'clientWidth' | 'clientHeight' | 'offsetWidth' | 'offsetHeight',
  value: number,
) {
  Object.defineProperty(element, property, { configurable: true, value })
}

function mockWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

beforeEach(() => {
  window.localStorage.clear()
  mockWindowSize(1024, 768)
})

afterEach(cleanup)

describe('DashboardWorkspace', () => {
  it('renders graph, collapsed dock entries, and no floating dialogs on first visit', () => {
    renderWorkspace()

    const queryDock = screen.getByRole('button', { name: openQueryName })

    expect(screen.getByRole('main')).toHaveClass('dashboard-workspace')
    expect(screen.getByText(graphText).parentElement).toHaveClass('dashboard-graph')
    expect(queryDock).toBeInTheDocument()
    expect(queryDock).toHaveStyle({ left: '72px', top: '16px' })
    expect(screen.getByRole('button', { name: openDetailsName })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a docked query panel and persists the expanded layout', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    expect(screen.queryByRole('button', { name: openQueryName })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: queryLabel })).toBeInTheDocument()
    expect(screen.getByText(queryContent)).toBeInTheDocument()
    expect(storedLayout().query.collapsed).toBe(false)
  })

  it('moves focus to the opened panel after activating a dock entry', () => {
    renderWorkspace()

    const queryDock = screen.getByRole('button', { name: openQueryName })
    queryDock.focus()
    fireEvent.click(queryDock)

    expect(screen.getByRole('dialog', { name: queryLabel })).toHaveFocus()
  })

  it('collapses an expanded query panel and persists the collapsed layout', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    fireEvent.click(screen.getByRole('button', { name: collapseQueryName }))

    expect(screen.getByRole('button', { name: openQueryName })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: queryLabel })).not.toBeInTheDocument()
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('renders the query dialog on first render when localStorage has query expanded', () => {
    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...defaultDashboardLayout,
        query: {
          ...defaultDashboardLayout.query,
          collapsed: false,
        },
      }),
    )

    renderWorkspace()

    expect(screen.getByRole('dialog', { name: queryLabel })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: openQueryName })).not.toBeInTheDocument()
  })

  it('clamps saved panel positions to the viewport on first render', () => {
    mockWindowSize(320, 240)
    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...defaultDashboardLayout,
        details: {
          ...defaultDashboardLayout.details,
          collapsed: false,
        },
      }),
    )

    renderWorkspace()

    expect(screen.getByRole('dialog', { name: detailsLabel })).toHaveStyle({
      left: '40px',
      top: '80px',
    })
  })

  it('persists panelPosition changes from arrow nudging a dock icon', () => {
    renderWorkspace()

    fireEvent.keyDown(screen.getByRole('button', { name: openQueryName }), {
      key: 'ArrowRight',
    })

    expect(storedLayout().query.panelPosition).toEqual({ x: 80, y: 16 })
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('persists panelPosition changes from dragging a dock icon', () => {
    renderWorkspace()
    const queryDock = screen.getByRole('button', { name: openQueryName })

    fireEvent.pointerDown(queryDock, { button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(window, { clientX: 118, clientY: 225 })
    fireEvent.pointerUp(window)

    expect(storedLayout().query.panelPosition).toEqual({ x: 90, y: 41 })
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('clamps dock drags to floating panel workspace bounds before saving', () => {
    renderWorkspace()
    const workspace = screen.getByRole('main')
    const queryDock = screen.getByRole('button', { name: openQueryName })

    mockDimension(workspace, 'clientWidth', 100)
    mockDimension(workspace, 'clientHeight', 90)
    mockDimension(queryDock, 'offsetWidth', 44)
    mockDimension(queryDock, 'offsetHeight', 44)

    fireEvent.pointerDown(queryDock, { button: 0, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 1000, clientY: 1000 })
    fireEvent.pointerUp(window)

    expect(storedLayout().query.panelPosition).toEqual({ x: 0, y: 38 })
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('persists panelPosition changes from arrow nudging a floating panel handle', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    fireEvent.keyDown(screen.getByRole('button', { name: moveQueryName }), {
      key: 'ArrowDown',
    })

    expect(storedLayout().query.panelPosition).toEqual({ x: 72, y: 24 })
    expect(storedLayout().query.collapsed).toBe(false)
  })

  it('keeps a collapsed dock icon at the floating panel position after collapse', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()

    fireEvent.pointerDown(header as HTMLElement, { button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(window, { clientX: 128, clientY: 234 })
    fireEvent.pointerUp(window)
    fireEvent.click(screen.getByRole('button', { name: collapseQueryName }))

    expect(screen.getByRole('button', { name: openQueryName })).toHaveStyle({
      left: '100px',
      top: '50px',
    })
    expect(storedLayout().query.panelPosition).toEqual({ x: 100, y: 50 })
  })
})
