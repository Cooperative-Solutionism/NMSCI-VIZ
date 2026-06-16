import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  loadDashboardLayout,
  saveDashboardLayout,
  updatePanelLayout,
  type DashboardPanelLayout,
  type DashboardPanelId,
} from '../dashboardLayout'
import type { DashboardPanelConfig } from '../panelRegistry'
import { DockIcon } from './DockIcon'
import { FloatingPanel } from './FloatingPanel'

type DashboardWorkspaceProps = {
  graph: ReactNode
  panels: DashboardPanelConfig[]
}

export function DashboardWorkspace({ graph, panels }: DashboardWorkspaceProps) {
  const [layout, setLayout] = useState(() => loadDashboardLayout())
  const layoutRef = useRef(layout)
  const updateLayout = useCallback(
    (panelId: DashboardPanelId, patch: Partial<DashboardPanelLayout>) => {
      const nextLayout = updatePanelLayout(layoutRef.current, panelId, patch)

      layoutRef.current = nextLayout
      setLayout(nextLayout)
      saveDashboardLayout(nextLayout)
    },
    [],
  )

  return (
    <main className="dashboard-workspace">
      <div className="dashboard-graph">{graph}</div>
      {panels.map((panel) => {
        const panelLayout = layout[panel.id]

        return panelLayout.collapsed ? (
          <DockIcon
            key={panel.id}
            label={panel.label}
            icon={panel.icon}
            position={panelLayout.dockPosition}
            onOpen={() => updateLayout(panel.id, { collapsed: false })}
            onPositionChange={(dockPosition) => updateLayout(panel.id, { dockPosition })}
          />
        ) : (
          <FloatingPanel
            key={panel.id}
            title={panel.label}
            position={panelLayout.panelPosition}
            onCollapse={() => updateLayout(panel.id, { collapsed: true })}
            onPositionChange={(panelPosition) => updateLayout(panel.id, { panelPosition })}
          >
            {panel.content}
          </FloatingPanel>
        )
      })}
    </main>
  )
}
