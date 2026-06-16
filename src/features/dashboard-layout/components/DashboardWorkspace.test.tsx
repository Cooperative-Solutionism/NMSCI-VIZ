import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { DASHBOARD_LAYOUT_STORAGE_KEY, defaultDashboardLayout } from '../dashboardLayout'
import { dashboardPanelIcons, type DashboardPanelConfig } from '../panelRegistry'
import { DashboardWorkspace } from './DashboardWorkspace'

function panels(): DashboardPanelConfig[] {
  return [
    {
      id: 'query',
      label: '查询',
      icon: dashboardPanelIcons.query,
      content: <p>查询条件</p>,
    },
    {
      id: 'details',
      label: '详情',
      icon: dashboardPanelIcons.details,
      content: <p>节点详情</p>,
    },
  ]
}

function renderWorkspace() {
  return render(<DashboardWorkspace graph={<div>交易图谱</div>} panels={panels()} />)
}

function storedLayout() {
  return JSON.parse(window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) ?? '{}')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(cleanup)

describe('DashboardWorkspace', () => {
  it('renders graph, collapsed dock entries, and no floating dialogs on first visit', () => {
    renderWorkspace()

    expect(screen.getByRole('main')).toHaveClass('dashboard-workspace')
    expect(screen.getByText('交易图谱').parentElement).toHaveClass('dashboard-graph')
    expect(screen.getByRole('button', { name: '打开查询面板' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开详情面板' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a docked query panel and persists the expanded layout', () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('button', { name: '打开查询面板' }))

    expect(screen.queryByRole('button', { name: '打开查询面板' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '查询' })).toBeInTheDocument()
    expect(screen.getByText('查询条件')).toBeInTheDocument()
    expect(storedLayout().query.collapsed).toBe(false)
  })

  it('collapses an expanded query panel and persists the collapsed layout', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: '打开查询面板' }))

    fireEvent.click(screen.getByRole('button', { name: '折叠查询面板' }))

    expect(screen.getByRole('button', { name: '打开查询面板' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '查询' })).not.toBeInTheDocument()
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

    expect(screen.getByRole('dialog', { name: '查询' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '打开查询面板' })).not.toBeInTheDocument()
  })

  it('persists dockPosition changes from arrow nudging a dock icon', () => {
    renderWorkspace()

    fireEvent.keyDown(screen.getByRole('button', { name: '打开查询面板' }), {
      key: 'ArrowRight',
    })

    expect(storedLayout().query.dockPosition).toEqual({ x: 24, y: 16 })
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('persists dockPosition changes from dragging a dock icon', () => {
    renderWorkspace()
    const queryDock = screen.getByRole('button', { name: '打开查询面板' })

    fireEvent.pointerDown(queryDock, { button: 0, clientX: 100, clientY: 200 })
    fireEvent.pointerMove(window, { clientX: 118, clientY: 225 })
    fireEvent.pointerUp(window)

    expect(storedLayout().query.dockPosition).toEqual({ x: 34, y: 41 })
    expect(storedLayout().query.collapsed).toBe(true)
  })

  it('persists panelPosition changes from arrow nudging a floating panel handle', () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole('button', { name: '打开查询面板' }))

    fireEvent.keyDown(screen.getByRole('button', { name: '移动查询面板' }), {
      key: 'ArrowDown',
    })

    expect(storedLayout().query.panelPosition).toEqual({ x: 72, y: 24 })
    expect(storedLayout().query.collapsed).toBe(false)
  })
})
