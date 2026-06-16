import { NodeBrowser } from '../../../components'
import { Tabs, TabsContent } from '../../../components/ui/tabs'
import { useUrlStateParam } from '../../../shared/hooks/useUrlQueryParam'
import { QueryFormContent } from './query-panel/QueryFormContent'
import { QueryPanelTabs } from './query-panel/QueryPanelTabs'
import type { QueryFormContentProps, QueryPanelTab } from './query-panel/types'

type QueryPanelProps = QueryFormContentProps & {
  onPickNode: (pubkey: string) => void
}

function isQueryPanelTab(value: string): value is QueryPanelTab {
  return value === 'query' || value === 'browse'
}

export function QueryPanel({ onPickNode, ...props }: QueryPanelProps) {
  const [leftTab, setLeftTab] = useUrlStateParam<QueryPanelTab>('panel', 'query', isQueryPanelTab)
  const handleTabChange = (value: string) => {
    if (isQueryPanelTab(value)) setLeftTab(value)
  }

  return (
    <Tabs
      value={leftTab}
      onValueChange={handleTabChange}
      className="query-panel-content"
      aria-label="消费链查询"
    >
      <QueryPanelTabs onChange={setLeftTab} />

      <div className="floating-body">
        <TabsContent value="query" className="m-0 min-h-0">
          <QueryFormContent {...props} />
        </TabsContent>
        <TabsContent value="browse" className="m-0 min-h-0">
          <NodeBrowser
            apiBase={props.apiBase}
            onPick={(pubkey) => {
              onPickNode(pubkey)
              setLeftTab('query')
            }}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}
