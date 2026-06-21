import { Activity, Blocks, Network } from 'lucide-react'
import { TabsList, TabsTrigger } from '../../../../components/ui/tabs'

export function BrowsePanelTabs() {
  return (
    <TabsList className="floating-tabs" aria-label="浏览分页">
      <TabsTrigger value="blocks">
        <Blocks data-icon="inline-start" />
        区块
      </TabsTrigger>
      <TabsTrigger value="flow-nodes">
        <Network data-icon="inline-start" />
        流转节点
      </TabsTrigger>
      <TabsTrigger value="flow-index">
        <Activity data-icon="inline-start" />
        指数查询
      </TabsTrigger>
    </TabsList>
  )
}
