import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DASHBOARD_LAYOUT_STORAGE_KEY, defaultDashboardLayout } from '../dashboardLayout'
import { dashboardPanelIcons, type DashboardPanelConfig } from '../panelRegistry'
import { DashboardWorkspace } from './DashboardWorkspace'

const queryLabel = '\u6d4f\u89c8'
const detailsLabel = '\u8be6\u60c5'
const graphText = '\u4ea4\u6613\u56fe\u8c31'
const queryContent = '\u67e5\u8be2\u6761\u4ef6'
const detailsContent = '\u8282\u70b9\u8be6\u60c5'
const openQueryName = /\u6253\u5f00\u6d4f\u89c8\u9762\u677f/
const openDetailsName = /\u6253\u5f00\u8be6\u60c5\u9762\u677f/
const collapseQueryName = /\u6298\u53e0\u6d4f\u89c8\u9762\u677f/
const closeQueryName = /\u5173\u95ed\u6d4f\u89c8\u9762\u677f/

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

const defaultQueryPanelPosition = defaultDashboardLayout.query.panelPosition
const defaultQueryDockPosition = defaultDashboardLayout.query.dockPosition

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
    expect(queryDock).toHaveStyle({
      left: `${defaultQueryDockPosition.x}px`,
      top: `${defaultQueryDockPosition.y}px`,
    })
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
      top: '16px',
    })
  })

  it('persists dockPosition changes from arrow nudging a dock icon', () => {
    renderWorkspace()

    fireEvent.keyDown(screen.getByRole('button', { name: openQueryName }), {
      key: 'ArrowRight',
    })

    expect(storedLayout().query.dockPosition).toEqual({
      x: defaultQueryDockPosition.x + 8,
      y: defaultQueryDockPosition.y,
    })
    expect(storedLayout().query.panelPosition).toEqual(defaultQueryPanelPosition)
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('opens a moved dock icon as a panel at the dock icon position', () => {
    renderWorkspace()
    const queryDock = screen.getByRole('button', { name: openQueryName })

    fireEvent.keyDown(queryDock, { key: 'ArrowRight' })
    fireEvent.click(queryDock)

    const movedDockPosition = {
      x: defaultQueryDockPosition.x + 8,
      y: defaultQueryDockPosition.y,
    }

    expect(screen.getByRole('dialog', { name: queryLabel })).toHaveStyle({
      left: `${movedDockPosition.x}px`,
      top: `${movedDockPosition.y}px`,
    })
    expect(storedLayout().query.panelPosition).toEqual(movedDockPosition)
    expect(storedLayout().query.dockPosition).toEqual(movedDockPosition)
    expect(storedLayout().query.collapsed).toBe(false)
  })

  it('persists dockPosition changes from dragging a dock icon', () => {
    renderWorkspace()
    const queryDock = screen.getByRole('button', { name: openQueryName })

    fireEvent.pointerDown(queryDock, { button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(window, { clientX: 118, clientY: 225 })
    fireEvent.pointerUp(window)

    expect(storedLayout().query.dockPosition).toEqual({
      x: defaultQueryDockPosition.x + 18,
      y: defaultQueryDockPosition.y + 25,
    })
    expect(storedLayout().query.panelPosition).toEqual(defaultQueryPanelPosition)
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

    expect(storedLayout().query.dockPosition).toEqual({ x: 48, y: 38 })
    expect(storedLayout().query.panelPosition).toEqual({ x: 0, y: defaultQueryPanelPosition.y })
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('persists panelPosition changes from arrow nudging a floating panel header', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()

    fireEvent.keyDown(header as HTMLElement, {
      key: 'ArrowDown',
    })

    expect(storedLayout().query.panelPosition).toEqual({
      x: defaultQueryDockPosition.x,
      y: defaultQueryDockPosition.y + 8,
    })
    expect(storedLayout().query.dockPosition).toEqual(defaultQueryDockPosition)
    expect(storedLayout().query.collapsed).toBe(false)
  })

  it('resets a closed panel to its original position', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()

    fireEvent.pointerDown(header as HTMLElement, { button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(window, { clientX: 128, clientY: 234 })
    fireEvent.pointerUp(window)
    fireEvent.click(screen.getByRole('button', { name: closeQueryName }))

    expect(screen.getByRole('button', { name: openQueryName })).toHaveStyle({
      left: `${defaultDashboardLayout.query.dockPosition.x}px`,
      top: `${defaultDashboardLayout.query.dockPosition.y}px`,
    })
    expect(storedLayout().query).toEqual(defaultDashboardLayout.query)
  })

  it('opens a reset dock icon as a panel at the reset dock position after closing', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: openQueryName }))

    const header = screen
      .getByRole('heading', { name: queryLabel })
      .closest('.floating-panel__header')

    expect(header).not.toBeNull()

    fireEvent.pointerDown(header as HTMLElement, { button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(window, { clientX: 128, clientY: 234 })
    fireEvent.pointerUp(window)
    fireEvent.click(screen.getByRole('button', { name: closeQueryName }))

    const resetDock = screen.getByRole('button', { name: openQueryName })

    expect(resetDock).toHaveStyle({
      left: `${defaultQueryDockPosition.x}px`,
      top: `${defaultQueryDockPosition.y}px`,
    })

    fireEvent.click(resetDock)

    expect(screen.getByRole('dialog', { name: queryLabel })).toHaveStyle({
      left: `${defaultQueryDockPosition.x}px`,
      top: `${defaultQueryDockPosition.y}px`,
    })
    expect(storedLayout().query.panelPosition).toEqual(defaultQueryDockPosition)
    expect(storedLayout().query.dockPosition).toEqual(defaultQueryDockPosition)
    expect(storedLayout().query.collapsed).toBe(false)
  })

  it('keeps a collapsed dock icon at the moved panel position after collapsing from the left button', () => {
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

    const movedPanelPosition = {
      x: defaultQueryDockPosition.x + 28,
      y: defaultQueryDockPosition.y + 34,
    }

    expect(screen.getByRole('button', { name: openQueryName })).toHaveStyle({
      left: `${movedPanelPosition.x}px`,
      top: `${movedPanelPosition.y}px`,
    })
    expect(storedLayout().query.panelPosition).toEqual(movedPanelPosition)
    expect(storedLayout().query.dockPosition).toEqual(movedPanelPosition)
  })
})
