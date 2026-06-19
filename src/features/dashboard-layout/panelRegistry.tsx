import {
  Activity,
  Database,
  Info,
  KeyRound,
  ListTree,
  PanelRight,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { DashboardPanelId } from './dashboardLayout'

export type DashboardPanelConfig = {
  id: DashboardPanelId
  label: string
  icon: LucideIcon
  content: ReactNode
}

export const dashboardPanelIcons: Record<DashboardPanelId, LucideIcon> = {
  query: Database,
  details: PanelRight,
  loops: ListTree,
  metrics: Activity,
  system: Info,
  localNodes: KeyRound,
}
