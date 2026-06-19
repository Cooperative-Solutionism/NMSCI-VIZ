import { describe, expect, it, vi } from 'vitest'
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  dashboardPanelIds,
  defaultDashboardLayout,
  loadDashboardLayout,
  normalizeDashboardLayout,
  saveDashboardLayout,
  updatePanelLayout,
  type DashboardLayoutState,
} from './dashboardLayout'

const defaultTopRowPanelPositions = [
  { x: 132, y: 16 },
  { x: 228, y: 16 },
  { x: 324, y: 16 },
  { x: 420, y: 16 },
  { x: 516, y: 16 },
  { x: 612, y: 16 },
]
const defaultLeftRailDockPositions = [
  { x: 16, y: 84 },
  { x: 16, y: 138 },
  { x: 16, y: 192 },
  { x: 16, y: 246 },
  { x: 16, y: 300 },
  { x: 16, y: 354 },
]

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))

  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('dashboard layout state', () => {
  it('defaults first-visit layout to all panels collapsed', () => {
    const layout = normalizeDashboardLayout(undefined)

    expect(dashboardPanelIds.every((panelId) => layout[panelId].collapsed)).toBe(true)
  })

  it('lists dashboard panel ids in the expected order', () => {
    expect(dashboardPanelIds).toEqual([
      'query',
      'details',
      'loops',
      'metrics',
      'system',
      'localNodes',
    ])
  })

  it('places default panel origins in a top-centered row and dock entries in a left rail', () => {
    const layout = normalizeDashboardLayout(undefined)

    expect(dashboardPanelIds.map((panelId) => layout[panelId].panelPosition)).toEqual(
      defaultTopRowPanelPositions,
    )
    expect(dashboardPanelIds.map((panelId) => layout[panelId].dockPosition)).toEqual(
      defaultLeftRailDockPositions,
    )
  })

  it('exports the default layout with expected query defaults', () => {
    expect(defaultDashboardLayout.query).toEqual({
      collapsed: true,
      dockPosition: { x: 16, y: 84 },
      panelPosition: { x: 132, y: 16 },
    })
  })

  it('centers default panel origins against the provided workspace width', () => {
    const layout = normalizeDashboardLayout(undefined, { width: 1440, height: 900 })

    expect(dashboardPanelIds.map((panelId) => layout[panelId].panelPosition)).toEqual([
      { x: 340, y: 16 },
      { x: 436, y: 16 },
      { x: 532, y: 16 },
      { x: 628, y: 16 },
      { x: 724, y: 16 },
      { x: 820, y: 16 },
    ])
  })

  it('repairs malformed or missing saved layout data from defaults', () => {
    const layout = normalizeDashboardLayout({
      query: {
        collapsed: 'false',
        dockPosition: { x: 24, y: Number.NaN },
        panelPosition: { x: 120, y: 140 },
      },
      extra: {
        collapsed: false,
        dockPosition: { x: 1, y: 1 },
        panelPosition: { x: 2, y: 2 },
      },
    })

    expect(Object.keys(layout)).toEqual(dashboardPanelIds)
    expect(layout.query).toEqual({
      collapsed: true,
      dockPosition: { x: 16, y: 84 },
      panelPosition: { x: 120, y: 140 },
    })
    expect(layout.details).toEqual({
      collapsed: true,
      dockPosition: { x: 16, y: 138 },
      panelPosition: { x: 228, y: 16 },
    })
  })

  it('keeps a valid saved query layout during normalization', () => {
    const layout = normalizeDashboardLayout({
      query: {
        collapsed: false,
        dockPosition: { x: 44, y: 52 },
        panelPosition: { x: 320, y: 240 },
      },
    })

    expect(layout.query).toEqual({
      collapsed: false,
      dockPosition: { x: 44, y: 52 },
      panelPosition: { x: 320, y: 240 },
    })
  })

  it('clamps coordinates into visible workspace bounds', () => {
    const layout = normalizeDashboardLayout(
      {
        query: {
          collapsed: false,
          dockPosition: { x: 999, y: 999 },
          panelPosition: { x: -20, y: 80 },
        },
      },
      { width: 100, height: 70 },
    )

    expect(layout.query.dockPosition).toEqual({ x: 52, y: 22 })
    expect(layout.query.panelPosition).toEqual({ x: 0, y: 22 })
  })

  it('keeps top-row panel defaults visible on narrow viewports', () => {
    const layout = normalizeDashboardLayout(undefined, { width: 320, height: 240 })

    expect(layout.query.panelPosition).toEqual({ x: 0, y: 16 })
    expect(layout.details.panelPosition).toEqual({ x: 8, y: 16 })
    expect(layout.localNodes.panelPosition).toEqual({ x: 40, y: 16 })
  })

  it('falls back to defaults for empty, invalid, or unreadable storage', () => {
    const defaults = normalizeDashboardLayout(undefined)
    const throwingStorage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('storage unavailable')
      },
    } as Storage

    expect(loadDashboardLayout(fakeStorage())).toEqual(defaults)
    expect(loadDashboardLayout(fakeStorage({ [DASHBOARD_LAYOUT_STORAGE_KEY]: '' }))).toEqual(
      defaults,
    )
    expect(loadDashboardLayout(fakeStorage({ [DASHBOARD_LAYOUT_STORAGE_KEY]: '{broken' }))).toEqual(
      defaults,
    )
    expect(loadDashboardLayout(throwingStorage)).toEqual(defaults)
  })

  it('returns the default layout when default storage resolution throws', () => {
    const localStorageGetter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('localStorage unavailable')
    })

    try {
      expect(loadDashboardLayout()).toEqual(defaultDashboardLayout)
    } finally {
      localStorageGetter.mockRestore()
    }
  })

  it('returns the default layout when provided storage access fails', () => {
    const throwingStorage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('storage unavailable')
      },
    } as Storage

    expect(loadDashboardLayout(throwingStorage)).toEqual(defaultDashboardLayout)
  })

  it('writes normalized JSON to the dashboard layout storage key', () => {
    const storage = fakeStorage()
    const dirtyLayout = {
      ...normalizeDashboardLayout(undefined),
      query: {
        collapsed: false,
        dockPosition: { x: 64, y: 80 },
        panelPosition: { x: Number.POSITIVE_INFINITY, y: 12 },
      },
      unknown: {
        collapsed: false,
        dockPosition: { x: 1, y: 1 },
        panelPosition: { x: 2, y: 2 },
      },
    } as unknown as DashboardLayoutState

    saveDashboardLayout(dirtyLayout, storage)

    const raw = storage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)
    expect(raw).toBe(JSON.stringify(normalizeDashboardLayout(dirtyLayout)))
    expect(JSON.parse(raw ?? '{}')).toEqual(normalizeDashboardLayout(dirtyLayout))
  })

  it('does not throw when dashboard layout storage write fails', () => {
    const throwingStorage = {
      ...fakeStorage(),
      setItem: () => {
        throw new Error('storage quota exceeded')
      },
    } as Storage

    expect(() =>
      saveDashboardLayout(normalizeDashboardLayout(undefined), throwingStorage),
    ).not.toThrow()
  })

  it('patches a panel layout without mutating the previous state', () => {
    const layout = normalizeDashboardLayout(undefined)

    const next = updatePanelLayout(layout, 'query', {
      collapsed: false,
      panelPosition: { x: 144, y: 188 },
    })

    expect(next).not.toBe(layout)
    expect(next.query).toEqual({
      collapsed: false,
      dockPosition: { x: 16, y: 84 },
      panelPosition: { x: 144, y: 188 },
    })
    expect(next.details).toEqual(layout.details)
    expect(layout.query.collapsed).toBe(true)
  })
})
