import { Database, Filter } from 'lucide-react'
import { TabsList, TabsTrigger } from '../../../../components/ui/tabs'
import type { QueryPanelTab } from './types'

interface QueryPanelTabsProps {
  onChange: (tab: QueryPanelTab) => void
}

export function QueryPanelTabs({ onChange }: QueryPanelTabsProps) {
  return (
    <TabsList className="floating-tabs" aria-label="面板分区">
      <TabsTrigger value="query" onClick={() => onChange('query')}>
        <Filter data-icon="inline-start" />
        查询
      </TabsTrigger>
      <TabsTrigger value="browse" onClick={() => onChange('browse')}>
        <Database data-icon="inline-start" />
        浏览
      </TabsTrigger>
    </TabsList>
  )
}
