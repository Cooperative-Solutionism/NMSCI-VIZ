import {
  Activity,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CircleDot,
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
} from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import './App.css'
import {
  DetailRow,
  EdgeInspector,
  ErrorBoundary,
  Field,
  LoopsPanel,
  MetricCard,
  NodeInspector,
  PanelHeader,
} from './components'
import {
  ApiClient,
  generateKeyPair,
  getLastBlock,
  sendCentralPubkeyEmpowerMsg,
  sendFlowNodeRegisterMsg,
} from '@nmsci/sdk'
import { formatVolumeByCurrency, shortId } from './lib/chainGraph'
import { statusLabel } from './lib/consumeChainFilters'
import { useConsumeChainQuery, type CurrencyFilter } from './hooks/useConsumeChainQuery'
import { useNodeDetail } from './hooks/useNodeDetail'
import { useReturningFlowRate } from './hooks/useReturningFlowRate'
import { normalizeNBitsHex } from './lib/difficulty'
import { errorMessage } from './lib/errors'
import { extractLoops } from './lib/loops'
import { formatDateTime, maskSecret, shortHex } from './lib/format'
import {
  buildEmpowerMessage,
  buildRegisterMessage,
  makeMessageId,
  normalizePubkeyHex,
} from './lib/messageBuilders'
import {
  loadLocalFlowNodes,
  patchLocalFlowNode,
  saveLocalFlowNodes,
  type LocalFlowNode,
  type LocalFlowNodeAuthorization,
  type LocalFlowNodeRegistration,
} from './lib/flowNodeStorage'
type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | null

const defaultApiBase = import.meta.env.VITE_API_BASE ?? '/api'
const defaultPageSize = 50
const NetworkGraph = lazy(() =>
  import('./components/NetworkGraph').then((module) => ({ default: module.NetworkGraph })),
)

function App() {
  const [apiBase, setApiBase] = useState(defaultApiBase)
  const {
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
    warning,
  } = useConsumeChainQuery(apiBase, defaultPageSize)
  const {
    nodeDetailError,
    nodeDetailStatus,
    nodeState,
  } = useNodeDetail(apiBase, null)
  const loops = useMemo(() => extractLoops(filteredRows), [filteredRows])
  const selectedChainId = selectedEdge?.chainId ?? null
  const returningFlow = useReturningFlowRate(
    apiBase,
    selectedNode?.id ?? selectedEdge?.target ?? null,
    selectedEdge?.source ?? null,
  )
  const flowRateView = {
    data: returningFlow.data,
    error: returningFlow.error,
    status: returningFlow.status,
  }
  const handleSelectLoop = useCallback((chainId: string) => {
    const edge = graph.edges.find((candidate) => candidate.chainId === chainId)
    if (edge) selectEdge(edge)
  }, [graph.edges, selectEdge])
  const [localFlowNodes, setLocalFlowNodes] = useState<LocalFlowNode[]>(() => loadLocalFlowNodes())
  const [selectedLocalPubkey, setSelectedLocalPubkey] = useState(() => localFlowNodes[0]?.publicKeyHex ?? '')
  const [registerDifficultyTarget, setRegisterDifficultyTarget] = useState('')
  const [centralPubkey, setCentralPubkey] = useState('')
  const [flowNodeBusy, setFlowNodeBusy] = useState<FlowNodeBusyState>(null)
  const [flowNodeStatus, setFlowNodeStatus] = useState<string | null>(null)
  const [flowNodeError, setFlowNodeError] = useState<string | null>(null)
  const [lastFlowNodeRawBytes, setLastFlowNodeRawBytes] = useState('')
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const selectedLocalNode = useMemo(() => {
    return localFlowNodes.find((localNode) => localNode.publicKeyHex === selectedLocalPubkey)
      ?? localFlowNodes[0]
      ?? null
  }, [localFlowNodes, selectedLocalPubkey])
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

  const handleQuerySelectedFlowNode = useCallback(() => {
    if (!selectedLocalNode) return
    setMode('node')
    setNodeId(selectedLocalNode.publicKeyHex)
    setFlowNodeError(null)
    setFlowNodeStatus('Flow node public key filled into query.')
  }, [selectedLocalNode, setMode, setNodeId])

  const handleCopyText = useCallback(async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    setFlowNodeError(null)
    setFlowNodeStatus(`${label} copied.`)
  }, [])

  const handleExportPrivateKey = useCallback(async () => {
    if (!selectedLocalNode) return
    const confirmed = window.confirm('Export private key from localStorage? It is stored in clear text.')
    if (!confirmed) return
    await handleCopyText(selectedLocalNode.privateKeyHex, 'Private key')
  }, [handleCopyText, selectedLocalNode])

  const handleFetchRegisterDifficulty = useCallback(async () => {
    setFlowNodeBusy('difficulty')
    setFlowNodeError(null)

    try {
      const block = (await getLastBlock(client)).data
      if (!block.registerDifficultyTarget) {
        throw new Error('Latest block did not include registerDifficultyTarget')
      }
      setRegisterDifficultyTarget(normalizeNBitsHex(block.registerDifficultyTarget, 'Register difficulty target'))
      if (block.centralPubkey) {
        setCentralPubkey(block.centralPubkey)
      }
      setFlowNodeStatus(`Latest register difficulty loaded from block ${block.height ?? '-'}.`)
    } catch (operationError) {
      setFlowNodeError(errorMessage(operationError, 'Failed to load latest block'))
    } finally {
      setFlowNodeBusy(null)
    }
  }, [client])

  const handleRegisterFlowNode = useCallback(async () => {
    if (!selectedLocalNode) return

    setFlowNodeBusy('register')
    setFlowNodeError(null)

    let difficultyTarget = ''
    let rawBytesHex = ''
    let nonce = 0
    try {
      difficultyTarget = normalizeNBitsHex(registerDifficultyTarget, 'Register difficulty target')
      const messageId = makeMessageId()
      const built = await buildRegisterMessage({
        uuid: messageId,
        privateKeyHex: selectedLocalNode.privateKeyHex,
        publicKeyHex: selectedLocalNode.publicKeyHex,
        difficultyHex: difficultyTarget,
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

      persistLocalFlowNodes((currentNodes) => patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
        registration,
        updatedAt: registration.updatedAt,
      }))
      setLastFlowNodeRawBytes(built.rawBytesHex)
      setFlowNodeStatus(`Registered ${shortId(selectedLocalNode.publicKeyHex)} with nonce ${built.nonce}.`)
    } catch (operationError) {
      const message = errorMessage(operationError, 'Flow node registration failed')
      const failedAt = new Date().toISOString()
      persistLocalFlowNodes((currentNodes) => patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
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
  }, [client, persistLocalFlowNodes, registerDifficultyTarget, selectedLocalNode])

  const handleAuthorizeCentralPubkey = useCallback(async () => {
    if (!selectedLocalNode) return

    setFlowNodeBusy('authorize')
    setFlowNodeError(null)

    try {
      const normalizedCentralPubkey = normalizePubkeyHex(centralPubkey)
      const messageId = makeMessageId()
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

      persistLocalFlowNodes((currentNodes) => patchLocalFlowNode(currentNodes, selectedLocalNode.id, {
        authorizations: [authorization, ...selectedLocalNode.authorizations],
        updatedAt: authorization.updatedAt,
      }))
      setLastFlowNodeRawBytes(built.rawBytesHex)
      setFlowNodeStatus(`Authorized central pubkey ${shortId(normalizedCentralPubkey)}.`)
    } catch (operationError) {
      const message = errorMessage(operationError, 'Central pubkey authorization failed')
      setFlowNodeError(message)
    } finally {
      setFlowNodeBusy(null)
    }
  }, [centralPubkey, client, persistLocalFlowNodes, selectedLocalNode])

  const politeMessage = flowNodeStatus
    ?? (origin === 'backend' ? `Query complete: ${filteredRows.length} visible rows.` : '')
  const alertMessage = error ?? flowNodeError ?? nodeDetailError ?? ''

  return (
    <main className="app-shell">
      <a className="skip-link" href="#network-graph">Skip to graph</a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert">
        {alertMessage}
      </div>
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

          <Field label="Flow node id / pubkey">
            <textarea
              rows={3}
              value={nodeId}
              onChange={(event) => setNodeId(event.currentTarget.value)}
              spellCheck={false}
            />
          </Field>
          <p className="field-hint">UUID or 66-hex public key (auto-detected)</p>

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
              <span className="field-hint">Current page view filter</span>
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
              aria-describedby={nodeId.trim().length === 0 ? 'load-disabled-reason' : undefined}
              onClick={() => void runQuery(0)}
            >
              <Search size={16} />
              {loading ? 'Loading' : 'Load'}
            </button>
            {nodeId.trim().length === 0 ? (
              <span id="load-disabled-reason" className="sr-only">
                Enter a flow node UUID to load chain data.
              </span>
            ) : null}
          </div>

          <div className="request-preview">
            <span>Request</span>
            <code>{requestUrl}</code>
          </div>

          {error ? <p className="error-banner">{error}. Current graph was kept unchanged.</p> : null}
          {warning ? <p className="info-banner">{warning}</p> : null}
          {extended ? <p className="info-banner">Extended graph view; reload the query to resume pagination.</p> : null}

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
                <DetailRow
                  label="Pubkey"
                  value={(
                    <span className="copyable-value">
                      <code>{selectedLocalNode.publicKeyHex}</code>
                      <button type="button" onClick={() => void handleCopyText(selectedLocalNode.publicKeyHex, 'Pubkey')}>
                        Copy
                      </button>
                    </span>
                  )}
                />
                <DetailRow
                  label="Register id"
                  value={selectedLocalNode.registration?.id ? (
                    <span className="copyable-value">
                      <code>{selectedLocalNode.registration.id}</code>
                      <button type="button" onClick={() => void handleCopyText(selectedLocalNode.registration?.id ?? '', 'Register id')}>
                        Copy
                      </button>
                    </span>
                  ) : '—'}
                />
                <DetailRow label="Secret" value={<code>{maskSecret(selectedLocalNode.privateKeyHex)}</code>} />
                <DetailRow label="Saved" value={formatDateTime(selectedLocalNode.createdAt)} />
                <DetailRow label="Register" value={selectedLocalNode.registration?.status ?? '-'} />
                <DetailRow label="Auth count" value={selectedLocalNode.authorizations.length} />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={handleQuerySelectedFlowNode}
                >
                  <Search size={15} />
                  Query this node
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void handleExportPrivateKey()}
                >
                  Export private key
                </button>
              </div>
            ) : null}

            <Field label="Register difficulty target">
              <input
                value={registerDifficultyTarget}
                onChange={(event) => setRegisterDifficultyTarget(event.currentTarget.value)}
                inputMode="text"
                placeholder="1d00ffff"
              />
            </Field>
            <button
              className="primary-button"
              type="button"
              disabled={!selectedLocalNode || registerDifficultyTarget.trim().length === 0 || flowNodeBusy !== null}
              aria-describedby={!selectedLocalNode || registerDifficultyTarget.trim().length === 0 ? 'register-disabled-reason' : undefined}
              onClick={() => void handleRegisterFlowNode()}
            >
              <BadgeCheck size={16} />
              {flowNodeBusy === 'register' ? 'Registering' : 'Register node'}
            </button>
            {!selectedLocalNode || registerDifficultyTarget.trim().length === 0 ? (
              <span id="register-disabled-reason" className="sr-only">
                Select a local flow node and enter an nBits hex difficulty.
              </span>
            ) : null}

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
              aria-describedby={!selectedLocalNode || centralPubkey.trim().length === 0 ? 'authorize-disabled-reason' : undefined}
              onClick={() => void handleAuthorizeCentralPubkey()}
            >
              <ShieldCheck size={16} />
              {flowNodeBusy === 'authorize' ? 'Authorizing' : 'Authorize central'}
            </button>
            {!selectedLocalNode || centralPubkey.trim().length === 0 ? (
              <span id="authorize-disabled-reason" className="sr-only">
                Select a local flow node and enter a central compressed public key.
              </span>
            ) : null}

            {flowNodeStatus ? <p className="operation-message">{flowNodeStatus}</p> : null}
            {flowNodeError ? <p className="operation-message error">{flowNodeError}</p> : null}
            {lastFlowNodeRawBytes ? (
              <div className="raw-preview">
                <span>Last raw message</span>
                <code>{lastFlowNodeRawBytes}</code>
              </div>
            ) : null}
          </div>

        </aside>

        <section id="network-graph" className="graph-panel" aria-label="Network visualization" aria-busy={loading}>
          <div className="metrics-strip">
            <MetricCard label="Total chains" value={graph.stats.totalChains.toString()} icon={<GitBranch size={17} />} />
            <MetricCard label="Looped" value={graph.stats.loopedChains.toString()} tone="looped" icon={<Activity size={17} />} />
            <MetricCard label="Open" value={graph.stats.openChains.toString()} tone="open" icon={<Network size={17} />} />
            <MetricCard
              label="Volume"
              value={formatVolumeByCurrency(graph.stats.volumeByCurrency)}
              icon={<Database size={17} />}
            />
          </div>

          <ErrorBoundary label="Network graph failed">
            <Suspense fallback={<div className="graph-loading">Loading graph...</div>}>
              <NetworkGraph
                graph={graph}
                selectedId={effectiveSelection?.id ?? null}
                onSelectNode={selectNode}
                onSelectEdge={selectEdge}
              />
            </Suspense>
          </ErrorBoundary>
        </section>

        <aside className="inspector-panel" aria-label="Selection inspector">
          <LoopsPanel loops={loops} onSelectLoop={handleSelectLoop} selectedChainId={selectedChainId} />

          <div className="inspector-heading">
            <h2>
              {effectiveSelection?.kind === 'node'
                ? 'Selected node'
                : effectiveSelection?.kind === 'edge'
                  ? 'Selected edge'
                  : 'Selection'}
            </h2>
          </div>

          {selectedEdge ? (
            <EdgeInspector edge={selectedEdge} chain={selectedChain} flowRate={flowRateView} />
          ) : selectedNode ? (
            <NodeInspector
              detailError={nodeDetailError}
              detailStatus={nodeDetailStatus}
              disabled={loading}
              extendLoading={extendLoading}
              flowRate={flowRateView}
              node={selectedNode}
              onExtendEnd={() => void extendFromNode(selectedNode, 'end')}
              onExtendNode={() => void extendFromNode(selectedNode, 'node')}
              onExtendStart={() => void extendFromNode(selectedNode, 'start')}
              state={nodeState}
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
            page {slice.page} / size {slice.size} / {filteredRows.length} visible row
            {filteredRows.length === 1 ? '' : 's'} / {rows.length} backend row
            {rows.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="pagination">
          <button type="button" disabled={loading || extended || !slice.hasPrevious} onClick={handlePreviousPage} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <span>{loading ? 'Loading page' : origin === 'backend' ? 'Live slice' : 'No slice'}</span>
          <button type="button" disabled={loading || extended || origin !== 'backend' || !slice.hasNext} onClick={handleNextPage} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </main>
  )
}

export default App
