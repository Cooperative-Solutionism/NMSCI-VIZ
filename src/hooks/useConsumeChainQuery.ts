import { ApiClient, normalizeConsumeChainResponseDTO, queryConsumeChains } from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
import { dashboardQuerySize } from '../app/config'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  mergeConsumeChains,
} from '../lib/chainGraph'
import { consumeChainFilters } from '../lib/consumeChainFilters'
import { errorMessage } from '../lib/errors'
import type {
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTO,
  ConsumeChainResponseDTORaw,
  LoopStatus,
  QueryMode,
  SliceResponseDTO,
} from '../lib/types'

export type CurrencyFilter = 'all' | '1' | '0'
export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string }
export type DataOrigin = 'idle' | 'backend'
type RunQueryOverride = { mode: QueryMode; nodeId: string }

export function useConsumeChainQuery(apiBase: string, defaultPageSize?: number) {
  void defaultPageSize
  const [mode, setMode] = useState<QueryMode>('node')
  const [nodeId, setNodeId] = useState('')
  const [loopStatus, setLoopStatus] = useState<LoopStatus>('all')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [rows, setRows] = useState<ConsumeChainResponseDTO[]>([])
  const [slice, setSlice] = useState<SliceResponseDTO<ConsumeChainResponseDTO>>(
    makeSlice([], dashboardQuerySize),
  )
  const [selection, setSelection] = useState<Selection | null>(null)
  const [origin, setOrigin] = useState<DataOrigin>('idle')
  const [loading, setLoading] = useState(false)
  const [extendLoading, setExtendLoading] = useState<QueryMode | null>(null)
  const [extended, setExtended] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const graphRequestGenerationRef = useRef(0)

  // 改任一查询参数都视为退出「扩展态」：合并视图随之失效，下一次 Load/翻页取回干净数据。
  const changeMode = useCallback((next: QueryMode) => {
    setMode(next)
    setExtended(false)
  }, [])
  const changeNodeId = useCallback((next: string) => {
    setNodeId(next)
    setExtended(false)
  }, [])
  const changeLoopStatus = useCallback((next: LoopStatus) => {
    setLoopStatus(next)
    setExtended(false)
  }, [])

  // currencyFilter 是「当前页视图过滤」：仅在已取回的 rows 上客户端过滤，不下推后端（/consume-chains 无 currency 参数），
  // 也不随翻页/extend 自动重置——下一次 runQuery 取回干净数据时才回到全量口径。
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const currencyMatches =
        currencyFilter === 'all' || row.consumeChain.currencyType === Number(currencyFilter)
      const loopMatches =
        loopStatus === 'all' || row.consumeChain.isLoop === (loopStatus === 'looped')
      return currencyMatches && loopMatches
    })
  }, [currencyFilter, loopStatus, rows])

  const graph = useMemo(() => buildGraphFromConsumeChains(filteredRows), [filteredRows])
  const effectiveSelection = useMemo<Selection | null>(() => {
    if (selection?.kind === 'edge' && graph.edges.some((edge) => edge.id === selection.id)) {
      return selection
    }
    if (selection?.kind === 'node' && graph.nodes.some((node) => node.id === selection.id)) {
      return selection
    }
    if (graph.edges[0]) return { kind: 'edge', id: graph.edges[0].id }
    if (graph.nodes[0]) return { kind: 'node', id: graph.nodes[0].id }
    return null
  }, [graph.edges, graph.nodes, selection])

  const selectedEdge = useMemo(() => {
    if (effectiveSelection?.kind !== 'edge') return null
    return graph.edges.find((edge) => edge.id === effectiveSelection.id) ?? null
  }, [effectiveSelection, graph.edges])

  const selectedNode = useMemo(() => {
    if (effectiveSelection?.kind !== 'node') return null
    return graph.nodes.find((node) => node.id === effectiveSelection.id) ?? null
  }, [effectiveSelection, graph.nodes])

  const selectedChain = useMemo(() => {
    if (!selectedEdge) return null
    return filteredRows.find((row) => row.consumeChain.id === selectedEdge.chainId) ?? null
  }, [filteredRows, selectedEdge])

  const requestUrl = useMemo(() => {
    return buildConsumeChainUrl(apiBase, {
      mode,
      nodeId,
      loopStatus,
      page: 0,
      size: dashboardQuerySize,
    })
  }, [apiBase, loopStatus, mode, nodeId])

  const runQuery = useCallback(
    async (targetPageOrOverride?: number | RunQueryOverride, override?: RunQueryOverride) => {
      const generation = graphRequestGenerationRef.current + 1
      graphRequestGenerationRef.current = generation
      const queryOverride = typeof targetPageOrOverride === 'object' ? targetPageOrOverride : override
      // 允许调用方一次性指定 mode/nodeId（避免 setState 异步导致 runQuery 读到旧值的竞态）。
      const effectiveMode = queryOverride?.mode ?? mode
      const effectiveNodeId = (queryOverride?.nodeId ?? nodeId).trim()

      setLoading(true)
      setError(null)
      setWarning(null)
      if (queryOverride) {
        setMode(queryOverride.mode)
        setNodeId(queryOverride.nodeId)
      }

      try {
        const result = await queryConsumeChains(
          client,
          consumeChainFilters(effectiveMode, effectiveNodeId, loopStatus),
          { page: 0, size: dashboardQuerySize },
        )
        if (generation !== graphRequestGenerationRef.current) return
        const { content, skipped } = normalizeRowsSafely(result.data.content)
        setRows(content)
        setSlice({ ...result.data, content })
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
    [client, loopStatus, mode, nodeId],
  )

  const extendFromNode = useCallback(
    async (node: ChainGraphNode, targetMode: QueryMode) => {
      const generation = graphRequestGenerationRef.current + 1
      graphRequestGenerationRef.current = generation
      setLoading(true)
      setExtendLoading(targetMode)
      setError(null)
      setMode(targetMode)
      setNodeId(node.id)
      setSelection({ kind: 'node', id: node.id })

      try {
        const result = await queryConsumeChains(
          client,
          consumeChainFilters(targetMode, node.id, loopStatus),
          { page: 0, size: dashboardQuerySize },
        )
        if (generation !== graphRequestGenerationRef.current) return
        const { content, skipped } = normalizeRowsSafely(result.data.content)
        setRows((currentRows) => mergeConsumeChains(currentRows, content))
        setSlice({ ...result.data, content })
        setOrigin('backend')
        setExtended(true)
        setWarning(skipWarning(skipped))
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
    [client, loopStatus],
  )

  const selectEdge = useCallback((edge: ChainGraphEdge) => {
    setSelection({ kind: 'edge', id: edge.id })
  }, [])

  const selectNode = useCallback((node: ChainGraphNode) => {
    setSelection({ kind: 'node', id: node.id })
  }, [])

  return {
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
    page: 0,
    requestUrl,
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
    size: dashboardQuerySize,
    slice,
    warning,
  }
}

function makeSlice(
  rows: ConsumeChainResponseDTO[],
  defaultPageSize: number,
): SliceResponseDTO<ConsumeChainResponseDTO> {
  return {
    content: rows,
    page: 0,
    size: defaultPageSize,
    numberOfElements: rows.length,
    hasNext: false,
    hasPrevious: false,
  }
}

// 逐行归一化：单条链含超过 2^53 的金额时 SDK 的 toSafeBigInt 会抛错，
// 这里跳过该行并计数，避免一条超大额链让整页查询失败（仅是临时前端兜底，根因需 SDK 侧字符串传输 int64）。
function normalizeRowsSafely(rawRows: ConsumeChainResponseDTORaw[]): {
  content: ConsumeChainResponseDTO[]
  skipped: number
} {
  const content: ConsumeChainResponseDTO[] = []
  let skipped = 0
  for (const raw of rawRows) {
    try {
      content.push(normalizeConsumeChainResponseDTO(raw))
    } catch {
      skipped += 1
    }
  }
  return { content, skipped }
}

function skipWarning(skipped: number): string | null {
  if (skipped <= 0) return null
  return `已跳过 ${skipped} 条链路：金额超过精度安全范围（>2^53）。`
}
