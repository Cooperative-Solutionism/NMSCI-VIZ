export type DashboardPanelId =
  | 'query'
  | 'details'
  | 'loops'
  | 'metrics'
  | 'system'
  | 'localNodes'

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
  'system',
  'localNodes',
]

const defaultReferenceBounds = { width: 1024, height: 768 } satisfies DashboardBounds
const defaultPanelTop = 16
const defaultPanelHorizontalStep = 96
const dockReservedSize = { width: 48, height: 48 }
const panelReservedSize = { width: 280, height: 48 }

function defaultBoundsWidth(bounds: DashboardBounds | undefined): number {
  return bounds && Number.isFinite(bounds.width) ? bounds.width : defaultReferenceBounds.width
}

function defaultPanelPosition(index: number, bounds?: DashboardBounds): DashboardPoint {
  const width = defaultBoundsWidth(bounds)
  const maxSpan = Math.max(width - panelReservedSize.width, 0)
  const horizontalStep =
    dashboardPanelIds.length > 1
      ? Math.min(defaultPanelHorizontalStep, maxSpan / (dashboardPanelIds.length - 1))
      : 0
  const rowWidth = panelReservedSize.width + horizontalStep * (dashboardPanelIds.length - 1)
  const startX = Math.max(0, Math.round((width - rowWidth) / 2))

  return {
    x: Math.round(startX + horizontalStep * index),
    y: defaultPanelTop,
  }
}

export const createDefaultDashboardLayout = (bounds?: DashboardBounds): DashboardLayoutState =>
  dashboardPanelIds.reduce((layout, panelId, index) => {
    const position = defaultPanelPosition(index, bounds)

    layout[panelId] = {
      collapsed: true,
      dockPosition: { ...position },
      panelPosition: { ...position },
    }

    return layout
  }, {} as DashboardLayoutState)

export const defaultDashboardLayout: DashboardLayoutState = createDefaultDashboardLayout()

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
  const defaultsByPanel = createDefaultDashboardLayout(bounds)

  return dashboardPanelIds.reduce((layout, panelId) => {
    const defaults = defaultsByPanel[panelId]
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
