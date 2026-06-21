import { ApiClient, queryConsumeChains } from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
import { defaultConsumeChainPage, defaultConsumeChainPageSize } from '../app/config'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  mergeConsumeChains,
  refreshConsumeChains,
} from '../lib/chainGraph'
import { consumeChainFilters } from '../lib/consumeChainFilters'
import { errorMessage } from '../lib/errors'
import type {
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTO,
  LoopStatus,
  QueryMode,
} from '../lib/types'
import {
  filterConsumeChainRows,
  findSelectedChain,
  findSelectedEdge,
  findSelectedNode,
  normalizeRowsSafely,
  resolveEffectiveSelection,
  skipWarning,
  type CurrencyFilter,
  type DataOrigin,
  type RunQueryOverride,
  type Selection,
} from './consume-chain-query/queryState'

export type { CurrencyFilter, DataOrigin, Selection }
export type { RunQueryOverride } from './consume-chain-query/queryState'

const maxConsumeChainPageSize = 200

function normalizePage(value: number): number {
  return Math.max(0, Math.trunc(value))
}

function normalizePageSize(value: number): number {
  return Math.min(maxConsumeChainPageSize, Math.max(1, Math.trunc(value)))
}

export function useConsumeChainQuery(apiBase: string) {
  const [mode, setMode] = useState<QueryMode>('node')
  const [nodeId, setNodeId] = useState('')
  const [loopStatus, setLoopStatus] = useState<LoopStatus>('all')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [queryPage, setQueryPage] = useState(defaultConsumeChainPage)
  const [queryPageSize, setQueryPageSize] = useState(defaultConsumeChainPageSize)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [rows, setRows] = useState<ConsumeChainResponseDTO[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [origin, setOrigin] = useState<DataOrigin>('idle')
  const [loading, setLoading] = useState(false)
  const [extendLoading, setExtendLoading] = useState<QueryMode | null>(null)
  const [extended, setExtended] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const graphRequestGenerationRef = useRef(0)
  const graphResetGenerationRef = useRef(0)

  const changeMode = useCallback((next: QueryMode) => {
    setMode(next)
    setQueryPage(defaultConsumeChainPage)
    setExtended(false)
  }, [])
  const changeNodeId = useCallback((next: string) => {
    setNodeId(next)
    setQueryPage(defaultConsumeChainPage)
    setExtended(false)
  }, [])
  const changeLoopStatus = useCallback((next: LoopStatus) => {
    setLoopStatus(next)
    setQueryPage(defaultConsumeChainPage)
    setExtended(false)
  }, [])
  const changeQueryPage = useCallback((next: number) => {
    setQueryPage(normalizePage(next))
    setExtended(false)
  }, [])
  const changeQueryPageSize = useCallback((next: number) => {
    setQueryPageSize(normalizePageSize(next))
    setExtended(false)
  }, [])

  const filteredRows = useMemo(
    () => filterConsumeChainRows(rows, currencyFilter, loopStatus),
    [currencyFilter, loopStatus, rows],
  )
  const graph = useMemo(() => buildGraphFromConsumeChains(filteredRows), [filteredRows])
  const effectiveSelection = useMemo<Selection | null>(
    () => resolveEffectiveSelection(graph, selection),
    [graph, selection],
  )
  const selectedEdge = useMemo(
    () => findSelectedEdge(graph.edges, effectiveSelection),
    [effectiveSelection, graph.edges],
  )
  const selectedNode = useMemo(
    () => findSelectedNode(graph.nodes, effectiveSelection),
    [effectiveSelection, graph.nodes],
  )
  const selectedChain = useMemo(
    () => findSelectedChain(filteredRows, selectedEdge),
    [filteredRows, selectedEdge],
  )
  const requestUrl = useMemo(() => {
    return buildConsumeChainUrl(apiBase, {
      mode,
      nodeId,
      loopStatus,
      page: queryPage,
      size: queryPageSize,
    })
  }, [apiBase, loopStatus, mode, nodeId, queryPage, queryPageSize])

  const runQuery = useCallback(
    async (queryOverride?: RunQueryOverride) => {
      const generation = graphRequestGenerationRef.current + 1
      graphRequestGenerationRef.current = generation
      const effectiveMode = queryOverride?.mode ?? mode
      const effectiveNodeId = (queryOverride?.nodeId ?? nodeId).trim()
      const effectiveLoopStatus = queryOverride?.loopStatus ?? loopStatus
      const effectivePage = normalizePage(queryOverride?.page ?? queryPage)
      const effectiveSize = normalizePageSize(queryOverride?.size ?? queryPageSize)

      setLoading(true)
      setExtendLoading(null)
      setError(null)
      setWarning(null)
      if (queryOverride) {
        setMode(effectiveMode)
        setNodeId(effectiveNodeId)
        setLoopStatus(effectiveLoopStatus)
        setQueryPage(effectivePage)
        setQueryPageSize(effectiveSize)
      }

      try {
        const result = await queryConsumeChains(
          client,
          consumeChainFilters(effectiveMode, effectiveNodeId, effectiveLoopStatus),
          {
            page: effectivePage,
            size: effectiveSize,
          },
        )
        if (generation !== graphRequestGenerationRef.current) return
        const { content, skipped } = normalizeRowsSafely(result.data.content)
        graphResetGenerationRef.current += 1
        setRows(content)
        setQueryPage(result.data.page)
        setQueryPageSize(result.data.size)
        setHasNextPage(result.data.hasNext)
        setHasPreviousPage(result.data.hasPrevious)
        setOrigin('backend')
        setSelection(null)
        setExtended(false)
        setWarning(skipWarning(skipped))
      } catch (queryError) {
        if (generation !== graphRequestGenerationRef.current) return
        setError(errorMessage(queryError, '未知请求错误'))
      } finally {
        if (generation === graphRequestGenerationRef.current) {
          setLoading(false)
        }
      }
    },
    [client, loopStatus, mode, nodeId, queryPage, queryPageSize],
  )

  const extendFromNode = useCallback(
    async (node: ChainGraphNode, targetMode: QueryMode) => {
      const generation = graphRequestGenerationRef.current + 1
      graphRequestGenerationRef.current = generation
      const graphResetGeneration = graphResetGenerationRef.current
      setLoading(true)
      setExtendLoading(targetMode)
      setError(null)
      // 加载消费链是加法/延展语义：只标记选中右键来源节点，不改写浏览查询的 mode/nodeId/page
      // （那些驱动 requestUrl / 复制 curl，属于上一次 runQuery 的语义）。
      setSelection({ kind: 'node', id: node.id })

      try {
        const result = await queryConsumeChains(
          client,
          consumeChainFilters(targetMode, node.id, loopStatus),
          {
            page: defaultConsumeChainPage,
            size: queryPageSize,
          },
        )
        const { content, skipped } = normalizeRowsSafely(result.data.content)
        if (graphResetGeneration !== graphResetGenerationRef.current) return
        // 同一图谱上的延展请求始终并入：合并按 chain id 去重且与顺序无关；
        // 若期间完整浏览查询已替换图谱，则丢弃旧延展响应，避免污染新结果。
        setRows((currentRows) => mergeConsumeChains(currentRows, content))
        // 仅最新一次加载负责瞬时 UI 状态（来源/已延展/告警）。
        if (generation === graphRequestGenerationRef.current) {
          setOrigin('backend')
          setExtended(true)
          setWarning(skipWarning(skipped))
        }
      } catch (queryError) {
        if (generation !== graphRequestGenerationRef.current) return
        setError(errorMessage(queryError, '未知请求错误'))
      } finally {
        if (generation === graphRequestGenerationRef.current) {
          setLoading(false)
          setExtendLoading(null)
        }
      }
    },
    [client, loopStatus, queryPageSize],
  )

  const refreshFromNodeIds = useCallback(
    async (nodeIds: readonly string[], selectedNodeId?: string) => {
      const uniqueNodeIds = Array.from(
        new Set(nodeIds.map((id) => id.trim()).filter((id) => id.length > 0)),
      )
      const selectedId = selectedNodeId?.trim()
      if (selectedId && !uniqueNodeIds.includes(selectedId)) {
        uniqueNodeIds.push(selectedId)
      }
      if (uniqueNodeIds.length === 0) return

      const generation = graphRequestGenerationRef.current + 1
      graphRequestGenerationRef.current = generation
      const graphResetGeneration = graphResetGenerationRef.current
      setLoading(true)
      setExtendLoading('node')
      setError(null)
      if (selectedId) setSelection({ kind: 'node', id: selectedId })

      try {
        const results = await Promise.all(
          uniqueNodeIds.map((id) =>
            queryConsumeChains(client, consumeChainFilters('node', id, loopStatus), {
              page: defaultConsumeChainPage,
              size: queryPageSize,
            }),
          ),
        )
        if (graphResetGeneration !== graphResetGenerationRef.current) return

        const refreshedRows: ConsumeChainResponseDTO[] = []
        let skippedCount = 0
        for (const result of results) {
          const { content, skipped } = normalizeRowsSafely(result.data.content)
          refreshedRows.push(...content)
          skippedCount += skipped
        }

        setRows((currentRows) => refreshConsumeChains(currentRows, refreshedRows))
        if (generation === graphRequestGenerationRef.current) {
          setOrigin('backend')
          setExtended(true)
          setWarning(skipWarning(skippedCount))
        }
      } catch (queryError) {
        if (generation !== graphRequestGenerationRef.current) return
        setError(errorMessage(queryError, '未知请求错误'))
      } finally {
        if (generation === graphRequestGenerationRef.current) {
          setLoading(false)
          setExtendLoading(null)
        }
      }
    },
    [client, loopStatus, queryPageSize],
  )

  const selectEdge = useCallback((edge: ChainGraphEdge) => {
    setSelection({ kind: 'edge', id: edge.id })
  }, [])

  const selectNode = useCallback((node: ChainGraphNode) => {
    setSelection({ kind: 'node', id: node.id })
  }, [])

  const clear = useCallback(() => {
    graphRequestGenerationRef.current += 1
    graphResetGenerationRef.current += 1
    setRows([])
    setSelection(null)
    setOrigin('idle')
    setLoading(false)
    setExtendLoading(null)
    setExtended(false)
    setError(null)
    setWarning(null)
    setHasNextPage(false)
    setHasPreviousPage(false)
  }, [])

  return {
    clear,
    currencyFilter,
    effectiveSelection,
    error,
    extendFromNode,
    extendLoading,
    extended,
    filteredRows,
    graph,
    loading,
    loopStatus,
    mode,
    nodeId,
    origin,
    page: queryPage,
    pageSize: queryPageSize,
    requestUrl,
    refreshFromNodeIds,
    rows,
    runQuery,
    selectEdge,
    selectNode,
    selectedChain,
    selectedEdge,
    selectedNode,
    setCurrencyFilter,
    setLoopStatus: changeLoopStatus,
    setMode: changeMode,
    setNodeId: changeNodeId,
    setPage: changeQueryPage,
    setPageSize: changeQueryPageSize,
    hasNextPage,
    hasPreviousPage,
    warning,
  }
}
