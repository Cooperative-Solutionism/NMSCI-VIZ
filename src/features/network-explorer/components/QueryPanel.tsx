import { NodeBrowser } from '../../../components'
import { useUrlStateParam } from '../../../shared/hooks/useUrlQueryParam'
import { KeyringPanelContent } from './query-panel/KeyringPanelContent'
import { QueryFormContent } from './query-panel/QueryFormContent'
import { QueryPanelTabs } from './query-panel/QueryPanelTabs'
import type {
  KeyringPanelContentProps,
  QueryFormContentProps,
  QueryPanelTab,
} from './query-panel/types'

type QueryPanelProps = QueryFormContentProps &
  KeyringPanelContentProps & {
    onPickNode: (pubkey: string) => void
  }

function isQueryPanelTab(value: string): value is QueryPanelTab {
  return value === 'query' || value === 'browse' || value === 'keys'
}

export function QueryPanel({ onPickNode, ...props }: QueryPanelProps) {
  const [leftTab, setLeftTab] = useUrlStateParam<QueryPanelTab>('panel', 'query', isQueryPanelTab)

  return (
    <div className="query-panel-content" aria-label="消费链查询">
      <QueryPanelTabs activeTab={leftTab} onChange={setLeftTab} />

      <div className="floating-body">
        {leftTab === 'query' ? <QueryFormContent {...props} /> : null}
        {leftTab === 'browse' ? (
          <NodeBrowser
            apiBase={props.apiBase}
            onPick={(pubkey) => {
              onPickNode(pubkey)
              setLeftTab('query')
            }}
          />
        ) : null}
        {leftTab === 'keys' ? <KeyringPanelContent {...props} /> : null}
      </div>
    </div>
  )
}
