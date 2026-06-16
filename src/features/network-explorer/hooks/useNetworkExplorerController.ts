import { useCallback, useMemo } from 'react'
import { extractLoops } from '../../../lib/loops'
import { useCanvasSelection } from '../../../hooks/useCanvasSelection'
import { useConsumeChainQuery } from '../../../hooks/useConsumeChainQuery'
import { useNodeDetail } from '../../../hooks/useNodeDetail'
import { useReturningFlowRate } from '../../../hooks/useReturningFlowRate'
import { useSystemStatus } from '../../../hooks/useSystemStatus'

export function useNetworkExplorerController(apiBase: string) {
  const query = useConsumeChainQuery(apiBase)
  const selection = useCanvasSelection({
    selectNode: query.selectNode,
    selectEdge: query.selectEdge,
  })
  const nodeDetail = useNodeDetail(apiBase, null)
  const systemStatus = useSystemStatus(apiBase)
  const loops = useMemo(() => extractLoops(query.filteredRows), [query.filteredRows])
  const selectedChainId = query.selectedEdge?.chainId ?? null
  const returningFlow = useReturningFlowRate(
    apiBase,
    query.selectedNode?.id ?? query.selectedEdge?.target ?? null,
    query.selectedEdge?.source ?? null,
  )
  const flowRateView = useMemo(
    () => ({
      data: returningFlow.data,
      error: returningFlow.error,
      status: returningFlow.status,
    }),
    [returningFlow.data, returningFlow.error, returningFlow.status],
  )

  const handleSelectLoop = useCallback(
    (chainId: string) => {
      const edge = query.graph.edges.find((candidate) => candidate.chainId === chainId)
      if (edge) query.selectEdge(edge)
    },
    [query],
  )

  const inspectorEmptyMessage =
    query.origin === 'idle'
      ? '运行查询以探索消费网络。'
      : query.filteredRows.length === 0 && query.rows.length > 0
        ? `当前页过滤隐藏了 ${query.rows.length} 行。`
        : '没有匹配的链路。可尝试循环状态“全部”或切换模式。'

  return {
    flowRateView,
    handleSelectLoop,
    inspectorEmptyMessage,
    loops,
    nodeDetail,
    query,
    selectedChainId,
    selection,
    systemStatus,
  }
}
