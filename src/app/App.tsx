import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'
import { defaultApiBase } from './config'
import { LoopsPanel } from '../components'
import { DashboardWorkspace } from '../features/dashboard-layout/components/DashboardWorkspace'
import {
  dashboardPanelIcons,
  type DashboardPanelConfig,
} from '../features/dashboard-layout/panelRegistry'
import { mergeLocalNodes } from '../lib/chainGraph'
import { useLocalKeyringController } from '../features/keyring/hooks/useLocalKeyringController'
import { useLocalNodeActions } from '../features/keyring/hooks/useLocalNodeActions'
import { useRegistrationController } from '../features/keyring/hooks/useRegistrationController'
import { useVaultActionGate } from '../features/keyring/hooks/useVaultActionGate'
import { VaultPromptDialog } from '../features/keyring/components/VaultPromptDialog'
import { ExportPanelContent } from '../features/network-explorer/components/ExportPanelContent'
import { GraphPanel } from '../features/network-explorer/components/GraphPanel'
import { InspectorPanel } from '../features/network-explorer/components/InspectorPanel'
import { MetricsPanelContent } from '../features/network-explorer/components/MetricsPanelContent'
import { QueryPanel } from '../features/network-explorer/components/QueryPanel'
import { SystemPanelContent } from '../features/network-explorer/components/SystemPanelContent'
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
  const nodeActionsRef = useRef(nodeActions)
  useEffect(() => {
    nodeActionsRef.current = nodeActions
  }, [nodeActions])

  const { closeVaultPrompt, requestVault, vaultPromptOpen, vaultPromptReason } = useVaultActionGate(
    keyring.vault.status,
    { ready: keyring.keyringReady },
  )
  const handleVaultPromptOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeVaultPrompt()
    },
    [closeVaultPrompt],
  )
  const handleOpenVault = useCallback(() => {
    requestVault('打开本地密钥环')
  }, [requestVault])
  const handleAddFlowNode = useCallback(
    (position?: { x: number; y: number }) => {
      requestVault('添加流转节点', () => nodeActionsRef.current.handleAddFlowNode(position))
    },
    [requestVault],
  )
  const handleAddConsumeNode = useCallback(
    (position?: { x: number; y: number }) => {
      requestVault('添加消费节点', () => nodeActionsRef.current.handleAddConsumeNode(position))
    },
    [requestVault],
  )
  const handleImportLocalNode = useCallback(() => {
    requestVault('导入流转节点', () => nodeActionsRef.current.handleImportLocalNode())
  }, [requestVault])
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
  const dashboardPanels = [
    {
      id: 'query',
      label: '\u67e5\u8be2',
      icon: dashboardPanelIcons.query,
      content: (
        <QueryPanel
          apiBase={apiBase}
          currencyFilter={query.currencyFilter}
          error={query.error}
          extended={query.extended}
          loading={query.loading}
          loopStatus={query.loopStatus}
          mode={query.mode}
          nodeId={query.nodeId}
          onAddConsumeNode={handleAddConsumeNode}
          onAddFlowNode={handleAddFlowNode}
          onApiBaseChange={setApiBase}
          onImportLocalNode={handleImportLocalNode}
          onLockVault={keyring.handleLockVault}
          onOpenVault={handleOpenVault}
          onPickNode={networkActions.handlePickNode}
          onRunQuery={query.runQuery}
          onSetCurrencyFilter={query.setCurrencyFilter}
          onSetLoopStatus={query.setLoopStatus}
          onSetMode={query.setMode}
          onSetNodeId={query.setNodeId}
          requestUrl={query.requestUrl}
          vaultStatus={keyring.vault.status}
          warning={query.warning}
        />
      ),
    },
    {
      id: 'details',
      label: '\u8be6\u60c5',
      icon: dashboardPanelIcons.details,
      content: (
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
      ),
    },
    {
      id: 'loops',
      label: '\u5faa\u73af',
      icon: dashboardPanelIcons.loops,
      content: (
        <LoopsPanel
          loops={explorer.loops}
          onSelectLoop={explorer.handleSelectLoop}
          selectedChainId={explorer.selectedChainId}
        />
      ),
    },
    {
      id: 'metrics',
      label: '\u6307\u6807',
      icon: dashboardPanelIcons.metrics,
      content: <MetricsPanelContent graph={query.graph} />,
    },
    {
      id: 'export',
      label: '\u5bfc\u51fa',
      icon: dashboardPanelIcons.export,
      content: (
        <ExportPanelContent
          filteredRowCount={query.filteredRows.length}
          graphEdgeCount={query.graph.edges.length}
          onCopyCurl={networkActions.handleCopyCurl}
          onExportCsv={networkActions.handleExportCsv}
          onExportJson={networkActions.handleExportJson}
        />
      ),
    },
    {
      id: 'system',
      label: '\u7cfb\u7edf',
      icon: dashboardPanelIcons.system,
      content: <SystemPanelContent status={systemStatus.data} />,
    },
  ] satisfies DashboardPanelConfig[]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#network-graph">
        {'\u8df3\u8f6c\u5230\u56fe\u8c31'}
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert">
        {alertMessage}
      </div>

      <VaultPromptDialog
        open={vaultPromptOpen}
        reason={vaultPromptReason}
        status={keyring.vault.status}
        error={keyring.vault.error}
        onOpenChange={handleVaultPromptOpenChange}
        onSetup={(passphrase) => void keyring.vault.setup(passphrase)}
        onUnlock={(passphrase) => void keyring.vault.unlock(passphrase)}
        onLock={keyring.handleLockVault}
      />

      <DashboardWorkspace
        graph={
          <GraphPanel
            canvasGraph={canvasGraph}
            loading={query.loading}
            onAddConsumeNode={handleAddConsumeNode}
            onAddFlowNode={handleAddFlowNode}
            onSelectEdge={selection.onCanvasSelectEdge}
            onSelectNode={selection.onCanvasSelectNode}
            selectedId={selection.selectedLocalId ?? query.effectiveSelection?.id ?? null}
          />
        }
        panels={dashboardPanels}
      />
    </div>
  )
}

export default App
