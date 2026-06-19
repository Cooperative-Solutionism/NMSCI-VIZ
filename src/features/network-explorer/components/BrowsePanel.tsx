import { Tabs, TabsContent } from '../../../components/ui/tabs'
import { useUrlStateParam } from '../../../shared/hooks/useUrlQueryParam'
import { BlockBrowser } from './browse-panel/BlockBrowser'
import { BrowsePanelTabs } from './browse-panel/BrowsePanelTabs'
import { FlowNodeBrowser } from './browse-panel/FlowNodeBrowser'
import type { BrowsePanelTab } from './browse-panel/types'

type BrowsePanelProps = {
  apiBase: string
}

function isBrowsePanelTab(value: string): value is BrowsePanelTab {
  return value === 'blocks' || value === 'flow-nodes'
}

export function BrowsePanel({ apiBase }: BrowsePanelProps) {
  const [activeTab, setActiveTab] = useUrlStateParam<BrowsePanelTab>(
    'panel',
    'blocks',
    isBrowsePanelTab,
  )
  const handleTabChange = (value: string) => {
    if (isBrowsePanelTab(value)) setActiveTab(value)
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="browse-panel-content"
      aria-label="分页浏览"
    >
      <BrowsePanelTabs />
      <div className="floating-body">
        <TabsContent value="blocks">
          <BlockBrowser apiBase={apiBase} />
        </TabsContent>
        <TabsContent value="flow-nodes">
          <FlowNodeBrowser apiBase={apiBase} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
