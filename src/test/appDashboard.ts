import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  dashboardPanelIds,
  defaultDashboardLayout,
  type DashboardLayoutState,
} from '../features/dashboard-layout/dashboardLayout'

export { DASHBOARD_LAYOUT_STORAGE_KEY }

// 派生自布局的唯一真源，避免与 dashboardPanelIds 漂移。
const allDashboardPanels = dashboardPanelIds

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
