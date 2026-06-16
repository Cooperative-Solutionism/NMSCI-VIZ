import { ApiClient, queryConsumeChains } from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
import { dashboardQueryPage, dashboardQuerySize } from '../app/config'
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

const fixedConsumeChainQueryPageRequest = {
  page: dashboardQueryPage,
  size: dashboardQuerySize,
}

export function useConsumeChainQuery(apiBase: string) {
  const [mode, setMode] = useState<QueryMode>('node')
  const [nodeId, setNodeId] = useState('')
  const [loopStatus, setLoopStatus] = useState<LoopStatus>('all')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
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
    })
  }, [apiBase, loopStatus, mode, nodeId])

  const runQuery = useCallback(
    async (queryOverride?: RunQueryOverride) => {
      const generation = graphRequestGenerationRef.current + 1
      graphRequestGenerationRef.current = generation
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
          fixedConsumeChainQueryPageRequest,
        )
        if (generation !== graphRequestGenerationRef.current) return
        const { content, skipped } = normalizeRowsSafely(result.data.content)
        setRows(content)
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
          fixedConsumeChainQueryPageRequest,
        )
        if (generation !== graphRequestGenerationRef.current) return
        const { content, skipped } = normalizeRowsSafely(result.data.content)
        setRows((currentRows) => mergeConsumeChains(currentRows, content))
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
    warning,
  }
}
