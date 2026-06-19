import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  defaultDashboardLayout,
  type DashboardLayoutState,
  type DashboardPanelId,
} from '../features/dashboard-layout/dashboardLayout'

export { DASHBOARD_LAYOUT_STORAGE_KEY }

const allDashboardPanels: DashboardPanelId[] = [
  'query',
  'details',
  'loops',
  'metrics',
  'export',
  'system',
  'localNodes',
]

export function seedDashboardLayout(expandedPanels = allDashboardPanels) {
  localStorage.setItem(
    DASHBOARD_LAYOUT_STORAGE_KEY,
    JSON.stringify(dashboardLayoutWithExpanded(expandedPanels)),
  )
}

function dashboardLayoutWithExpanded(expandedPanels = allDashboardPanels): DashboardLayoutState {
  return Object.fromEntries(
    allDashboardPanels.map((panelId) => {
      const panel = defaultDashboardLayout[panelId]

      return [
        panelId,
        {
          ...panel,
          collapsed: !expandedPanels.includes(panelId),
          dockPosition: { ...panel.dockPosition },
          panelPosition: { ...panel.panelPosition },
        },
      ]
    }),
  ) as DashboardLayoutState
}
