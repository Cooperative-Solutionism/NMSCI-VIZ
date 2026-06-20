import {
  Database,
  Info,
  KeyRound,
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
  system: Info,
  localNodes: KeyRound,
}
