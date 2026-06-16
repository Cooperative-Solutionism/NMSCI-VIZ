import { Database, Filter, KeyRound } from 'lucide-react'
import type { QueryPanelTab } from './types'

interface QueryPanelTabsProps {
  activeTab: QueryPanelTab
  onChange: (tab: QueryPanelTab) => void
}

export function QueryPanelTabs({ activeTab, onChange }: QueryPanelTabsProps) {
  return (
    <div className="floating-tabs" role="tablist" aria-label="面板分区">
      <button
        role="tab"
        aria-selected={activeTab === 'query'}
        className={activeTab === 'query' ? 'active' : ''}
        type="button"
        onClick={() => onChange('query')}
      >
        <Filter size={15} />
        查询
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'browse'}
        className={activeTab === 'browse' ? 'active' : ''}
        type="button"
        onClick={() => onChange('browse')}
      >
        <Database size={15} />
        浏览
      </button>
      <button
        role="tab"
        aria-selected={activeTab === 'keys'}
        className={activeTab === 'keys' ? 'active' : ''}
        type="button"
        onClick={() => onChange('keys')}
      >
        <KeyRound size={15} />
        密钥
      </button>
    </div>
  )
}
