export type DashboardPanelId = 'query' | 'details' | 'loops' | 'metrics' | 'export' | 'system'

export type DashboardPoint = {
  x: number
  y: number
}

export type DashboardPanelLayout = {
  collapsed: boolean
  dockPosition: DashboardPoint
  panelPosition: DashboardPoint
}

export type DashboardLayoutState = Record<DashboardPanelId, DashboardPanelLayout>

export type DashboardBounds = {
  width: number
  height: number
}

export const DASHBOARD_LAYOUT_STORAGE_KEY = 'nmsci.dashboard.layout.v1'

export const dashboardPanelIds: DashboardPanelId[] = [
  'query',
  'details',
  'loops',
  'metrics',
  'export',
  'system',
]

export const defaultDashboardLayout: DashboardLayoutState = {
  query: {
    collapsed: true,
    dockPosition: { x: 16, y: 16 },
    panelPosition: { x: 72, y: 16 },
  },
  details: {
    collapsed: true,
    dockPosition: { x: 16, y: 72 },
    panelPosition: { x: 880, y: 80 },
  },
  loops: {
    collapsed: true,
    dockPosition: { x: 16, y: 128 },
    panelPosition: { x: 880, y: 360 },
  },
  metrics: {
    collapsed: true,
    dockPosition: { x: 16, y: 184 },
    panelPosition: { x: 72, y: 96 },
  },
  export: {
    collapsed: true,
    dockPosition: { x: 16, y: 240 },
    panelPosition: { x: 72, y: 176 },
  },
  system: {
    collapsed: true,
    dockPosition: { x: 16, y: 296 },
    panelPosition: { x: 72, y: 256 },
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPoint(value: unknown): value is DashboardPoint {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y)
}

function clonePoint(point: DashboardPoint): DashboardPoint {
  return { x: point.x, y: point.y }
}

function clampCoordinate(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0))
}

const dockReservedSize = { width: 48, height: 48 }
const panelReservedSize = { width: 280, height: 48 }

function clampPoint(point: DashboardPoint, bounds: DashboardBounds, reservedSize: DashboardBounds) {
  return {
    x: clampCoordinate(point.x, bounds.width - reservedSize.width),
    y: clampCoordinate(point.y, bounds.height - reservedSize.height),
  }
}

function shouldClamp(bounds: DashboardBounds | undefined): bounds is DashboardBounds {
  return Boolean(bounds && Number.isFinite(bounds.width) && Number.isFinite(bounds.height))
}

export const normalizeDashboardLayout = (
  input: unknown,
  bounds?: DashboardBounds,
): DashboardLayoutState => {
  const source = isRecord(input) ? input : {}

  return dashboardPanelIds.reduce((layout, panelId) => {
    const defaults = defaultDashboardLayout[panelId]
    const savedPanel = source[panelId]
    const savedLayout = isRecord(savedPanel) ? savedPanel : {}
    const normalizedPanel = {
      collapsed:
        typeof savedLayout.collapsed === 'boolean' ? savedLayout.collapsed : defaults.collapsed,
      dockPosition: isPoint(savedLayout.dockPosition)
        ? clonePoint(savedLayout.dockPosition)
        : clonePoint(defaults.dockPosition),
      panelPosition: isPoint(savedLayout.panelPosition)
        ? clonePoint(savedLayout.panelPosition)
        : clonePoint(defaults.panelPosition),
    }

    layout[panelId] = shouldClamp(bounds)
      ? {
          ...normalizedPanel,
          dockPosition: clampPoint(normalizedPanel.dockPosition, bounds, dockReservedSize),
          panelPosition: clampPoint(normalizedPanel.panelPosition, bounds, panelReservedSize),
        }
      : normalizedPanel

    return layout
  }, {} as DashboardLayoutState)
}

export const loadDashboardLayout = (
  storage?: Storage,
  bounds?: DashboardBounds,
): DashboardLayoutState => {
  try {
    const targetStorage = storage ?? window.localStorage
    const rawLayout = targetStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)
    return normalizeDashboardLayout(rawLayout ? JSON.parse(rawLayout) : undefined, bounds)
  } catch {
    return normalizeDashboardLayout(undefined, bounds)
  }
}

export const saveDashboardLayout = (
  layout: DashboardLayoutState,
  storage?: Storage,
  bounds?: DashboardBounds,
): void => {
  try {
    const targetStorage = storage ?? window.localStorage
    targetStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalizeDashboardLayout(layout, bounds)),
    )
  } catch {
    return
  }
}

export const updatePanelLayout = (
  layout: DashboardLayoutState,
  panelId: DashboardPanelId,
  patch: Partial<DashboardPanelLayout>,
  bounds?: DashboardBounds,
): DashboardLayoutState =>
  normalizeDashboardLayout(
    {
      ...layout,
      [panelId]: {
        ...layout[panelId],
        ...patch,
      },
    },
    bounds,
  )
