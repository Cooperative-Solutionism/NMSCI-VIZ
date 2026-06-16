import {
  Activity,
  Download,
  Info,
  ListTree,
  PanelRight,
  Search,
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
  query: Search,
  details: PanelRight,
  loops: ListTree,
  metrics: Activity,
  export: Download,
  system: Info,
}
