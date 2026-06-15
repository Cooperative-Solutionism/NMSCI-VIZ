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
  type TransactionRecordDraft,
} from './components'
import {
  ApiClient,
  generateKeyPair,
  getDifficulty,
  getLastBlock,
  getPublicKeyFromPrivate,
  sendCentralPubkeyEmpowerMsg,
  sendFlowNodeRegisterMsg,
  sendTransactionMountMsg,
  sendTransactionRecordMsg,
} from '@nmsci/sdk'
import { formatAmount, formatVolumeByCurrency, mergeLocalNodes, shortId } from './lib/chainGraph'
import { statusLabel } from './lib/consumeChainFilters'
import { useConsumeChainQuery, type CurrencyFilter } from './hooks/useConsumeChainQuery'
import { useNodeDetail } from './hooks/useNodeDetail'
import { useReturningFlowRate } from './hooks/useReturningFlowRate'
import { useSystemStatus } from './hooks/useSystemStatus'
import { normalizeNBitsHex } from './lib/difficulty'
import { errorMessage } from './lib/errors'
import { edgesToCsv, rowsToJson, toCurl } from './lib/exporters'
import { extractLoops } from './lib/loops'
import {
  buildEmpowerMessage,
  buildRegisterMessage,
  buildTransactionMountMessage,
  buildTransactionRecordMessage,
  makeMessageId,
  normalizePubkeyHex,
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
  type LocalFlowNodeAuthorization,
  type LocalFlowNodeRegistration,
} from './lib/flowNodeStorage'
import {
  loadLocalConsumeNodes,
  patchLocalConsumeNode,
  saveLocalConsumeNodes,
  type LocalConsumeNode,
} from './lib/consumeNodeStorage'
import type { ChainGraphEdge, ChainGraphNode } from './lib/types'
type FlowNodeBusyState = 'difficulty' | 'register' | 'authorize' | 'record' | 'mount' | null

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
  const [recordFormOpen, setRecordFormOpen] = useState(false)
  const [mountFormOpen, setMountFormOpen] = useState(false)
  const [mountedPubkey, setMountedPubkey] = useState<string | null>(null)
  const [txDifficulty, setTxDifficulty] = useState('')
  const canvasGraph = useMemo(
    () => mergeLocalNodes(graph, localFlowNodes, localConsumeNodes),
    [graph, localFlowNodes, localConsumeNodes],
  )
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null)
  const [registerDifficultyTarget, setRegisterDifficultyTarget] = useState('')
  const [centralPubkey, setCentralPubkey] = useState('')
  const [flowNodeBusy, setFlowNodeBusy] = useState<FlowNodeBusyState>(null)
  const [flowNodeStatus, setFlowNodeStatus] = useState<string | null>(null)
  const [flowNodeError, setFlowNodeError] = useState<string | null>(null)
  const [lastFlowNodeRawBytes, setLastFlowNodeRawBytes] = useState('')
  const [miningAttempts, setMiningAttempts] = useState<number | null>(null)
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
  const handleExportCsv = useCallback(() => {
    downloadText('consume-chain-edges.csv', 'text/csv;charset=utf-8', edgesToCsv(graph.edges))
  }, [graph.edges])
  const handleExportJson = useCallback(() => {
    downloadText('consume-chains.json', 'application/json', rowsToJson(filteredRows))
  }, [filteredRows])
  const handleCopyCurl = useCallback(async () => {
    await navigator.clipboard.writeText(toCurl(requestUrl))
    setFlowNodeError(null)
    setFlowNodeStatus('Request curl copied.')
  }, [requestUrl])
  const handlePickNode = useCallback((pubkey: string) => {
    setMode('node')
    setNodeId(pubkey)
    setFlowNodeError(null)
    setFlowNodeStatus('Picked node public key filled into query — click Load.')
  }, [setMode, setNodeId])
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
    setFlowNodeError(null)
    setFlowNodeStatus('Flow node added.')
    setLastFlowNodeRawBytes('')
  }, [persistLocalFlowNodes])

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
    setFlowNodeError(null)
    setFlowNodeStatus('Consume node added.')
  }, [persistLocalConsumeNodes])

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
      setFlowNodeError(null)
      setFlowNodeStatus('Flow node imported.')
    } catch (importError) {
      setFlowNodeError(errorMessage(importError, 'Invalid private key'))
    }
  }, [persistLocalFlowNodes])

  const handleRenameLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    const next = window.prompt('Rename flow node', selectedLocalNode.label)
    if (next == null) return
    const label = next.trim() || selectedLocalNode.label
    persistLocalFlowNodes((currentNodes) =>
      patchLocalFlowNode(currentNodes, selectedLocalNode.id, { label, updatedAt: new Date().toISOString() }),
    )
    setFlowNodeStatus('Flow node renamed.')
  }, [persistLocalFlowNodes, selectedLocalNode])

  const handleDeleteLocalNode = useCallback(() => {
    if (!selectedLocalNode) return
    if (!window.confirm('Delete this local flow node? Its private key will be lost.')) return
    const removedPubkey = selectedLocalNode.publicKeyHex
    persistLocalFlowNodes((currentNodes) => currentNodes.filter((current) => current.publicKeyHex !== removedPubkey))
    setSelectedLocalId(null)
    setFlowNodeError(null)
    setFlowNodeStatus('Flow node deleted.')
  }, [persistLocalFlowNodes, selectedLocalNode])

  const handleRenameConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    const next = window.prompt('Rename consume node', selectedLocalConsumeNode.label)
    if (next == null) return
    const label = next.trim() || selectedLocalConsumeNode.label
    persistLocalConsumeNodes((currentNodes) =>
      patchLocalConsumeNode(currentNodes, selectedLocalConsumeNode.id, { label, updatedAt: new Date().toISOString() }),
    )
    setFlowNodeStatus('Consume node renamed.')
  }, [persistLocalConsumeNodes, selectedLocalConsumeNode])

  const handleDeleteConsumeNode = useCallback(() => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('Delete this consume node? Its private key will be lost.')) return
    const removedPubkey = selectedLocalConsumeNode.publicKeyHex
    persistLocalConsumeNodes((currentNodes) => currentNodes.filter((current) => current.publicKeyHex !== removedPubkey))
    setSelectedLocalId(null)
    setFlowNodeError(null)
    setFlowNodeStatus('Consume node deleted.')
  }, [persistLocalConsumeNodes, selectedLocalConsumeNode])

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

  const handleExportConsumeKey = useCallback(async () => {
    if (!selectedLocalConsumeNode) return
    if (!window.confirm('Export private key from localStorage? It is stored in clear text.')) return
    await handleCopyText(selectedLocalConsumeNode.privateKeyHex, 'Private key')
  }, [handleCopyText, selectedLocalConsumeNode])

  const handleToggleRecordForm = useCallback(() => {
    if (recordFormOpen) {
      setRecordFormOpen(false)
      return
    }
    // 先拉取交易难度作为表单默认值，再开表单（表单挂载时即带上默认难度）。
    void (async () => {
      try {
        setTxDifficulty((await getDifficulty(client)).data.transaction.nbitsHex)
      } catch {
        /* 默认难度拉取失败不阻塞表单 */
      }
      setRecordFormOpen(true)
    })()
  }, [client, recordFormOpen])

  const handleCreateTransactionRecord = useCallback(async (draft: TransactionRecordDraft) => {
    if (!selectedLocalNode) return
    const consumeNode = localConsumeNodes.find((node) => node.publicKeyHex === draft.consumeNodePubkey)
    if (!consumeNode) {
      setFlowNodeError('Add or pick a consume node first.')
      return
    }
    setFlowNodeBusy('record')
    setFlowNodeError(null)
    setMiningAttempts(0)
    try {
      const messageId = makeMessageId()
      const centralPubkeyHex = normalizePubkeyHex(draft.centralPubkey)
      const built = await buildTransactionRecordMessage(
        {
          uuid: messageId,
          amount: BigInt(draft.amount),
          currencyType: draft.currencyType,
          difficultyHex: normalizeNBitsHex(draft.difficultyHex, 'Transaction difficulty'),
          consumeNodePubkeyHex: consumeNode.publicKeyHex,
          flowNodePubkeyHex: selectedLocalNode.publicKeyHex,
          centralPubkeyHex,
          consumePrivateKeyHex: consumeNode.privateKeyHex,
          flowPrivateKeyHex: selectedLocalNode.privateKeyHex,
        },
        (attempts) => setMiningAttempts(attempts),
      )
      const response = (await sendTransactionRecordMsg(client, built.bytes)).data
      const record: LocalTxRecord = {
        id: response.id ?? messageId,
        uuid: messageId,
        amount: draft.amount,
        currencyType: draft.currencyType,
        consumeNodePubkey: consumeNode.publicKeyHex,
        flowNodePubkey: selectedLocalNode.publicKeyHex,
        centralPubkey: centralPubkeyHex,
        txid: response.txid,
        rawBytesHex: built.rawBytesHex,
        status: 'sent',
        createdAt: new Date().toISOString(),
      }
      persistTxRecords((current) => [record, ...current])
      setFlowNodeStatus(`Transaction record created (${shortId(record.id)}).`)
    } catch (operationError) {
      setFlowNodeError(errorMessage(operationError, 'Failed to create transaction record'))
    } finally {
      setFlowNodeBusy(null)
      setMiningAttempts(null)
    }
  }, [client, localConsumeNodes, persistTxRecords, selectedLocalNode])

  const handleToggleMountForm = useCallback(() => {
    if (mountFormOpen) {
      setMountFormOpen(false)
      return
    }
    void (async () => {
      try {
        setTxDifficulty((await getDifficulty(client)).data.transaction.nbitsHex)
      } catch {
        /* 默认难度拉取失败不阻塞表单 */
      }
      setMountFormOpen(true)
    })()
  }, [client, mountFormOpen])

  const handleCreateTransactionMount = useCallback(async (recordId: string, difficultyHex: string) => {
    const record = localTxRecords.find((candidate) => candidate.id === recordId)
    if (!record) return
    const consumeNode = localConsumeNodes.find((node) => node.publicKeyHex === record.consumeNodePubkey)
    const flowNode = localFlowNodes.find((node) => node.publicKeyHex === record.flowNodePubkey)
    if (!consumeNode || !flowNode) {
      setFlowNodeError('The consume/flow node for this record is not in your keyring.')
      return
    }
    setFlowNodeBusy('mount')
    setFlowNodeError(null)
    setMiningAttempts(0)
    setMountedPubkey(null)
    try {
      const built = await buildTransactionMountMessage(
        {
          uuid: makeMessageId(),
          mountedTransactionRecordId: record.id,
          difficultyHex: normalizeNBitsHex(difficultyHex, 'Mount difficulty'),
          consumeNodePubkeyHex: record.consumeNodePubkey,
          flowNodePubkeyHex: record.flowNodePubkey,
          centralPubkeyHex: record.centralPubkey,
          consumePrivateKeyHex: consumeNode.privateKeyHex,
          flowPrivateKeyHex: flowNode.privateKeyHex,
        },
        (attempts) => setMiningAttempts(attempts),
      )
      await sendTransactionMountMsg(client, built.bytes)
      setMountedPubkey(record.flowNodePubkey)
      setFlowNodeStatus('Transaction mounted. View the consume chain to see it on the graph.')
    } catch (operationError) {
      setFlowNodeError(errorMessage(operationError, 'Failed to mount transaction'))
    } finally {
      setFlowNodeBusy(null)
      setMiningAttempts(null)
    }
  }, [client, localConsumeNodes, localFlowNodes, localTxRecords])

  const handleViewConsumeChain = useCallback(() => {
    if (!mountedPubkey) return
    setSelectedLocalId(null)
    setMountFormOpen(false)
    void runQuery(0, { mode: 'node', nodeId: mountedPubkey })
  }, [mountedPubkey, runQuery])

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
    setMiningAttempts(0)

    let difficultyTarget = ''
    let rawBytesHex = ''
    let nonce = 0
    try {
      difficultyTarget = normalizeNBitsHex(registerDifficultyTarget, 'Register difficulty target')
      const messageId = makeMessageId()
      const built = await buildRegisterMessage(
        {
          uuid: messageId,
          privateKeyHex: selectedLocalNode.privateKeyHex,
          publicKeyHex: selectedLocalNode.publicKeyHex,
          difficultyHex: difficultyTarget,
        },
        (attempts) => setMiningAttempts(attempts),
      )
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
      void reloadLocalNodeState(selectedLocalNode.publicKeyHex)
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
      setMiningAttempts(null)
    }
  }, [client, persistLocalFlowNodes, reloadLocalNodeState, registerDifficultyTarget, selectedLocalNode])

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
      void reloadLocalNodeState(selectedLocalNode.publicKeyHex)
    } catch (operationError) {
      const message = errorMessage(operationError, 'Central pubkey authorization failed')
      setFlowNodeError(message)
    } finally {
      setFlowNodeBusy(null)
    }
  }, [centralPubkey, client, persistLocalFlowNodes, reloadLocalNodeState, selectedLocalNode])

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
            {flowNodeError && !selectedLocalNode && !selectedLocalConsumeNode ? (
              <p className="operation-message error">{flowNodeError}</p>
            ) : null}
          </div>

        </aside>

        <section id="network-graph" className="graph-panel" aria-label="Network visualization" aria-busy={loading}>
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

          {selectedLocalNode ? (
            <>
              <FlowNodeOperatePanel
                busy={flowNodeBusy}
                centralLocked={centralLocked}
                centralPubkey={centralPubkey}
                error={flowNodeError}
                lastRawBytes={lastFlowNodeRawBytes}
                miningAttempts={miningAttempts}
                node={selectedLocalNode}
                nodeState={localNodeState}
                onAuthorize={() => void handleAuthorizeCentralPubkey()}
                onCentralPubkeyChange={setCentralPubkey}
                onCopy={(value, label) => void handleCopyText(value, label)}
                onCreateMount={handleToggleMountForm}
                onCreateRecord={handleToggleRecordForm}
                onDelete={handleDeleteLocalNode}
                onDifficultyChange={setRegisterDifficultyTarget}
                onExportPrivateKey={() => void handleExportPrivateKey()}
                onFetchDifficulty={() => void handleFetchRegisterDifficulty()}
                onQuery={handleQuerySelectedFlowNode}
                onRegister={() => void handleRegisterFlowNode()}
                onRename={handleRenameLocalNode}
                registerDifficultyTarget={registerDifficultyTarget}
                status={flowNodeStatus}
              />
              {recordFormOpen ? (
                <TransactionRecordForm
                  busy={flowNodeBusy === 'record'}
                  consumeNodes={localConsumeNodes}
                  defaultCentralPubkey={centralPubkey}
                  defaultDifficulty={txDifficulty}
                  error={flowNodeError}
                  miningAttempts={miningAttempts}
                  onCreate={(draft) => void handleCreateTransactionRecord(draft)}
                  status={flowNodeStatus}
                />
              ) : null}
              {recordFormOpen && localTxRecords.length > 0 ? (
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
              {mountFormOpen ? (
                <TransactionMountForm
                  busy={flowNodeBusy === 'mount'}
                  canViewChain={mountedPubkey !== null}
                  defaultDifficulty={txDifficulty}
                  error={flowNodeError}
                  miningAttempts={miningAttempts}
                  onMount={(recordId, difficultyHex) => void handleCreateTransactionMount(recordId, difficultyHex)}
                  onViewChain={handleViewConsumeChain}
                  records={localTxRecords}
                  status={flowNodeStatus}
                />
              ) : null}
            </>
          ) : selectedLocalConsumeNode ? (
            <ConsumeNodeOperatePanel
              error={flowNodeError}
              node={selectedLocalConsumeNode}
              onCopy={(value, label) => void handleCopyText(value, label)}
              onDelete={handleDeleteConsumeNode}
              onExportPrivateKey={() => void handleExportConsumeKey()}
              onRename={handleRenameConsumeNode}
              status={flowNodeStatus}
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
