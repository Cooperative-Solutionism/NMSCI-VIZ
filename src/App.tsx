import {
  Activity,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Copy,
  Database,
  Filter,
  GitBranch,
  KeyRound,
  LocateFixed,
  Network,
  Orbit,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import './App.css'
import { NetworkGraph } from './components/NetworkGraph'
import {
  ApiClient,
  MsgType,
  buildCentralPubkeyEmpowerPayload,
  buildFlowNodeRegisterPayload,
  calculateTargetFromNBits,
  concat,
  generateKeyPair,
  getFlowNodeRegisterMsgById,
  getLastBlock,
  mineNonce,
  nBitsToBytes,
  pubkeyToBytes,
  queryConsumeChains,
  sendCentralPubkeyEmpowerMsg,
  sendFlowNodeRegisterMsg,
  serializeCentralPubkeyEmpowerSubmitPayload,
  serializeFlowNodeRegister,
  signCentralPubkeyEmpowerPayload,
  signFlowNodeRegisterPayload,
  toBytesBigEndian,
  toHex,
  uuidToBytes,
  type ConsumeChainQueryFilters,
} from '@nmsci/sdk'
import {
  buildConsumeChainUrl,
  buildGraphFromConsumeChains,
  formatAmount,
  mergeConsumeChains,
  shortId,
} from './lib/chainGraph'
import {
  loadLocalFlowNodes,
  saveLocalFlowNodes,
  type LocalFlowNode,
  type LocalFlowNodeAuthorization,
  type LocalFlowNodeRegistration,
} from './lib/flowNodeStorage'
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
type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | null

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
  const [localFlowNodes, setLocalFlowNodes] = useState<LocalFlowNode[]>(() => loadLocalFlowNodes())
  const [selectedLocalPubkey, setSelectedLocalPubkey] = useState(() => localFlowNodes[0]?.publicKeyHex ?? '')
  const [registerDifficultyTarget, setRegisterDifficultyTarget] = useState('')
  const [centralPubkey, setCentralPubkey] = useState('')
  const [flowNodeBusy, setFlowNodeBusy] = useState<FlowNodeBusyState>(null)
  const [flowNodeStatus, setFlowNodeStatus] = useState<string | null>(null)
  const [flowNodeError, setFlowNodeError] = useState<string | null>(null)
  const [lastFlowNodeRawBytes, setLastFlowNodeRawBytes] = useState('')

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
  const selectedLocalNode = useMemo(() => {
    return localFlowNodes.find((localNode) => localNode.publicKeyHex === selectedLocalPubkey)
      ?? localFlowNodes[0]
      ?? null
  }, [localFlowNodes, selectedLocalPubkey])
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
      const client = new ApiClient({ baseUrl: apiBase })
      const result = await queryConsumeChains(
        client,
        consumeChainFilters(mode, nodeId.trim(), loopStatus),
        { page: normalizedPage, size: normalizedSize },
      )
      setRows(result.data.content)
      setSlice(result.data)
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
      const client = new ApiClient({ baseUrl: apiBase })
      const detail = await getFlowNodeRegisterMsgById(client, targetNodeId)
      setNodeDetailsById((currentDetails) => ({
        ...currentDetails,
        [targetNodeId]: detail.data,
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
      const client = new ApiClient({ baseUrl: apiBase })
      const result = await queryConsumeChains(
        client,
        consumeChainFilters(targetMode, node.id, loopStatus),
        { page: 0, size: normalizedSize },
      )
      setRows((currentRows) => mergeConsumeChains(currentRows, result.data.content))
      setSlice(result.data)
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

  const persistLocalFlowNodes = useCallback((updater: (currentNodes: LocalFlowNode[]) => LocalFlowNode[]) => {
    setLocalFlowNodes((currentNodes) => {
      const nextNodes = updater(currentNodes)
      saveLocalFlowNodes(nextNodes)
      return nextNodes
    })
  }, [])

  const handleGenerateFlowNode = useCallback(() => {
    const keypair = generateKeyPair()
    const now = new Date().toISOString()
    const nextNode: LocalFlowNode = {
      id: makeMessageId(),
      label: shortId(keypair.publicKey),
      privateKeyHex: keypair.privateKey,
      publicKeyHex: keypair.publicKey,
      createdAt: now,
      updatedAt: now,
      authorizations: [],
    }

    persistLocalFlowNodes((currentNodes) => [nextNode, ...currentNodes])
    setSelectedLocalPubkey(nextNode.publicKeyHex)
    setFlowNodeError(null)
    setFlowNodeStatus('Flow node generated and saved locally.')
    setLastFlowNodeRawBytes('')
  }, [persistLocalFlowNodes])

  const handleFillSelectedFlowNodeId = useCallback(() => {
    if (!selectedLocalNode) return
    setNodeId(queryIdForLocalFlowNode(selectedLocalNode))
    setFlowNodeError(null)
    setFlowNodeStatus('Flow node UUID filled into query.')
  }, [selectedLocalNode])

  const handleFetchRegisterDifficulty = useCallback(async () => {
    setFlowNodeBusy('difficulty')
    setFlowNodeError(null)

    try {
      const client = new ApiClient({ baseUrl: apiBase })
      const block = (await getLastBlock(client)).data
      if (!block.registerDifficultyTarget) {
        throw new Error('Latest block did not include registerDifficultyTarget')
      }
      setRegisterDifficultyTarget(nbitsHexToDecimalString(block.registerDifficultyTarget))
      if (block.centralPubkey) {
        setCentralPubkey(block.centralPubkey)
      }
      setFlowNodeStatus(`Latest register difficulty loaded from block ${block.height ?? '-'}.`)
    } catch (operationError) {
      setFlowNodeError(operationError instanceof Error ? operationError.message : 'Failed to load latest block')
    } finally {
      setFlowNodeBusy(null)
    }
  }, [apiBase])

  const handleRegisterFlowNode = useCallback(async () => {
    if (!selectedLocalNode) return

    setFlowNodeBusy('register')
    setFlowNodeError(null)

    let difficultyTarget = 0
    let rawBytesHex = ''
    let nonce = 0
    try {
      difficultyTarget = parseIntegerField(registerDifficultyTarget, 'Register difficulty target')
      const messageId = makeMessageId()
      const client = new ApiClient({ baseUrl: apiBase })
      const built = await buildRegisterMessage({
        uuid: messageId,
        privateKeyHex: selectedLocalNode.privateKeyHex,
        publicKeyHex: selectedLocalNode.publicKeyHex,
        difficultyHex: decimalToNbitsHex(difficultyTarget),
      })
      rawBytesHex = built.rawBytesHex
      nonce = built.nonce
      const response = (await sendFlowNodeRegisterMsg(client, built.bytes)).data
      const registration: LocalFlowNodeRegistration = {
        id: response.id ?? messageId,
        rawBytesHex: built.rawBytesHex,
        registerDifficultyTarget: difficultyTarget,
        nonce: built.nonce,
        txid: response.txid,
        status: 'sent',
        message: 'Register message accepted by backend.',
        updatedAt: new Date().toISOString(),
      }

      persistLocalFlowNodes((currentNodes) => updateLocalFlowNode(currentNodes, selectedLocalNode.id, {
        registration,
        updatedAt: registration.updatedAt,
      }))
      setLastFlowNodeRawBytes(built.rawBytesHex)
      setFlowNodeStatus(`Registered ${shortId(selectedLocalNode.publicKeyHex)} with nonce ${built.nonce}.`)
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : 'Flow node registration failed'
      const failedAt = new Date().toISOString()
      persistLocalFlowNodes((currentNodes) => updateLocalFlowNode(currentNodes, selectedLocalNode.id, {
        registration: {
          id: makeMessageId(),
          rawBytesHex,
          registerDifficultyTarget: difficultyTarget,
          nonce,
          status: 'failed',
          message,
          updatedAt: failedAt,
        },
        updatedAt: failedAt,
      }))
      setFlowNodeError(message)
    } finally {
      setFlowNodeBusy(null)
    }
  }, [apiBase, persistLocalFlowNodes, registerDifficultyTarget, selectedLocalNode])

  const handleAuthorizeCentralPubkey = useCallback(async () => {
    if (!selectedLocalNode) return

    setFlowNodeBusy('authorize')
    setFlowNodeError(null)

    try {
      const normalizedCentralPubkey = normalizePubkeyHex(centralPubkey)
      const messageId = makeMessageId()
      const client = new ApiClient({ baseUrl: apiBase })
      const built = await buildEmpowerMessage({
        uuid: messageId,
        privateKeyHex: selectedLocalNode.privateKeyHex,
        flowNodePubkeyHex: selectedLocalNode.publicKeyHex,
        centralPubkeyHex: normalizedCentralPubkey,
      })
      const response = (await sendCentralPubkeyEmpowerMsg(client, built.bytes)).data
      const authorization: LocalFlowNodeAuthorization = {
        id: response.id ?? messageId,
        centralPubkeyHex: normalizedCentralPubkey,
        rawBytesHex: built.rawBytesHex,
        txid: response.txid,
        status: 'sent',
        message: 'Authorization message accepted by backend.',
        updatedAt: new Date().toISOString(),
      }

      persistLocalFlowNodes((currentNodes) => updateLocalFlowNode(currentNodes, selectedLocalNode.id, {
        authorizations: [authorization, ...selectedLocalNode.authorizations],
        updatedAt: authorization.updatedAt,
      }))
      setLastFlowNodeRawBytes(built.rawBytesHex)
      setFlowNodeStatus(`Authorized central pubkey ${shortId(normalizedCentralPubkey)}.`)
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : 'Central pubkey authorization failed'
      setFlowNodeError(message)
    } finally {
      setFlowNodeBusy(null)
    }
  }, [apiBase, centralPubkey, persistLocalFlowNodes, selectedLocalNode])

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

          <div className="flow-node-block">
            <PanelHeader icon={<KeyRound size={16} />} title="Flow nodes" />
            <div className="action-row two">
              <button className="secondary-button" type="button" onClick={handleGenerateFlowNode}>
                <Plus size={15} />
                Generate flow node
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={flowNodeBusy === 'difficulty'}
                onClick={() => void handleFetchRegisterDifficulty()}
              >
                <RefreshCw size={15} />
                {flowNodeBusy === 'difficulty' ? 'Loading' : 'Use latest'}
              </button>
            </div>

            <Field label="Local flow node">
              <select
                value={selectedLocalNode?.publicKeyHex ?? ''}
                disabled={localFlowNodes.length === 0}
                onChange={(event) => setSelectedLocalPubkey(event.currentTarget.value)}
              >
                {localFlowNodes.length === 0 ? <option value="">No local nodes</option> : null}
                {localFlowNodes.map((localNode) => (
                  <option key={localNode.id} value={localNode.publicKeyHex}>
                    {localNode.label} / {shortHex(localNode.publicKeyHex)}
                  </option>
                ))}
              </select>
            </Field>

            {selectedLocalNode ? (
              <div className="node-key-box">
                <DetailRow label="Pubkey" value={<code>{selectedLocalNode.publicKeyHex}</code>} />
                <DetailRow label="Node ID" value={<code>{queryIdForLocalFlowNode(selectedLocalNode)}</code>} />
                <DetailRow label="Secret" value={<code>{maskSecret(selectedLocalNode.privateKeyHex)}</code>} />
                <DetailRow label="Saved" value={formatDateTime(selectedLocalNode.createdAt)} />
                <DetailRow label="Register" value={selectedLocalNode.registration?.status ?? '-'} />
                <DetailRow label="Auth count" value={selectedLocalNode.authorizations.length} />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleFillSelectedFlowNodeId}
                >
                  <Copy size={15} />
                  Fill node UUID
                </button>
              </div>
            ) : null}

            <Field label="Register difficulty target">
              <input
                value={registerDifficultyTarget}
                onChange={(event) => setRegisterDifficultyTarget(event.currentTarget.value)}
                inputMode="numeric"
                placeholder="545259519"
              />
            </Field>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedLocalNode || registerDifficultyTarget.trim().length === 0 || flowNodeBusy !== null}
              onClick={() => void handleRegisterFlowNode()}
            >
              <BadgeCheck size={16} />
              {flowNodeBusy === 'register' ? 'Registering' : 'Register node'}
            </button>

            <Field label="Central pubkey">
              <textarea
                rows={3}
                value={centralPubkey}
                onChange={(event) => setCentralPubkey(event.currentTarget.value)}
                spellCheck={false}
                placeholder="33-byte compressed public key hex"
              />
            </Field>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedLocalNode || centralPubkey.trim().length === 0 || flowNodeBusy !== null}
              onClick={() => void handleAuthorizeCentralPubkey()}
            >
              <ShieldCheck size={16} />
              {flowNodeBusy === 'authorize' ? 'Authorizing' : 'Authorize central'}
            </button>

            {flowNodeStatus ? <p className="operation-message">{flowNodeStatus}</p> : null}
            {flowNodeError ? <p className="operation-message error">{flowNodeError}</p> : null}
            {lastFlowNodeRawBytes ? (
              <div className="raw-preview">
                <span>Last raw message</span>
                <code>{lastFlowNodeRawBytes}</code>
              </div>
            ) : null}
          </div>

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

function makeMessageId(): string {
  return crypto.randomUUID()
}

function queryIdForLocalFlowNode(node: LocalFlowNode): string {
  if (node.registration?.status === 'sent' && node.registration.id) {
    return node.registration.id
  }
  return node.id
}

function parseIntegerField(value: string, label: string): number {
  const trimmed = value.trim()
  const radix = /^0x/i.test(trimmed) || /[a-f]/i.test(trimmed) ? 16 : 10
  const digits = trimmed.replace(/^0x/i, '')
  if (digits.length === 0 || !/^[0-9a-f]+$/i.test(digits)) {
    throw new Error(`${label} must be an integer`)
  }
  const parsed = Number.parseInt(digits, radix)
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer`)
  }
  return parsed
}

function consumeChainFilters(mode: QueryMode, nodeId: string, loopStatus: LoopStatus): ConsumeChainQueryFilters {
  const isLoop = loopStatus === 'all' ? undefined : loopStatus === 'looped'
  if (mode === 'start') return { startId: nodeId, isLoop }
  if (mode === 'end') return { endId: nodeId, isLoop }
  return { nodeId, isLoop }
}

function normalizePubkeyHex(value: string): string {
  return toHex(pubkeyToBytes(value.trim()))
}

function nbitsHexToDecimalString(nbitsHex: string): string {
  return String(Number.parseInt(nbitsHex.replace(/^0x/i, ''), 16))
}

function decimalToNbitsHex(value: number): string {
  return toHex(toBytesBigEndian(value, 4))
}

async function buildRegisterMessage(params: {
  uuid: string
  privateKeyHex: string
  publicKeyHex: string
  difficultyHex: string
}): Promise<{ bytes: Uint8Array; rawBytesHex: string; nonce: number }> {
  const noncePrefix = concat(
    toBytesBigEndian(MsgType.FLOW_NODE_REGISTRATION, 2),
    uuidToBytes(params.uuid),
    nBitsToBytes(params.difficultyHex),
  )
  const nonceSuffix = pubkeyToBytes(params.publicKeyHex)
  const target = calculateTargetFromNBits(params.difficultyHex)
  const nonce = await mineNonce(noncePrefix, nonceSuffix, target)
  const payload = buildFlowNodeRegisterPayload({
    uuid: params.uuid,
    registerDifficultyTarget: params.difficultyHex,
    nonce,
    flowNodePubkey: params.publicKeyHex,
  })
  const flowNodeSignature = await signFlowNodeRegisterPayload(payload, params.privateKeyHex)
  const bytes = serializeFlowNodeRegister({
    msgType: MsgType.FLOW_NODE_REGISTRATION,
    uuid: params.uuid,
    registerDifficultyTarget: params.difficultyHex,
    nonce,
    flowNodePubkey: params.publicKeyHex,
    flowNodeSignature,
  })
  return { bytes, rawBytesHex: toHex(bytes), nonce }
}

async function buildEmpowerMessage(params: {
  uuid: string
  privateKeyHex: string
  flowNodePubkeyHex: string
  centralPubkeyHex: string
}): Promise<{ bytes: Uint8Array; rawBytesHex: string }> {
  const payload = buildCentralPubkeyEmpowerPayload({
    uuid: params.uuid,
    flowNodePubkey: params.flowNodePubkeyHex,
    centralPubkey: params.centralPubkeyHex,
  })
  const flowNodeSignature = await signCentralPubkeyEmpowerPayload(payload, params.privateKeyHex)
  const bytes = serializeCentralPubkeyEmpowerSubmitPayload({
    msgType: MsgType.CENTRAL_KEY_AUTH,
    uuid: params.uuid,
    flowNodePubkey: params.flowNodePubkeyHex,
    centralPubkey: params.centralPubkeyHex,
    flowNodeSignature,
  })
  return { bytes, rawBytesHex: toHex(bytes) }
}

function updateLocalFlowNode(
  nodes: LocalFlowNode[],
  id: string,
  patch: Partial<LocalFlowNode>,
): LocalFlowNode[] {
  return nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
}

function shortHex(hex: string): string {
  return `${hex.slice(0, 10).toUpperCase()}...${hex.slice(-6).toUpperCase()}`
}

function maskSecret(hex: string): string {
  return `${hex.slice(0, 6)}...${hex.slice(-6)}`
}

function formatDateTime(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  return new Date(timestamp).toLocaleString()
}

export default App
