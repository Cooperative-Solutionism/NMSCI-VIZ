import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '../App.css'
import { defaultApiBase } from './config'
import { LoopsPanel, OperationStatusToast } from '../components'
import { DashboardWorkspace } from '../features/dashboard-layout/components/DashboardWorkspace'
import {
  dashboardPanelIcons,
  type DashboardPanelConfig,
} from '../features/dashboard-layout/panelRegistry'
import { mergeLocalNodes } from '../lib/chainGraph'
import type { ChainGraphNode, QueryMode } from '../lib/types'
import { useLocalKeyringController } from '../features/keyring/hooks/useLocalKeyringController'
import { useLocalNodeActions } from '../features/keyring/hooks/useLocalNodeActions'
import { useRegistrationController } from '../features/keyring/hooks/useRegistrationController'
import { useUserPromptDialogs } from '../features/keyring/hooks/useUserPromptDialogs'
import { useVaultActionGate } from '../features/keyring/hooks/useVaultActionGate'
import { LocalNodePanel } from '../features/keyring/components/LocalNodePanel'
import { VaultPromptDialog } from '../features/keyring/components/VaultPromptDialog'
import { BrowsePanel } from '../features/network-explorer/components/BrowsePanel'
import { ExportPanelContent } from '../features/network-explorer/components/ExportPanelContent'
import { GraphPanel } from '../features/network-explorer/components/GraphPanel'
import { InspectorPanel } from '../features/network-explorer/components/InspectorPanel'
import { MetricsPanelContent } from '../features/network-explorer/components/MetricsPanelContent'
import { SystemPanelContent } from '../features/network-explorer/components/SystemPanelContent'
import { TransactionRecordDialog } from '../features/network-explorer/components/TransactionRecordDialog'
import { TransactionMountDialog } from '../features/network-explorer/components/TransactionMountDialog'
import { useNetworkExplorerActions } from '../features/network-explorer/hooks/useNetworkExplorerActions'
import { useNetworkExplorerController } from '../features/network-explorer/hooks/useNetworkExplorerController'

function App() {
  const apiBase = defaultApiBase
  const explorer = useNetworkExplorerController(apiBase)
  const { flowRateView, nodeDetail, query, selection, systemStatus } = explorer
  const { extendFromNode, refreshFromNodeIds } = query
  const keyring = useLocalKeyringController({
    clearSelectedLocalNode: selection.clearSelectedLocalNode,
  })
  const {
    dialogs: userPromptDialogs,
    requestConfirm,
    requestText,
  } = useUserPromptDialogs()
  // 哪些本地节点已被绘制到画布（按公钥）。默认空：本地节点不再自动铺到画布。
  const [canvasNodeIds, setCanvasNodeIds] = useState<ReadonlySet<string>>(() => new Set())
  const markNodeOnCanvas = useCallback((publicKeyHex: string) => {
    setCanvasNodeIds((current) => {
      if (current.has(publicKeyHex)) return current
      const next = new Set(current)
      next.add(publicKeyHex)
      return next
    })
  }, [])
  const toggleCanvasNode = useCallback((publicKeyHex: string) => {
    setCanvasNodeIds((current) => {
      const next = new Set(current)
      if (next.has(publicKeyHex)) next.delete(publicKeyHex)
      else next.add(publicKeyHex)
      return next
    })
  }, [])
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
  // 合并本地节点与消费链：链中命中本地 pubkey 的节点原地升级为本地节点（同一节点，不另画）；
  // 零散本地节点仅当显式“添加到画布”（canvasNodeIds）时追加。
  const canvasGraph = useMemo(
    () =>
      mergeLocalNodes(
        query.graph,
        keyring.localFlowNodes,
        keyring.localConsumeNodes,
        canvasNodeIds,
      ),
    [canvasNodeIds, keyring.localConsumeNodes, keyring.localFlowNodes, query.graph],
  )
  const loadMountedConsumeChain = useCallback(
    async (nodePubkey: string) => {
      await refreshFromNodeIds(
        canvasGraph.nodes.map((node) => node.id),
        nodePubkey,
      )
    },
    [canvasGraph.nodes, refreshFromNodeIds],
  )
  const { localNodeState, registration } = useRegistrationController({
    apiBase,
    selectedLocalNode,
    localFlowNodes: keyring.localFlowNodes,
    localConsumeNodes: keyring.localConsumeNodes,
    localTxRecords: keyring.localTxRecords,
    loadConsumeChain: loadMountedConsumeChain,
    persistLocalFlowNodes: keyring.persistLocalFlowNodes,
    persistTxRecords: keyring.persistTxRecords,
    clearSelectedLocalNode: selection.clearSelectedLocalNode,
  })
  const nodeActions = useLocalNodeActions({
    clearLastRawBytes: registration.clearLastRawBytes,
    clearSelectedLocalNode: selection.clearSelectedLocalNode,
    markNodeOnCanvas,
    notifyError: registration.notifyError,
    notifyStatus: registration.notifyStatus,
    persistLocalConsumeNodes: keyring.persistLocalConsumeNodes,
    persistLocalFlowNodes: keyring.persistLocalFlowNodes,
    requestConfirm,
    requestText,
    selectLocalNode: selection.selectLocalNode,
    selectedLocalConsumeNode,
    selectedLocalNode,
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
      if (open) return
      closeVaultPrompt()
      // 在“创建口令”过程中关闭弹窗即放弃启用，回退到关闭态（私钥仍是明文）。
      if (keyring.vault.status === 'setup') keyring.handleDisableVault()
    },
    [closeVaultPrompt, keyring],
  )
  const handleOpenVault = useCallback(() => {
    requestVault('打开本地密钥环')
  }, [requestVault])
  const handleEnableVault = useCallback(() => {
    keyring.vault.enable()
  }, [keyring.vault])
  // 关闭保险库会解除加密并把私钥明文落盘，是降级安全的破坏性操作——与删除/导出一致，先确认。
  // 注意：放弃“启用”的弹窗关闭路径直接调用 keyring.handleDisableVault（此时尚未加密，无需确认）。
  const handleDisableVault = useCallback(() => {
    void requestConfirm({
      title: '关闭密钥保险库',
      description: '将解除 AES-GCM 加密，并把所有本地私钥以明文写入浏览器存储。',
      confirmLabel: '关闭保险库',
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) keyring.handleDisableVault()
    })
  }, [keyring, requestConfirm])
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
    requestVault('导入流转节点', () => void nodeActionsRef.current.handleImportLocalNode())
  }, [requestVault])
  const networkActions = useNetworkExplorerActions({
    filteredRows: query.filteredRows,
    graphEdges: query.graph.edges,
    notifyError: registration.notifyError,
    notifyStatus: registration.notifyStatus,
    requestUrl: query.requestUrl,
  })
  // 右键流转节点的注册/授权直接对该节点生效（私钥已在内存中，节点能出现在画布即代表保险库已解锁）。
  const handleRegisterFlowNode = useCallback(
    (node: ChainGraphNode) => {
      const localNode = keyring.localFlowNodes.find((item) => item.publicKeyHex === node.id)
      if (!localNode) return
      registration.notifyStatus(null)
      registration.notifyError(null)
      void registration.registerFlowNode(localNode)
    },
    [keyring.localFlowNodes, registration],
  )
  const handleAuthorizeFlowNode = useCallback(
    (node: ChainGraphNode) => {
      const localNode = keyring.localFlowNodes.find((item) => item.publicKeyHex === node.id)
      if (!localNode) return
      registration.notifyStatus(null)
      registration.notifyError(null)
      void registration.authorizeCentralPubkey(localNode)
    },
    [keyring.localFlowNodes, registration],
  )
  // 生成/挂载消费记录走弹窗：按右键来源预填对应节点。
  const [recordDialog, setRecordDialog] = useState<{
    flowNodePubkey?: string
    consumeNodePubkey?: string
  } | null>(null)
  const [mountDialog, setMountDialog] = useState<{ flowNodePubkey?: string } | null>(null)
  const handleGenerateRecord = useCallback(
    (node: ChainGraphNode) => {
      registration.notifyStatus(null)
      registration.notifyError(null)
      setRecordDialog(
        node.kind === 'local-consume'
          ? { consumeNodePubkey: node.id }
          : { flowNodePubkey: node.id },
      )
    },
    [registration],
  )
  const handleMountRecord = useCallback(
    (node: ChainGraphNode) => {
      registration.notifyStatus(null)
      registration.notifyError(null)
      registration.clearMountedPubkey()
      setMountDialog(node.kind === 'local-flow' ? { flowNodePubkey: node.id } : {})
    },
    [registration],
  )
  // 右键加载消费链：以该节点为端点查询并并入当前画布（mergeConsumeChains 去重累积，实现延展）。
  const handleLoadChain = useCallback(
    (node: ChainGraphNode, mode: QueryMode) => {
      void extendFromNode(node, mode)
    },
    [extendFromNode],
  )
  // 右键“节点管理”（导出私钥 / 重命名 / 删除）：按节点类型解析出本地节点，操作直接作用于该节点（无需先选中）。
  const handleExportNodeKey = useCallback(
    (node: ChainGraphNode) => {
      if (node.kind === 'local-flow') {
        const localNode = keyring.localFlowNodes.find((item) => item.publicKeyHex === node.id)
        if (localNode) void nodeActions.handleExportPrivateKey(localNode)
      } else if (node.kind === 'local-consume') {
        const localNode = keyring.localConsumeNodes.find((item) => item.publicKeyHex === node.id)
        if (localNode) void nodeActions.handleExportConsumeKey(localNode)
      }
    },
    [keyring.localConsumeNodes, keyring.localFlowNodes, nodeActions],
  )
  const handleRenameNode = useCallback(
    (node: ChainGraphNode) => {
      if (node.kind === 'local-flow') {
        const localNode = keyring.localFlowNodes.find((item) => item.publicKeyHex === node.id)
        if (localNode) void nodeActions.handleRenameLocalNode(localNode)
      } else if (node.kind === 'local-consume') {
        const localNode = keyring.localConsumeNodes.find((item) => item.publicKeyHex === node.id)
        if (localNode) void nodeActions.handleRenameConsumeNode(localNode)
      }
    },
    [keyring.localConsumeNodes, keyring.localFlowNodes, nodeActions],
  )
  const handleDeleteNode = useCallback(
    (node: ChainGraphNode) => {
      if (node.kind === 'local-flow') {
        const localNode = keyring.localFlowNodes.find((item) => item.publicKeyHex === node.id)
        if (localNode) void nodeActions.handleDeleteLocalNode(localNode)
      } else if (node.kind === 'local-consume') {
        const localNode = keyring.localConsumeNodes.find((item) => item.publicKeyHex === node.id)
        if (localNode) void nodeActions.handleDeleteConsumeNode(localNode)
      }
    },
    [keyring.localConsumeNodes, keyring.localFlowNodes, nodeActions],
  )

  const politeMessage =
    registration.status ??
    (query.origin === 'backend' ? `浏览完成：当前可见 ${query.filteredRows.length} 行。` : '')
  const alertMessage = query.error ?? registration.error ?? nodeDetail.nodeDetailError ?? ''
  const dashboardPanels = [
    {
      id: 'query',
      label: '\u6d4f\u89c8',
      icon: dashboardPanelIcons.query,
      content: <BrowsePanel apiBase={apiBase} />,
    },
    {
      id: 'localNodes',
      label: '\u672c\u5730\u8282\u70b9',
      icon: dashboardPanelIcons.localNodes,
      content: (
        <LocalNodePanel
          canvasNodeIds={canvasNodeIds}
          localConsumeNodes={keyring.localConsumeNodes}
          localFlowNodes={keyring.localFlowNodes}
          onAddConsumeNode={handleAddConsumeNode}
          onAddFlowNode={handleAddFlowNode}
          onImportLocalNode={handleImportLocalNode}
          onDisableVault={handleDisableVault}
          onEnableVault={handleEnableVault}
          onLockVault={keyring.handleLockVault}
          onOpenVault={handleOpenVault}
          onSelectLocalNode={selection.selectLocalNode}
          onToggleCanvas={toggleCanvasNode}
          selectedLocalId={selection.selectedLocalId}
          vaultStatus={keyring.vault.status}
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
          effectiveSelection={query.effectiveSelection}
          extendFromNode={extendFromNode}
          extendLoading={query.extendLoading}
          flowRateView={flowRateView}
          inspectorEmptyMessage={explorer.inspectorEmptyMessage}
          loading={query.loading}
          localFlowNodes={keyring.localFlowNodes}
          localNodeState={localNodeState}
          nodeActions={nodeActions}
          nodeDetail={nodeDetail}
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
      id: 'system',
      label: '\u7cfb\u7edf',
      icon: dashboardPanelIcons.system,
      content: (
        <SystemPanelContent
          error={systemStatus.error}
          onRefresh={() => void systemStatus.refresh()}
          status={systemStatus.data}
        />
      ),
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
        open={vaultPromptOpen || keyring.vault.status === 'setup'}
        reason={vaultPromptReason}
        status={keyring.vault.status}
        error={keyring.vault.error}
        onOpenChange={handleVaultPromptOpenChange}
        onSetup={(passphrase) => void keyring.vault.setup(passphrase)}
        onUnlock={(passphrase) => void keyring.vault.unlock(passphrase)}
        onLock={keyring.handleLockVault}
      />
      {userPromptDialogs}

      <DashboardWorkspace
        graph={
          <GraphPanel
            canvasGraph={canvasGraph}
            loading={query.loading}
            onAddConsumeNode={handleAddConsumeNode}
            onAddFlowNode={handleAddFlowNode}
            onRegisterFlowNode={handleRegisterFlowNode}
            onAuthorizeFlowNode={handleAuthorizeFlowNode}
            onGenerateRecord={handleGenerateRecord}
            onMountRecord={handleMountRecord}
            onLoadChain={handleLoadChain}
            onExportNodeKey={handleExportNodeKey}
            onRenameNode={handleRenameNode}
            onDeleteNode={handleDeleteNode}
            onSelectEdge={selection.onCanvasSelectEdge}
            onSelectNode={selection.onCanvasSelectNode}
            selectedId={selection.selectedLocalId ?? query.effectiveSelection?.id ?? null}
          />
        }
        panels={dashboardPanels}
      />

      <div className="dashboard-export-dock">
        <ExportPanelContent
          filteredRowCount={query.filteredRows.length}
          graphEdgeCount={query.graph.edges.length}
          onCopyCurl={networkActions.handleCopyCurl}
          onExportCsv={networkActions.handleExportCsv}
          onExportJson={networkActions.handleExportJson}
        />
      </div>

      <TransactionRecordDialog
        open={recordDialog !== null}
        busy={registration.busy === 'record'}
        consumeNodes={keyring.localConsumeNodes}
        defaultConsumeNodePubkey={recordDialog?.consumeNodePubkey}
        defaultFlowNodePubkey={recordDialog?.flowNodePubkey}
        error={registration.error}
        flowNodes={keyring.localFlowNodes}
        miningAttempts={registration.miningAttempts}
        status={registration.status}
        onCreate={(draft) => void registration.createTransactionRecord(draft)}
        onOpenChange={(open) => {
          if (!open) setRecordDialog(null)
        }}
      />
      <TransactionMountDialog
        open={mountDialog !== null}
        busy={registration.busy === 'mount'}
        canViewChain={registration.mountedPubkey !== null}
        defaultFlowNodePubkey={mountDialog?.flowNodePubkey}
        error={registration.error}
        flowNodes={keyring.localFlowNodes}
        miningAttempts={registration.miningAttempts}
        records={keyring.localTxRecords}
        status={registration.status}
        onMount={(recordId, flowNodePubkey) =>
          void registration.createTransactionMount(recordId, flowNodePubkey)
        }
        onOpenChange={(open) => {
          if (!open) setMountDialog(null)
        }}
        onViewChain={() => {
          const viewConsumeChain = registration.viewConsumeChain
          setMountDialog(null)
          window.setTimeout(viewConsumeChain, 0)
        }}
      />

      <OperationStatusToast
        busy={registration.busy}
        status={registration.status}
        error={registration.error}
        miningAttempts={registration.miningAttempts}
      />
    </div>
  )
}

export default App
