import { useMemo, useState } from 'react'
import '../App.css'
import { defaultApiBase } from './config'
import { LoopsPanel } from '../components'
import { mergeLocalNodes } from '../lib/chainGraph'
import { useLocalKeyringController } from '../features/keyring/hooks/useLocalKeyringController'
import { useLocalNodeActions } from '../features/keyring/hooks/useLocalNodeActions'
import { useRegistrationController } from '../features/keyring/hooks/useRegistrationController'
import { ExportPanelContent } from '../features/network-explorer/components/ExportPanelContent'
import { GraphPanel } from '../features/network-explorer/components/GraphPanel'
import { InspectorPanel } from '../features/network-explorer/components/InspectorPanel'
import { MetricsPanelContent } from '../features/network-explorer/components/MetricsPanelContent'
import { QueryPanel } from '../features/network-explorer/components/QueryPanel'
import { TopBar } from '../features/network-explorer/components/TopBar'
import { useNetworkExplorerActions } from '../features/network-explorer/hooks/useNetworkExplorerActions'
import { useNetworkExplorerController } from '../features/network-explorer/hooks/useNetworkExplorerController'

function App() {
  const [apiBase, setApiBase] = useState(defaultApiBase)
  const explorer = useNetworkExplorerController(apiBase)
  const { flowRateView, nodeDetail, query, selection, systemStatus } = explorer
  const keyring = useLocalKeyringController({
    clearSelectedLocalNode: selection.clearSelectedLocalNode,
  })
  const selectedLocalNode = useMemo(
    () =>
      keyring.localFlowNodes.find(
        (localNode) => localNode.publicKeyHex === selection.selectedLocalId,
      ) ?? null,
    [keyring.localFlowNodes, selection.selectedLocalId],
  )
  const selectedLocalConsumeNode = useMemo(
    () =>
      keyring.localConsumeNodes.find(
        (localNode) => localNode.publicKeyHex === selection.selectedLocalId,
      ) ?? null,
    [keyring.localConsumeNodes, selection.selectedLocalId],
  )
  const { localNodeState, registration } = useRegistrationController({
    apiBase,
    selectedLocalNode,
    localFlowNodes: keyring.localFlowNodes,
    localConsumeNodes: keyring.localConsumeNodes,
    localTxRecords: keyring.localTxRecords,
    persistLocalFlowNodes: keyring.persistLocalFlowNodes,
    persistTxRecords: keyring.persistTxRecords,
    runQuery: query.runQuery,
    clearSelectedLocalNode: selection.clearSelectedLocalNode,
  })
  const nodeActions = useLocalNodeActions({
    clearLastRawBytes: registration.clearLastRawBytes,
    clearSelectedLocalNode: selection.clearSelectedLocalNode,
    notifyError: registration.notifyError,
    notifyStatus: registration.notifyStatus,
    persistLocalConsumeNodes: keyring.persistLocalConsumeNodes,
    persistLocalFlowNodes: keyring.persistLocalFlowNodes,
    selectLocalNode: selection.selectLocalNode,
    selectedLocalConsumeNode,
    selectedLocalNode,
    setMode: query.setMode,
    setNodeId: query.setNodeId,
    vaultStatus: keyring.vault.status,
  })
  const networkActions = useNetworkExplorerActions({
    filteredRows: query.filteredRows,
    graphEdges: query.graph.edges,
    notifyError: registration.notifyError,
    notifyStatus: registration.notifyStatus,
    requestUrl: query.requestUrl,
    setMode: query.setMode,
    setNodeId: query.setNodeId,
  })
  const canvasGraph = useMemo(
    () => mergeLocalNodes(query.graph, keyring.localFlowNodes, keyring.localConsumeNodes),
    [keyring.localConsumeNodes, keyring.localFlowNodes, query.graph],
  )
  const centralLocked = systemStatus.data?.currentCentralPubkeyLocked ?? false
  const politeMessage =
    registration.status ??
    (query.origin === 'backend' ? `查询完成：当前可见 ${query.filteredRows.length} 行。` : '')
  const alertMessage = query.error ?? registration.error ?? nodeDetail.nodeDetailError ?? ''

  return (
    <main className="app-shell">
      <a className="skip-link" href="#network-graph">
        跳转到图谱
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert">
        {alertMessage}
      </div>

      <TopBar
        edgeCount={canvasGraph.edges.length}
        nodeCount={canvasGraph.nodes.length}
        origin={query.origin}
        systemStatus={systemStatus.data}
      />

      <section className="workspace">
        <div className="query-panel">
          <QueryPanel
            apiBase={apiBase}
            currencyFilter={query.currencyFilter}
            error={query.error}
            extended={query.extended}
            loading={query.loading}
            loopStatus={query.loopStatus}
            mode={query.mode}
            nodeId={query.nodeId}
            onAddConsumeNode={nodeActions.handleAddConsumeNode}
            onAddFlowNode={nodeActions.handleAddFlowNode}
            onApiBaseChange={setApiBase}
            onImportLocalNode={nodeActions.handleImportLocalNode}
            onLockVault={keyring.handleLockVault}
            onPickNode={networkActions.handlePickNode}
            onRunQuery={query.runQuery}
            onSetCurrencyFilter={query.setCurrencyFilter}
            onSetLoopStatus={query.setLoopStatus}
            onSetMode={query.setMode}
            onSetNodeId={query.setNodeId}
            onSetupVault={(passphrase) => void keyring.vault.setup(passphrase)}
            onUnlockVault={(passphrase) => void keyring.vault.unlock(passphrase)}
            registrationError={registration.error}
            requestUrl={query.requestUrl}
            showKeyringError={!selectedLocalNode && !selectedLocalConsumeNode}
            vaultError={keyring.vault.error}
            vaultStatus={keyring.vault.status}
            warning={query.warning}
          />
        </div>

        <GraphPanel
          canvasGraph={canvasGraph}
          loading={query.loading}
          onAddConsumeNode={nodeActions.handleAddConsumeNode}
          onAddFlowNode={nodeActions.handleAddFlowNode}
          onSelectEdge={selection.onCanvasSelectEdge}
          onSelectNode={selection.onCanvasSelectNode}
          selectedId={selection.selectedLocalId ?? query.effectiveSelection?.id ?? null}
        />

        <aside className="inspector-panel">
          <ExportPanelContent
            filteredRowCount={query.filteredRows.length}
            graphEdgeCount={query.graph.edges.length}
            onCopyCurl={networkActions.handleCopyCurl}
            onExportCsv={networkActions.handleExportCsv}
            onExportJson={networkActions.handleExportJson}
          />
          <MetricsPanelContent graph={query.graph} />
          <LoopsPanel
            loops={explorer.loops}
            onSelectLoop={explorer.handleSelectLoop}
            selectedChainId={explorer.selectedChainId}
          />
          <InspectorPanel
            apiBase={apiBase}
            centralLocked={centralLocked}
            effectiveSelection={query.effectiveSelection}
            extendFromNode={query.extendFromNode}
            extendLoading={query.extendLoading}
            flowRateView={flowRateView}
            inspectorEmptyMessage={explorer.inspectorEmptyMessage}
            loading={query.loading}
            localConsumeNodes={keyring.localConsumeNodes}
            localNodeState={localNodeState}
            localTxRecords={keyring.localTxRecords}
            nodeActions={nodeActions}
            nodeDetail={nodeDetail}
            registration={registration}
            selectedChain={query.selectedChain}
            selectedEdge={query.selectedEdge}
            selectedLocalConsumeNode={selectedLocalConsumeNode}
            selectedLocalNode={selectedLocalNode}
            selectedNode={query.selectedNode}
          />
        </aside>
      </section>
    </main>
  )
}

export default App
