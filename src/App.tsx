import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Database,
  Filter,
  GitBranch,
  LocateFixed,
  Network,
  Orbit,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import './App.css'
import { NetworkGraph } from './components/NetworkGraph'
import { fetchConsumeChains, fetchFlowNodeDetail } from './lib/api'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  formatAmount,
  mergeConsumeChains,
  shortId,
} from './lib/chainGraph'
import type {
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTORaw,
  FlowNodeRegisterMsgRaw,
  LoopStatus,
  QueryMode,
  SliceResponseDTO,
} from './lib/types'

type CurrencyFilter = 'all' | '1' | '0'
type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string }
type DataOrigin = 'idle' | 'backend'
type NodeDetailStatus = 'idle' | 'loading' | 'loaded' | 'error'

const defaultApiBase = '/api'
const defaultPageSize = 50

function App() {
  const [apiBase, setApiBase] = useState(defaultApiBase)
  const [mode, setMode] = useState<QueryMode>('node')
  const [nodeId, setNodeId] = useState('')
  const [loopStatus, setLoopStatus] = useState<LoopStatus>('all')
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(defaultPageSize)
  const [rows, setRows] = useState<ConsumeChainResponseDTORaw[]>([])
  const [slice, setSlice] = useState<SliceResponseDTO<ConsumeChainResponseDTORaw>>(makeSlice([]))
  const [selection, setSelection] = useState<Selection | null>(null)
  const [origin, setOrigin] = useState<DataOrigin>('idle')
  const [loading, setLoading] = useState(false)
  const [extendLoading, setExtendLoading] = useState<QueryMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nodeDetailsById, setNodeDetailsById] = useState<Record<string, FlowNodeRegisterMsgRaw>>({})
  const [nodeDetailStatus, setNodeDetailStatus] = useState<NodeDetailStatus>('idle')
  const [nodeDetailError, setNodeDetailError] = useState<string | null>(null)

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
  const selectedNodeDetail = selectedNode ? nodeDetailsById[selectedNode.id] : undefined
  const requestUrl = useMemo(() => {
    return buildConsumeChainUrl(apiBase, { mode, nodeId, loopStatus, page, size })
  }, [apiBase, loopStatus, mode, nodeId, page, size])

  const runQuery = useCallback(async (targetPage = page) => {
    const normalizedSize = Math.min(200, Math.max(1, size))
    const normalizedPage = Math.max(0, targetPage)

    setLoading(true)
    setError(null)
    setPage(normalizedPage)
    setSize(normalizedSize)

    try {
      const result = await fetchConsumeChains(apiBase, {
        mode,
        nodeId: nodeId.trim(),
        loopStatus,
        page: normalizedPage,
        size: normalizedSize,
      })
      setRows(result.content)
      setSlice(result)
      setOrigin('backend')
      setSelection(null)
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Unknown request error')
    } finally {
      setLoading(false)
    }
  }, [apiBase, loopStatus, mode, nodeId, page, size])

  const loadNodeDetail = useCallback(async (targetNodeId: string) => {
    setNodeDetailStatus('loading')
    setNodeDetailError(null)

    try {
      const detail = await fetchFlowNodeDetail(apiBase, targetNodeId)
      setNodeDetailsById((currentDetails) => ({
        ...currentDetails,
        [targetNodeId]: detail,
      }))
      setNodeDetailStatus('loaded')
    } catch (detailError) {
      setNodeDetailStatus('error')
      setNodeDetailError(detailError instanceof Error ? detailError.message : 'Unknown node detail error')
    }
  }, [apiBase])

  const selectNodeAndFetch = useCallback((node: ChainGraphNode) => {
    setSelection({ kind: 'node', id: node.id })
    void loadNodeDetail(node.id)
  }, [loadNodeDetail])

  const extendFromNode = useCallback(async (node: ChainGraphNode, targetMode: QueryMode) => {
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
      const result = await fetchConsumeChains(apiBase, {
        mode: targetMode,
        nodeId: node.id,
        loopStatus,
        page: 0,
        size: normalizedSize,
      })
      setRows((currentRows) => mergeConsumeChains(currentRows, result.content))
      setSlice(result)
      setOrigin('backend')
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : 'Unknown request error')
    } finally {
      setLoading(false)
      setExtendLoading(null)
    }
  }, [apiBase, loopStatus, size])

  const selectFirstNode = useCallback(() => {
    if (graph.nodes[0]) selectNodeAndFetch(graph.nodes[0])
  }, [graph.nodes, selectNodeAndFetch])

  const selectFirstEdge = useCallback(() => {
    if (graph.edges[0]) setSelection({ kind: 'edge', id: graph.edges[0].id })
  }, [graph.edges])

  const handleNodeSelect = useCallback((node: ChainGraphNode) => {
    selectNodeAndFetch(node)
  }, [selectNodeAndFetch])

  const handleEdgeSelect = useCallback((edge: ChainGraphEdge) => {
    setSelection({ kind: 'edge', id: edge.id })
  }, [])

  const handlePreviousPage = useCallback(() => {
    const nextPage = Math.max(0, page - 1)
    void runQuery(nextPage)
  }, [page, runQuery])

  const handleNextPage = useCallback(() => {
    void runQuery(page + 1)
  }, [page, runQuery])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NMSCI Consumption Network</p>
          <h1>Network Explorer</h1>
        </div>
        <div className="topbar-status" aria-label="Data status">
          <span className={`status-dot ${origin}`} />
          <span>{origin === 'backend' ? 'Backend data' : 'No data'}</span>
          <span className="status-divider" />
          <span>{graph.nodes.length} nodes</span>
          <span>{graph.edges.length} edges</span>
        </div>
      </header>

      <section className="workspace">
        <aside className="query-panel" aria-label="Consume chain query">
          <PanelHeader icon={<Filter size={16} />} title="Query" />

          <Field label="API base">
            <input
              value={apiBase}
              onChange={(event) => setApiBase(event.currentTarget.value)}
              spellCheck={false}
            />
          </Field>

          <Field label="Mode">
            <div className="segmented" role="group" aria-label="Query mode">
              <button
                className={mode === 'start' ? 'active' : ''}
                type="button"
                onClick={() => setMode('start')}
              >
                <LocateFixed size={15} />
                Start
              </button>
              <button
                className={mode === 'end' ? 'active' : ''}
                type="button"
                onClick={() => setMode('end')}
              >
                <CircleDot size={15} />
                End
              </button>
              <button
                className={mode === 'node' ? 'active' : ''}
                type="button"
                onClick={() => setMode('node')}
              >
                <Orbit size={15} />
                Node
              </button>
            </div>
          </Field>

          <Field label="Flow node UUID">
            <textarea
              rows={3}
              value={nodeId}
              onChange={(event) => setNodeId(event.currentTarget.value)}
              spellCheck={false}
            />
          </Field>

          <Field label="Loop status">
            <div className="segmented compact" role="group" aria-label="Loop status">
              {(['all', 'looped', 'open'] as const).map((status) => (
                <button
                  key={status}
                  className={loopStatus === status ? 'active' : ''}
                  type="button"
                  onClick={() => setLoopStatus(status)}
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>
          </Field>

          <div className="form-grid">
            <Field label="Currency">
              <select
                value={currencyFilter}
                onChange={(event) => setCurrencyFilter(event.currentTarget.value as CurrencyFilter)}
              >
                <option value="all">All</option>
                <option value="1">CNY</option>
                <option value="0">Au ug</option>
              </select>
            </Field>
            <Field label="Page">
              <input
                min={0}
                type="number"
                value={page}
                onChange={(event) => setPage(Math.max(0, Number(event.currentTarget.value)))}
              />
            </Field>
            <Field label="Size">
              <input
                min={1}
                max={200}
                type="number"
                value={size}
                onChange={(event) => setSize(Number(event.currentTarget.value))}
              />
            </Field>
          </div>

          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              disabled={loading || nodeId.trim().length === 0}
              onClick={() => void runQuery()}
            >
              <Search size={16} />
              {loading ? 'Loading' : 'Load'}
            </button>
          </div>

          <div className="request-preview">
            <span>Request</span>
            <code>{requestUrl}</code>
          </div>

          {error ? <p className="error-banner">{error}. Current graph was kept unchanged.</p> : null}

          <div className="advanced-block">
            <PanelHeader icon={<SlidersHorizontal size={16} />} title="Advanced filters" />
            <div className="disabled-field">Amount range</div>
            <div className="disabled-field">Mount time window</div>
            <div className="disabled-field">Max depth</div>
          </div>
        </aside>

        <section className="graph-panel" aria-label="Network visualization">
          <div className="metrics-strip">
            <MetricCard label="Total chains" value={graph.stats.totalChains.toString()} icon={<GitBranch size={17} />} />
            <MetricCard label="Looped" value={graph.stats.loopedChains.toString()} tone="looped" icon={<Activity size={17} />} />
            <MetricCard label="Open" value={graph.stats.openChains.toString()} tone="open" icon={<Network size={17} />} />
            <MetricCard
              label="Volume"
              value={formatAmount(graph.stats.volume, graph.stats.currencyType)}
              icon={<Database size={17} />}
            />
          </div>

          <NetworkGraph
            graph={graph}
            selectedId={effectiveSelection?.id ?? null}
            onSelectNode={handleNodeSelect}
            onSelectEdge={handleEdgeSelect}
          />
        </section>

        <aside className="inspector-panel" aria-label="Selection inspector">
          <div className="inspector-tabs" role="tablist" aria-label="Inspector tabs">
            <button
              className={effectiveSelection?.kind === 'node' ? 'active' : ''}
              type="button"
              onClick={selectFirstNode}
            >
              Node
            </button>
            <button
              className={effectiveSelection?.kind === 'edge' ? 'active' : ''}
              type="button"
              onClick={selectFirstEdge}
            >
              Edge
            </button>
          </div>

          {selectedEdge ? (
            <EdgeInspector edge={selectedEdge} chain={selectedChain} />
          ) : selectedNode ? (
            <NodeInspector
              detail={selectedNodeDetail}
              detailError={nodeDetailError}
              detailStatus={nodeDetailStatus}
              disabled={loading}
              extendLoading={extendLoading}
              node={selectedNode}
              onExtendEnd={() => void extendFromNode(selectedNode, 'end')}
              onExtendNode={() => void extendFromNode(selectedNode, 'node')}
              onExtendStart={() => void extendFromNode(selectedNode, 'start')}
            />
          ) : (
            <div className="empty-state">No chain data in the current filter.</div>
          )}
        </aside>
      </section>

      <footer className="footerbar">
        <div>
          <span className="footer-label">Slice</span>
          <span>
            page {slice.page} / size {slice.size} / {slice.numberOfElements} rows
          </span>
        </div>
        <div className="pagination">
          <button type="button" disabled={loading || !slice.hasPrevious} onClick={handlePreviousPage} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span>{loading ? 'Loading page' : origin === 'backend' ? 'Live slice' : 'No slice'}</span>
          <button type="button" disabled={loading || origin !== 'backend' || !slice.hasNext} onClick={handleNextPage} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </main>
  )
}

function MetricCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: ReactNode
  label: string
  tone?: 'looped' | 'open'
  value: string
}) {
  return (
    <div className={`metric-card ${tone ?? ''}`}>
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PanelHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="panel-header">
      {icon}
      <span>{title}</span>
    </div>
  )
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function EdgeInspector({
  chain,
  edge,
}: {
  chain: ConsumeChainResponseDTORaw | null
  edge: ChainGraphEdge
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<GitBranch size={16} />} title="Selected edge" />
      <div className={`status-pill ${edge.status}`}>{edge.status}</div>
      <DetailRow label="Edge ID" value={<code>{edge.id}</code>} />
      <DetailRow label="Chain ID" value={<code>{edge.chainId}</code>} />
      <DetailRow label="Amount" value={formatAmount(edge.amount, edge.currencyType)} />
      <DetailRow label="Source" value={<code>{edge.source}</code>} />
      <DetailRow label="Target" value={<code>{edge.target}</code>} />
      <DetailRow label="Record" value={<code>{edge.relatedTransactionRecord}</code>} />
      <DetailRow label="Mount" value={<code>{edge.relatedTransactionMount}</code>} />
      <DetailRow label="Mount time" value={formatMicros(edge.relatedTransactionMountTimestamp)} />
      {chain ? (
        <>
          <div className="section-title">Chain tail</div>
          <DetailRow label="Start" value={<code>{chain.consumeChain.start}</code>} />
          <DetailRow label="End" value={<code>{chain.consumeChain.end}</code>} />
          <DetailRow label="Tail mount" value={formatMicros(chain.consumeChain.tailMountTimestamp)} />
        </>
      ) : null}
    </div>
  )
}

function NodeInspector({
  detail,
  detailError,
  detailStatus,
  disabled,
  extendLoading,
  node,
  onExtendEnd,
  onExtendNode,
  onExtendStart,
}: {
  detail?: FlowNodeRegisterMsgRaw
  detailError: string | null
  detailStatus: NodeDetailStatus
  disabled: boolean
  extendLoading: QueryMode | null
  node: ChainGraphNode
  onExtendEnd: () => void
  onExtendNode: () => void
  onExtendStart: () => void
}) {
  return (
    <div className="inspector-content">
      <PanelHeader icon={<CircleDot size={16} />} title="Selected node" />
      <div className="node-actions">
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={onExtendNode}
        >
          {extendLoading === 'node' ? 'Loading' : 'Load node'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={onExtendStart}
        >
          {extendLoading === 'start' ? 'Extending' : 'Extend start'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={onExtendEnd}
        >
          {extendLoading === 'end' ? 'Extending' : 'Extend end'}
        </button>
      </div>
      <DetailRow label="Node" value={<code>{node.id}</code>} />
      <DetailRow label="Label" value={shortId(node.id)} />
      <DetailRow label="Touches" value={node.chainCount} />
      <DetailRow label="Volume" value={formatAmount(node.volume, 1)} />
      <div className="section-title">Backend detail</div>
      {detailStatus === 'loading' ? <div className="detail-state">Loading node detail...</div> : null}
      {detailStatus === 'error' ? (
        <div className="detail-state error">{detailError ?? 'Node detail request failed.'}</div>
      ) : null}
      {detail ? (
        <>
          <DetailRow label="Msg type" value={formatOptional(detail.msgType)} />
          <DetailRow label="Nonce" value={formatOptional(detail.nonce)} />
          <DetailRow label="Difficulty" value={formatOptional(detail.registerDifficultyTarget)} />
          <DetailRow label="Pubkey" value={<code>{formatOptional(detail.flowNodePubkey)}</code>} />
          <DetailRow label="TxID" value={<code>{formatOptional(detail.txid)}</code>} />
          <DetailRow label="Signature" value={<code>{formatOptional(detail.flowNodeSignature)}</code>} />
        </>
      ) : null}
    </div>
  )
}

function makeSlice(rows: ConsumeChainResponseDTORaw[]): SliceResponseDTO<ConsumeChainResponseDTORaw> {
  return {
    content: rows,
    page: 0,
    size: defaultPageSize,
    numberOfElements: rows.length,
    hasNext: false,
    hasPrevious: false,
  }
}

function statusLabel(status: LoopStatus): string {
  if (status === 'looped') return 'Looped'
  if (status === 'open') return 'Open'
  return 'All'
}

function formatMicros(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return new Date(Math.floor(value / 1000)).toISOString().replace('T', ' ').replace('.000Z', ' UTC')
}

function formatOptional(value: string | number | undefined): string {
  if (value === undefined || value === '') return '-'
  return String(value)
}

export default App
