import { ApiClient, normalizeConsumeChainResponseDTO, queryConsumeChains } from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
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
  SliceResponseDTO,
} from '../lib/types'

export type CurrencyFilter = 'all' | '1' | '0'
export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string }
export type DataOrigin = 'idle' | 'backend'

export function useConsumeChainQuery(apiBase: string, defaultPageSize: number) {
  const [mode, setMode] = useState<QueryMode>('node')
  const [nodeId, setNodeId] = useState('')
  const [loopStatus, setLoopStatus] = useState<LoopStatus>('all')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(defaultPageSize)
  const [rows, setRows] = useState<ConsumeChainResponseDTO[]>([])
  const [slice, setSlice] = useState<SliceResponseDTO<ConsumeChainResponseDTO>>(makeSlice([], defaultPageSize))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [origin, setOrigin] = useState<DataOrigin>('idle')
  const [loading, setLoading] = useState(false)
  const [extendLoading, setExtendLoading] = useState<QueryMode | null>(null)
  const [extended, setExtended] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const graphRequestGenerationRef = useRef(0)

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
    return buildConsumeChainUrl(apiBase, { mode, nodeId, loopStatus, page, size })
  }, [apiBase, loopStatus, mode, nodeId, page, size])

  const runQuery = useCallback(async (targetPage: number) => {
    const generation = graphRequestGenerationRef.current + 1
    graphRequestGenerationRef.current = generation
    const normalizedSize = Math.min(200, Math.max(1, size))
    const normalizedPage = Math.max(0, targetPage)

    setLoading(true)
    setError(null)
    setPage(normalizedPage)
    setSize(normalizedSize)

    try {
      const result = await queryConsumeChains(
        client,
        consumeChainFilters(mode, nodeId.trim(), loopStatus),
        { page: normalizedPage, size: normalizedSize },
      )
      if (generation !== graphRequestGenerationRef.current) return
      const content = result.data.content.map(normalizeConsumeChainResponseDTO)
      setRows(content)
      setSlice({ ...result.data, content })
      setOrigin('backend')
      setSelection(null)
      setExtended(false)
    } catch (queryError) {
      if (generation !== graphRequestGenerationRef.current) return
      setError(errorMessage(queryError, 'Unknown request error'))
    } finally {
      if (generation === graphRequestGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [client, loopStatus, mode, nodeId, size])

  const extendFromNode = useCallback(async (node: ChainGraphNode, targetMode: QueryMode) => {
    const generation = graphRequestGenerationRef.current + 1
    graphRequestGenerationRef.current = generation
    const normalizedSize = Math.min(200, Math.max(1, size))

    setLoading(true)
    setExtendLoading(targetMode)
    setError(null)
    setMode(targetMode)
    setNodeId(node.id)
    setPage(0)
    setSize(normalizedSize)
    setSelection({ kind: 'node', id: node.id })

    try {
      const result = await queryConsumeChains(
        client,
        consumeChainFilters(targetMode, node.id, loopStatus),
        { page: 0, size: normalizedSize },
      )
      if (generation !== graphRequestGenerationRef.current) return
      const content = result.data.content.map(normalizeConsumeChainResponseDTO)
      setRows((currentRows) => mergeConsumeChains(currentRows, content))
      setSlice({ ...result.data, content })
      setOrigin('backend')
      setExtended(true)
    } catch (queryError) {
      if (generation !== graphRequestGenerationRef.current) return
      setError(errorMessage(queryError, 'Unknown request error'))
    } finally {
      if (generation === graphRequestGenerationRef.current) {
        setLoading(false)
        setExtendLoading(null)
      }
    }
  }, [client, loopStatus, size])

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
    page,
    requestUrl,
    rows,
    runQuery,
    selectEdge,
    selectNode,
    selectedChain,
    selectedEdge,
    selectedNode,
    setCurrencyFilter,
    setLoopStatus,
    setMode,
    setNodeId,
    setPage,
    setSize,
    size,
    slice,
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
