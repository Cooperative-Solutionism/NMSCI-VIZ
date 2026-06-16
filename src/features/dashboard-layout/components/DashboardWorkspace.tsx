import { useCallback, useRef, useState, type ReactNode } from 'react'
import {
  loadDashboardLayout,
  saveDashboardLayout,
  updatePanelLayout,
  type DashboardBounds,
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

function viewportBounds(): DashboardBounds | undefined {
  if (typeof window === 'undefined') return undefined

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function workspaceBounds(element: HTMLElement | null): DashboardBounds | undefined {
  if (element && element.clientWidth > 0 && element.clientHeight > 0) {
    return {
      width: element.clientWidth,
      height: element.clientHeight,
    }
  }

  return viewportBounds()
}

export function DashboardWorkspace({ graph, panels }: DashboardWorkspaceProps) {
  const workspaceRef = useRef<HTMLElement | null>(null)
  const [layout, setLayout] = useState(() => loadDashboardLayout(undefined, viewportBounds()))
  const [focusPanelId, setFocusPanelId] = useState<DashboardPanelId | null>(null)
  const layoutRef = useRef(layout)
  const updateLayout = useCallback(
    (panelId: DashboardPanelId, patch: Partial<DashboardPanelLayout>) => {
      const bounds = workspaceBounds(workspaceRef.current)
      const nextLayout = updatePanelLayout(layoutRef.current, panelId, patch, bounds)

      layoutRef.current = nextLayout
      setLayout(nextLayout)
      saveDashboardLayout(nextLayout, undefined, bounds)
    },
    [],
  )
  const openPanel = useCallback(
    (panelId: DashboardPanelId) => {
      setFocusPanelId(panelId)
      updateLayout(panelId, { collapsed: false })
    },
    [updateLayout],
  )
  const clearFocusedPanel = useCallback((panelId: DashboardPanelId) => {
    setFocusPanelId((current) => (current === panelId ? null : current))
  }, [])

  return (
    <main ref={workspaceRef} className="dashboard-workspace">
      <div className="dashboard-graph">{graph}</div>
      {panels.map((panel) => {
        const panelLayout = layout[panel.id]

        return panelLayout.collapsed ? (
          <DockIcon
            key={panel.id}
            label={panel.label}
            icon={panel.icon}
            position={panelLayout.panelPosition}
            boundsRef={workspaceRef}
            onOpen={() => openPanel(panel.id)}
            onPositionChange={(panelPosition) => updateLayout(panel.id, { panelPosition })}
          />
        ) : (
          <FloatingPanel
            key={panel.id}
            title={panel.label}
            position={panelLayout.panelPosition}
            boundsRef={workspaceRef}
            focusOnMount={focusPanelId === panel.id}
            onCollapse={() => updateLayout(panel.id, { collapsed: true })}
            onFocusMount={() => clearFocusedPanel(panel.id)}
            onPositionChange={(panelPosition) => updateLayout(panel.id, { panelPosition })}
          >
            {panel.content}
          </FloatingPanel>
        )
      })}
    </main>
  )
}
