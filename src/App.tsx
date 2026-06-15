import {
  Activity,
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
  Search,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import './App.css'
import {
  ConsumeNodeOperatePanel,
  EdgeInspector,
  ErrorBoundary,
  Field,
  FlowNodeOperatePanel,
  LoopsPanel,
  MetricCard,
  NodeBrowser,
  NodeInspector,
  PanelHeader,
  SystemStatusStrip,
  TransactionMountForm,
  TransactionRecordForm,
} from './components'
import {
  ApiClient,
  generateKeyPair,
  getPublicKeyFromPrivate,
} from '@nmsci/sdk'
import { formatAmount, formatVolumeByCurrency, mergeLocalNodes, shortId } from './lib/chainGraph'
import { statusLabel } from './lib/consumeChainFilters'
import { useConsumeChainQuery, type CurrencyFilter } from './hooks/useConsumeChainQuery'
import { useFlowNodeRegistration } from './hooks/useFlowNodeRegistration'
import { useNodeDetail } from './hooks/useNodeDetail'
import { useReturningFlowRate } from './hooks/useReturningFlowRate'
import { useSystemStatus } from './hooks/useSystemStatus'
import { errorMessage } from './lib/errors'
import { edgesToCsv, rowsToJson, toCurl } from './lib/exporters'
import { extractLoops } from './lib/loops'
import {
  makeMessageId,
} from './lib/messageBuilders'
import {
  loadLocalTxRecords,
  saveLocalTxRecords,
  type LocalTxRecord,
} from './lib/txRecordStorage'
import {
  loadLocalFlowNodes,
  patchLocalFlowNode,
  saveLocalFlowNodes,
  type LocalFlowNode,
} from './lib/flowNodeStorage'
import {
  loadLocalConsumeNodes,
  patchLocalConsumeNode,
  saveLocalConsumeNodes,
  type LocalConsumeNode,
} from './lib/consumeNodeStorage'
import type { ChainGraphEdge, ChainGraphNode } from './lib/types'

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
  const systemStatus = useSystemStatus(apiBase)
  const centralLocked = systemStatus.data?.currentCentralPubkeyLocked ?? false
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
  const inspectorEmptyMessage =
    origin === 'idle'
      ? 'Run a query to explore the consumption network.'
      : filteredRows.length === 0 && rows.length > 0
        ? `${rows.length} row${rows.length === 1 ? '' : 's'} hidden by the current-page filter.`
        : 'No chains matched. Try loop status: All or another mode.'
  const [localFlowNodes, setLocalFlowNodes] = useState<LocalFlowNode[]>(() => loadLocalFlowNodes())
  const [localConsumeNodes, setLocalConsumeNodes] = useState<LocalConsumeNode[]>(() => loadLocalConsumeNodes())
  const [localTxRecords, setLocalTxRecords] = useState<LocalTxRecord[]>(() => loadLocalTxRecords())
  const canvasGraph = useMemo(
    () => mergeLocalNodes(graph, localFlowNodes, localConsumeNodes),
    [graph, localFlowNodes, localConsumeNodes],
  )
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const selectedLocalNode = useMemo(
    () => localFlowNodes.find((localNode) => localNode.publicKeyHex === selectedLocalId) ?? null,
    [localFlowNodes, selectedLocalId],
  )
  const selectedLocalConsumeNode = useMemo(
    () => localConsumeNodes.find((localNode) => localNode.publicKeyHex === selectedLocalId) ?? null,
    [localConsumeNodes, selectedLocalId],
  )
  const { nodeState: localNodeState, loadNodeState: reloadLocalNodeState } = useNodeDetail(
    apiBase,
    selectedLocalNode?.publicKeyHex ?? null,
  )
  const persistLocalFlowNodes = useCallback((updater: (currentNodes: LocalFlowNode[]) => LocalFlowNode[]) => {
    setLocalFlowNodes((currentNodes) => {
      const nextNodes = updater(currentNodes)
      saveLocalFlowNodes(nextNodes)
      return nextNodes
    })
  }, [])

  const persistLocalConsumeNodes = useCallback(
    (updater: (currentNodes: LocalConsumeNode[]) => LocalConsumeNode[]) => {
      setLocalConsumeNodes((currentNodes) => {
        const nextNodes = updater(currentNodes)
        saveLocalConsumeNodes(nextNodes)
        return nextNodes
      })
    },
    [],
  )

  const persistTxRecords = useCallback(
    (updater: (currentRecords: LocalTxRecord[]) => LocalTxRecord[]) => {
      setLocalTxRecords((currentRecords) => {
        const nextRecords = updater(currentRecords)
        saveLocalTxRecords(nextRecords)
        return nextRecords
      })
    },
    [],
  )

  const clearSelectedLocalNode = useCallback(() => {
    setSelectedLocalId(null)
  }, [])

  const reloadRegistrationNodeState = useCallback((pubkey: string) => {
    void reloadLocalNodeState(pubkey)
  }, [reloadLocalNodeState])

  const registration = useFlowNodeRegistration({
    client,
    selectedLocalNode,
    localFlowNodes,
    localConsumeNodes,
    localTxRecords,
    persistLocalFlowNodes,
    persistTxRecords,
    reloadLocalNodeState: reloadRegistrationNodeState,
    runQuery,
    clearSelectedLocalNode,
  })

  const handleExportCsv = useCallback(() => {
    downloadText('consume-chain-edges.csv', 'text/csv;charset=utf-8', edgesToCsv(graph.edges))
  }, [graph.edges])
  const handleExportJson = useCallback(() => {
    downloadText('consume-chains.json', 'application/json', rowsToJson(filteredRows))
  }, [filteredRows])
  const handleCopyCurl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toCurl(requestUrl))
      registration.notifyStatus('Request curl copied.')
    } catch (clipboardError) {
      registration.notifyError(errorMessage(clipboardError, 'Clipboard unavailable'))
    }
  }, [registration, requestUrl])
  const handlePickNode = useCallback((pubkey: string) => {
    setMode('node')
    setNodeId(pubkey)
    registration.notifyStatus('Picked node public key filled into query — click Load.')
  }, [registration, setMode, setNodeId])
  const handlePreviousPage = useCallback(() => {
    const nextPage = Math.max(0, page - 1)
    void runQuery(nextPage)
  }, [page, runQuery])

  const handleNextPage = useCallback(() => {
    void runQuery(page + 1)
  }, [page, runQuery])

  const handleAddFlowNode = useCallback((position?: { x: number; y: number }) => {
    const keypair = generateKeyPair()
    const now = new Date().toISOString()
    const node: LocalFlowNode = {
      id: makeMessageId(),
      label: shortId(keypair.publicKey),
      privateKeyHex: keypair.privateKey,
      publicKeyHex: keypair.publicKey,
      createdAt: now,
      updatedAt: now,
      position,
      authorizations: [],
    }
    persistLocalFlowNodes((currentNodes) => [node, ...currentNodes])
    setSelectedLocalId(node.publicKeyHex)
    registration.notifyStatus('Flow node added.')
    registration.clearLastRawBytes()
  }, [persistLocalFlowNodes, registration])

  const handleAddConsumeNode = useCallback((position?: { x: number; y: number }) => {
    const keypair = generateKeyPair()
    const now = new Date().toISOString()
    const node: LocalConsumeNode = {
      id: makeMessageId(),
      label: shortId(keypair.publicKey),
      privateKeyHex: keypair.privateKey,
      publicKeyHex: keypair.publicKey,
      createdAt: now,
      updatedAt: now,
      position,
    }
    persistLocalConsumeNodes((currentNodes) => [node, ...currentNodes])
    setSelectedLocalId(node.publicKeyHex)
    registration.notifyStatus('Consume node added.')
  }, [persistLocalConsumeNodes, registration])

  // 画布选择：点本地节点 → 进入对应操作面板；点链节点/边 → 清掉本地选择，走链检查器。
  const handleCanvasSelectNode = useCallback((node: ChainGraphNode) => {
    if (node.kind === 'local-flow' || node.kind === 'local-consume') {
      setSelectedLocalId(node.id)
      return
    }
    setSelectedLocalId(null)
    selectNode(node)
  }, [selectNode])

  const handleCanvasSelectEdge = useCallback((edge: ChainGraphEdge) => {
    setSelectedLocalId(null)
    selectEdge(edge)
  }, [selectEdge])

  const handleImportLocalNode = useCallback(() => {
    const privateKeyHex = window.prompt('Paste a private key (hex)')?.trim()
    if (!privateKeyHex) return
    try {
      const publicKeyHex = getPublicKeyFromPrivate(privateKeyHex)
      const now = new Date().toISOString()
      const node: LocalFlowNode = {
        id: makeMessageId(),
        label: shortId(publicKeyHex),
        privateKeyHex,
        publicKeyHex,
        createdAt: now,
        updatedAt: now,
        authorizations: [],
      }
      persistLocalFlowNodes((currentNodes) => [
        node,
        ...currentNodes.filter((current) => current.publicKeyHex !== publicKeyHex),
      ])
      setSelectedLocalId(publicKeyHex)
      registration.notifyStatus('Flow node imported.')
    } catch (importError) {
      registration.notifyError(errorMessage(importError, 'Invalid private key'))
    }
  }, [persistLocalFlowNodes, registration])

  const handleRenameLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    const next = window.prompt('Rename flow node', selectedLocalNode.label)
    if (next == null) return
    const label = (next.trim() || selectedLocalNode.label).slice(0, 64)
    persistLocalFlowNodes((currentNodes) =>
      patchLocalFlowNode(currentNodes, selectedLocalNode.id, { label, updatedAt: new Date().toISOString() }),
    )
    registration.notifyStatus('Flow node renamed.')
  }, [persistLocalFlowNodes, registration, selectedLocalNode])

  const handleDeleteLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    if (!window.confirm('Delete this local flow node? Its private key will be lost.')) return
    const removedPubkey = selectedLocalNode.publicKeyHex
    persistLocalFlowNodes((currentNodes) => currentNodes.filter((current) => current.publicKeyHex !== removedPubkey))
    setSelectedLocalId(null)
    registration.notifyStatus('Flow node deleted.')
  }, [persistLocalFlowNodes, registration, selectedLocalNode])

  const handleRenameConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    const next = window.prompt('Rename consume node', selectedLocalConsumeNode.label)
    if (next == null) return
    const label = (next.trim() || selectedLocalConsumeNode.label).slice(0, 64)
    persistLocalConsumeNodes((currentNodes) =>
      patchLocalConsumeNode(currentNodes, selectedLocalConsumeNode.id, { label, updatedAt: new Date().toISOString() }),
    )
    registration.notifyStatus('Consume node renamed.')
  }, [persistLocalConsumeNodes, registration, selectedLocalConsumeNode])

  const handleDeleteConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('Delete this consume node? Its private key will be lost.')) return
    const removedPubkey = selectedLocalConsumeNode.publicKeyHex
    persistLocalConsumeNodes((currentNodes) => currentNodes.filter((current) => current.publicKeyHex !== removedPubkey))
    setSelectedLocalId(null)
    registration.notifyStatus('Consume node deleted.')
  }, [persistLocalConsumeNodes, registration, selectedLocalConsumeNode])

  const handleQuerySelectedFlowNode = useCallback(() => {
    if (!selectedLocalNode) return
    setMode('node')
    setNodeId(selectedLocalNode.publicKeyHex)
    registration.notifyStatus('Flow node public key filled into query.')
  }, [registration, selectedLocalNode, setMode, setNodeId])

  const handleCopyText = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      registration.notifyStatus(`${label} copied.`)
    } catch (clipboardError) {
      registration.notifyError(errorMessage(clipboardError, 'Clipboard unavailable'))
    }
  }, [registration])

  const handleExportPrivateKey = useCallback(async () => {
    if (!selectedLocalNode) return
    const confirmed = window.confirm('Export private key from localStorage? It is stored in clear text.')
    if (!confirmed) return
    await handleCopyText(selectedLocalNode.privateKeyHex, 'Private key')
  }, [handleCopyText, selectedLocalNode])

  const handleExportConsumeKey = useCallback(async () => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('Export private key from localStorage? It is stored in clear text.')) return
    await handleCopyText(selectedLocalConsumeNode.privateKeyHex, 'Private key')
  }, [handleCopyText, selectedLocalConsumeNode])

  const politeMessage = registration.status
    ?? (origin === 'backend' ? `Query complete: ${filteredRows.length} visible rows.` : '')
  const alertMessage = error ?? registration.error ?? nodeDetailError ?? ''

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
          <span>{canvasGraph.nodes.length} nodes</span>
          <span>{canvasGraph.edges.length} edges</span>
        </div>
        <SystemStatusStrip status={systemStatus.data} />
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

          <NodeBrowser apiBase={apiBase} onPick={handlePickNode} />

          {error ? <p className="error-banner">{error}. Current graph was kept unchanged.</p> : null}
          {warning ? <p className="info-banner">{warning}</p> : null}
          {extended ? <p className="info-banner">Extended graph view; reload the query to resume pagination.</p> : null}

          <div className="flow-node-block">
            <PanelHeader icon={<KeyRound size={16} />} title="Keys" />
            <div className="action-row two">
              <button className="secondary-button" type="button" onClick={() => handleAddFlowNode()}>
                <Plus size={15} />
                Flow node
              </button>
              <button className="secondary-button" type="button" onClick={() => handleAddConsumeNode()}>
                <Plus size={15} />
                Consume node
              </button>
            </div>
            <div className="action-row">
              <button className="secondary-button" type="button" onClick={handleImportLocalNode}>
                <Plus size={15} />
                Import flow node
              </button>
            </div>
            <p className="field-hint">
              Right-click the canvas to add a node, then click a node to register, authorize, or build
              transactions on it.
            </p>
            {registration.error && !selectedLocalNode && !selectedLocalConsumeNode ? (
              <p className="operation-message error">{registration.error}</p>
            ) : null}
          </div>

        </aside>

        <section id="network-graph" className="graph-panel" aria-label="Network visualization" aria-busy={loading}>
          <div className="graph-header">
          <div className="export-bar" role="group" aria-label="Export">
            <button className="ghost-button" type="button" disabled={graph.edges.length === 0} onClick={handleExportCsv}>
              CSV
            </button>
            <button className="ghost-button" type="button" disabled={filteredRows.length === 0} onClick={handleExportJson}>
              JSON
            </button>
            <button className="ghost-button" type="button" onClick={() => void handleCopyCurl()}>
              Copy curl
            </button>
          </div>
          {origin === 'idle' ? (
            <div className="graph-welcome">
              <h2>Explore the consumption network</h2>
              <p>
                Enter a flow node UUID or 66-hex public key, choose a mode (Start / End / Node), and
                Load. Looped chains are circular trades — open the Loops panel to rank them.
              </p>
            </div>
          ) : null}
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
          </div>

          <ErrorBoundary label="Network graph failed">
            <Suspense fallback={<div className="graph-loading">Loading graph...</div>}>
              <NetworkGraph
                graph={canvasGraph}
                selectedId={selectedLocalId ?? effectiveSelection?.id ?? null}
                onSelectNode={handleCanvasSelectNode}
                onSelectEdge={handleCanvasSelectEdge}
                onAddFlowNode={handleAddFlowNode}
                onAddConsumeNode={handleAddConsumeNode}
              />
            </Suspense>
          </ErrorBoundary>
        </section>

        <aside className="inspector-panel" aria-label="Selection inspector">
          <LoopsPanel loops={loops} onSelectLoop={handleSelectLoop} selectedChainId={selectedChainId} />

          <div className="inspector-heading">
            <h2>
              {selectedLocalNode
                ? 'Flow node'
                : selectedLocalConsumeNode
                  ? 'Consume node'
                  : effectiveSelection?.kind === 'node'
                    ? 'Selected node'
                    : effectiveSelection?.kind === 'edge'
                      ? 'Selected edge'
                      : 'Selection'}
            </h2>
          </div>

          <ErrorBoundary label="Inspector panel failed">
          {selectedLocalNode ? (
            <>
              <FlowNodeOperatePanel
                busy={registration.busy}
                centralLocked={centralLocked}
                centralPubkey={registration.centralPubkey}
                error={registration.error}
                lastRawBytes={registration.lastRawBytes}
                miningAttempts={registration.miningAttempts}
                node={selectedLocalNode}
                nodeState={localNodeState}
                onAuthorize={() => void registration.authorizeCentralPubkey()}
                onCentralPubkeyChange={registration.setCentralPubkey}
                onCopy={(value, label) => void handleCopyText(value, label)}
                onCreateMount={registration.toggleMountForm}
                onCreateRecord={registration.toggleRecordForm}
                onDelete={handleDeleteLocalNode}
                onDifficultyChange={registration.setRegisterDifficultyTarget}
                onExportPrivateKey={() => void handleExportPrivateKey()}
                onFetchDifficulty={() => void registration.fetchRegisterDifficulty()}
                onQuery={handleQuerySelectedFlowNode}
                onRegister={() => void registration.registerFlowNode()}
                onRename={handleRenameLocalNode}
                registerDifficultyTarget={registration.registerDifficultyTarget}
                status={registration.status}
              />
              {registration.recordFormOpen ? (
                <TransactionRecordForm
                  busy={registration.busy === 'record'}
                  consumeNodes={localConsumeNodes}
                  defaultCentralPubkey={registration.centralPubkey}
                  defaultDifficulty={registration.txDifficulty}
                  error={registration.error}
                  miningAttempts={registration.miningAttempts}
                  onCreate={(draft) => void registration.createTransactionRecord(draft)}
                  status={registration.status}
                />
              ) : null}
              {registration.recordFormOpen && localTxRecords.length > 0 ? (
                <div className="record-list">
                  <div className="section-title">Created records</div>
                  {localTxRecords.map((record) => (
                    <div key={record.id} className="detail-row">
                      <span>{shortId(record.id)}</span>
                      <strong>{formatAmount(BigInt(record.amount), record.currencyType)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
              {registration.mountFormOpen ? (
                <TransactionMountForm
                  busy={registration.busy === 'mount'}
                  canViewChain={registration.mountedPubkey !== null}
                  defaultDifficulty={registration.txDifficulty}
                  error={registration.error}
                  miningAttempts={registration.miningAttempts}
                  onMount={(recordId, difficultyHex) => void registration.createTransactionMount(recordId, difficultyHex)}
                  onViewChain={registration.viewConsumeChain}
                  records={localTxRecords}
                  status={registration.status}
                />
              ) : null}
            </>
          ) : selectedLocalConsumeNode ? (
            <ConsumeNodeOperatePanel
              error={registration.error}
              node={selectedLocalConsumeNode}
              onCopy={(value, label) => void handleCopyText(value, label)}
              onDelete={handleDeleteConsumeNode}
              onExportPrivateKey={() => void handleExportConsumeKey()}
              onRename={handleRenameConsumeNode}
              status={registration.status}
            />
          ) : selectedEdge ? (
            <EdgeInspector apiBase={apiBase} edge={selectedEdge} chain={selectedChain} flowRate={flowRateView} />
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
            <div className="empty-state">{inspectorEmptyMessage}</div>
          )}
          </ErrorBoundary>
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

function downloadText(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default App
