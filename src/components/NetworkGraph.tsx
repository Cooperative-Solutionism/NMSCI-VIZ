import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Workflow } from 'lucide-react'
import { shortId } from '../lib/chainGraph'
import type { ChainGraphEdge, ChainGraphNode } from '../lib/types'
import { GraphAccessList } from './network-graph/GraphAccessList'
import { GraphContextMenu } from './network-graph/GraphContextMenu'
import { GraphLegend } from './network-graph/GraphLegend'
import { GraphSearch } from './network-graph/GraphSearch'
import { GraphTools } from './network-graph/GraphTools'
import {
  GRAPH_VIEW_STORAGE_KEY,
  normalizeGraphViewState,
  saveGraphViewState,
  type GraphHighlightMode,
  type GraphViewState,
} from './network-graph/graphViewState'
import type { ContextMenuState, NetworkGraphProps } from './network-graph/types'
import { useCytoscapeGraph } from './network-graph/useCytoscapeGraph'

interface GraphViewStateStore {
  getSnapshot: () => GraphViewState
  set: (next: GraphViewState, options?: { notify?: boolean }) => void
  subscribe: (listener: () => void) => () => void
}

export function NetworkGraph({
  graph,
  selectedId,
  onSelectNode,
  onSelectEdge,
  onAddFlowNode,
  onAddConsumeNode,
  onRegisterFlowNode,
  onAuthorizeFlowNode,
  onGenerateRecord,
  onMountRecord,
  onLoadChain,
  onExportNodeKey,
  onRenameNode,
  onDeleteNode,
}: NetworkGraphProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const selectedChainIds = useMemo(
    () => chainsForSelection(graph, selectedId),
    [graph, selectedId],
  )
  const cycleChainIds = useMemo(
    () =>
      new Set(
        graph.edges.filter((edge) => edge.status === 'looped').map((edge) => edge.chainId),
      ),
    [graph.edges],
  )
  const hasCycles = cycleChainIds.size > 0
  const graphElementIds = useMemo(
    () => new Set([...graph.nodes.map((node) => node.id), ...graph.edges.map((edge) => edge.id)]),
    [graph.edges, graph.nodes],
  )
  const graphViewStateOptions = useMemo(
    () => ({ elementIds: graphElementIds, hasCycles }),
    [graphElementIds, hasCycles],
  )
  const hasGraphElements = graphElementIds.size > 0
  const graphViewStatePersistenceOptions = hasGraphElements ? graphViewStateOptions : undefined
  const controlledSelectedId =
    selectedId && graphElementIds.has(selectedId) ? selectedId : null
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  )
  const edgeById = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.id, edge])),
    [graph.edges],
  )
  const [savedInitialViewState] = useState<GraphViewState | null>(() => readSavedGraphViewState())
  const [graphViewStateStore] = useState(() =>
    createGraphViewStateStore(savedInitialViewState ?? normalizeGraphViewState(null)),
  )
  const graphViewState = useSyncExternalStore(
    graphViewStateStore.subscribe,
    graphViewStateStore.getSnapshot,
    graphViewStateStore.getSnapshot,
  )
  const controlledDeselectedRef = useRef(false)
  const previousSelectedIdRef = useRef<string | null>(selectedId)
  const normalizedGraphViewState = useMemo(
    () => normalizeGraphViewState(graphViewState, graphViewStateOptions),
    [graphViewState, graphViewStateOptions],
  )
  const initialViewState = useMemo(
    () => (savedInitialViewState ? normalizedGraphViewState : undefined),
    [normalizedGraphViewState, savedInitialViewState],
  )
  const restoredSelectionRef = useRef<string | null>(null)
  const highlightMode: GraphHighlightMode = normalizedGraphViewState.highlightMode

  const closeMenu = useCallback(() => setMenu(null), [])
  const persistGraphViewState = useCallback(
    (patch: Partial<GraphViewState>) => {
      const current = graphViewStateStore.getSnapshot()
      const next = normalizeGraphViewState(
        {
          ...current,
          ...patch,
          pan: patch.pan ?? current.pan,
          selectedId:
            patch.selectedId !== undefined
              ? patch.selectedId
              : controlledDeselectedRef.current
                ? null
                : (controlledSelectedId ?? current.selectedId),
        },
        graphViewStatePersistenceOptions,
      )
      if (patch.selectedId !== undefined) {
        controlledDeselectedRef.current = patch.selectedId === null
      }
      graphViewStateStore.set(next)
      saveGraphViewState(next, undefined, graphViewStatePersistenceOptions)
    },
    [controlledSelectedId, graphViewStatePersistenceOptions, graphViewStateStore],
  )
  const handleSelectNode = useCallback(
    (node: ChainGraphNode) => {
      onSelectNode(node)
      persistGraphViewState({ selectedId: node.id })
    },
    [onSelectNode, persistGraphViewState],
  )
  const handleSelectEdge = useCallback(
    (edge: ChainGraphEdge) => {
      onSelectEdge(edge)
      persistGraphViewState({ selectedId: edge.id })
    },
    [onSelectEdge, persistGraphViewState],
  )
  const handleViewChange = useCallback(
    (view: Pick<GraphViewState, 'zoom' | 'pan'>) => {
      persistGraphViewState(view)
    },
    [persistGraphViewState],
  )
  const { containerRef, cyRef, focusNode } = useCytoscapeGraph({
    graph,
    selectedId,
    selectedChainIds,
    cycleChainIds,
    highlightMode,
    initialViewState,
    onSelectNode: handleSelectNode,
    onSelectEdge: handleSelectEdge,
    onOpenMenu: setMenu,
    onCloseMenu: closeMenu,
    onViewChange: handleViewChange,
  })

  useEffect(() => {
    if (!hasGraphElements) {
      return
    }

    const current = graphViewStateStore.getSnapshot()
    const next = normalizeGraphViewState(current, graphViewStateOptions)
    if (graphViewStatesEqual(current, next)) {
      return
    }

    graphViewStateStore.set(next)
    saveGraphViewState(next, undefined, graphViewStateOptions)
  }, [
    graphViewState,
    graphViewStateOptions,
    graphViewStateStore,
    hasGraphElements,
  ])

  useEffect(() => {
    if (!hasGraphElements) {
      previousSelectedIdRef.current = selectedId
      return
    }

    const previousSelectedId = previousSelectedIdRef.current
    previousSelectedIdRef.current = selectedId

    if (controlledSelectedId) {
      controlledDeselectedRef.current = false
      const current = graphViewStateStore.getSnapshot()
      const normalizedCurrent = normalizeGraphViewState(current, graphViewStateOptions)
      const next = normalizeGraphViewState(
        {
          ...normalizedCurrent,
          selectedId: controlledSelectedId,
        },
        graphViewStateOptions,
      )
      if (!graphViewStatesEqual(current, next)) {
        graphViewStateStore.set(next, { notify: false })
      }
      saveGraphViewState(next, undefined, graphViewStateOptions)
      return
    }

    if (selectedId !== null || !previousSelectedId || !graphElementIds.has(previousSelectedId)) {
      return
    }

    controlledDeselectedRef.current = true
    const current = graphViewStateStore.getSnapshot()
    const normalizedCurrent = normalizeGraphViewState(current, graphViewStateOptions)
    const next = normalizeGraphViewState(
      {
        ...normalizedCurrent,
        selectedId: null,
      },
      graphViewStateOptions,
    )
    if (!graphViewStatesEqual(current, next)) {
      graphViewStateStore.set(next, { notify: false })
    }
    saveGraphViewState(next, undefined, graphViewStateOptions)
  }, [
    controlledSelectedId,
    graphElementIds,
    graphViewStateOptions,
    graphViewStateStore,
    hasGraphElements,
    selectedId,
  ])

  useEffect(() => {
    // 仅恢复“挂载时”持久化的那个选择，且只恢复一次。
    // 必须用稳定的 savedInitialViewState（而非随 store 漂移的 initialViewState），
    // 否则新增节点时它会回放旧选择，导致选中态在旧/新节点间闪烁。
    const restoredSelectedId = savedInitialViewState?.selectedId
    if (
      !restoredSelectedId ||
      selectedId === restoredSelectedId ||
      restoredSelectionRef.current === restoredSelectedId
    ) {
      return
    }

    const restoredNode = nodeById.get(restoredSelectedId)
    if (restoredNode) {
      restoredSelectionRef.current = restoredSelectedId
      onSelectNode(restoredNode)
      return
    }

    const restoredEdge = edgeById.get(restoredSelectedId)
    if (restoredEdge) {
      restoredSelectionRef.current = restoredSelectedId
      onSelectEdge(restoredEdge)
    }
  }, [
    edgeById,
    nodeById,
    onSelectEdge,
    onSelectNode,
    savedInitialViewState,
    selectedId,
  ])

  // 菜单的关闭（Esc / 点击外部 / 选中条目）由 DropdownMenu 经 onOpenChange→closeMenu 处理；
  // 画布内的点击另由 useCytoscapeGraph 的 cy.on('tap', closeMenu) 兜底。

  const handleDownloadPng = useCallback(() => {
    const cy = cyRef.current
    if (!cy) return
    const uri = cy.png({ full: true, scale: 2, bg: '#ffffff' })
    const link = document.createElement('a')
    link.href = uri
    link.download = 'nmsci-graph.png'
    link.click()
  }, [cyRef])

  const handleSearchSelect = useCallback(
    (node: ChainGraphNode) => {
      handleSelectNode(node)
      focusNode(node.id)
    },
    [focusNode, handleSelectNode],
  )

  const handleHighlightModeChange = useCallback(
    (mode: GraphHighlightMode) => {
      persistGraphViewState({ highlightMode: mode })
    },
    [persistGraphViewState],
  )

  const zoomBy = useCallback(
    (delta: number) => {
      const cy = cyRef.current
      if (!cy) return
      cy.zoom(cy.zoom() + delta)
    },
    [cyRef],
  )

  const fitGraph = useCallback(() => {
    cyRef.current?.fit(undefined, 48)
  }, [cyRef])

  const openMenuAtCenter = useCallback(() => {
    const cy = cyRef.current
    const container = containerRef.current
    if (!cy || !container) return
    const extent = cy.extent()
    setMenu({
      x: container.clientWidth / 2,
      y: container.clientHeight / 2,
      position: {
        x: (extent.x1 + extent.x2) / 2,
        y: (extent.y1 + extent.y2) / 2,
      },
    })
  }, [containerRef, cyRef])

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomBy(0.15)
      } else if (event.key === '-') {
        event.preventDefault()
        zoomBy(-0.15)
      } else if (event.key === '0') {
        event.preventDefault()
        fitGraph()
      } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault()
        openMenuAtCenter()
      } else if (event.key === 'Escape') {
        setMenu(null)
      }
    },
    [fitGraph, openMenuAtCenter, zoomBy],
  )

  const activeHighlightCount =
    highlightMode === 'cycles' ? cycleChainIds.size : selectedChainIds.size
  const selectedState = selectedId ? `选中 ${shortId(selectedId)}` : '未选择'
  const highlightState =
    highlightMode === 'cycles' ? `循环 ${cycleChainIds.size}` : `高亮链 ${activeHighlightCount}`
  const densityHint = graph.nodes.length > 100 ? '节点较多，建议使用搜索定位' : null

  return (
    <div className="graph-shell" onContextMenu={(event) => event.preventDefault()}>
      <div className="graph-statusbar" aria-label="画布状态">
        <div className="graph-statusbar__brand">
          <Workflow aria-hidden="true" />
          <strong>NMSCI 交易画布</strong>
        </div>
        <div className="graph-statusbar__meta">
          <span>节点 {graph.nodes.length}</span>
          <span>连接 {graph.edges.length}</span>
          <span>{highlightState}</span>
          <span>{selectedState}</span>
          {densityHint ? <span>{densityHint}</span> : null}
        </div>
      </div>

      {/* Cytoscape owns this custom canvas widget; keyboard affordances are wired below. */}
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <div
        ref={containerRef}
        className="graph-canvas"
        role="application"
        aria-roledescription="交互式网络图谱"
        tabIndex={0}
        aria-label={`消费链网络图谱，包含 ${graph.nodes.length} 个节点和 ${graph.edges.length} 条边`}
        onKeyDown={handleCanvasKeyDown}
      />
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      <GraphSearch nodes={graph.nodes} onSelectNode={handleSearchSelect} />

      {menu ? (
        <GraphContextMenu
          menu={menu}
          onAddConsumeNode={onAddConsumeNode}
          onAddFlowNode={onAddFlowNode}
          onRegisterFlowNode={onRegisterFlowNode}
          onAuthorizeFlowNode={onAuthorizeFlowNode}
          onGenerateRecord={onGenerateRecord}
          onMountRecord={onMountRecord}
          onLoadChain={onLoadChain}
          onExportNodeKey={onExportNodeKey}
          onRenameNode={onRenameNode}
          onDeleteNode={onDeleteNode}
          onClose={closeMenu}
          returnFocusRef={containerRef}
        />
      ) : null}
      <GraphAccessList
        graph={graph}
        onSelectEdge={handleSelectEdge}
        onSelectNode={handleSelectNode}
      />
      <GraphTools
        hasCycles={hasCycles}
        highlightMode={highlightMode}
        onDownloadPng={handleDownloadPng}
        onFit={fitGraph}
        onHighlightModeChange={handleHighlightModeChange}
        onZoomBy={zoomBy}
      />
      <GraphLegend />
    </div>
  )
}

function chainsForSelection(
  graph: NetworkGraphProps['graph'],
  selectedId: string | null,
): Set<string> {
  if (!selectedId) return new Set()

  const selectedEdge = graph.edges.find((edge) => edge.id === selectedId)
  if (selectedEdge) return new Set([selectedEdge.chainId])

  if (!graph.nodes.some((node) => node.id === selectedId)) return new Set()

  const chainIds = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.source === selectedId || edge.target === selectedId) {
      chainIds.add(edge.chainId)
    }
  }
  return chainIds
}

function graphViewStatesEqual(left: GraphViewState, right: GraphViewState): boolean {
  return (
    left.zoom === right.zoom &&
    left.pan.x === right.pan.x &&
    left.pan.y === right.pan.y &&
    left.selectedId === right.selectedId &&
    left.highlightMode === right.highlightMode
  )
}

function createGraphViewStateStore(initial: GraphViewState): GraphViewStateStore {
  let current = initial
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => current,
    set: (next, options) => {
      if (graphViewStatesEqual(current, next)) return

      current = next
      if (options?.notify === false) return

      listeners.forEach((listener) => listener())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

function readSavedGraphViewState(): GraphViewState | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(GRAPH_VIEW_STORAGE_KEY)
    return raw ? normalizeGraphViewState(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
