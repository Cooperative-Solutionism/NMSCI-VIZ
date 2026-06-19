import type {
  CanvasPosition,
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainQuery,
  ConsumeChainResponseDTO,
  FlowNodeCanvasStatus,
  VolumeByCurrency,
} from './types'
import { consumeChainParamName, detectIdentityKind } from './consumeChainFilters'
import { readGraphTokens } from './tokens'

export function buildGraphFromConsumeChains(rows: ConsumeChainResponseDTO[]): ChainGraph {
  const nodes = new Map<string, ChainGraphNode>()
  const edges: ChainGraphEdge[] = []
  const volumeByCurrency: VolumeByCurrency = new Map()
  let loopedChains = 0

  for (const row of rows) {
    if (row.consumeChain.isLoop) loopedChains += 1
    addAmount(volumeByCurrency, row.consumeChain.currencyType, row.consumeChain.amount)

    // 节点吞吐量仅由边贡献（链的 start/end 必为首尾边的端点），避免链额+边额对同一节点重复计数。
    for (const edge of row.consumeChainEdges) {
      touchNode(nodes, edge.source, edge.amount, edge.currencyType)
      touchNode(nodes, edge.target, edge.amount, edge.currencyType)
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: formatAmount(edge.amount, edge.currencyType),
        amount: edge.amount,
        currencyType: edge.currencyType,
        chainId: edge.chain,
        status: edge.isLoop ? 'looped' : 'open',
        color: chainColor(edge.chain),
        relatedTransactionRecord: edge.relatedTransactionRecord,
        relatedTransactionMount: edge.relatedTransactionMount,
        relatedTransactionMountTimestamp: edge.relatedTransactionMountTimestamp,
      })
    }

    // 无边的退化链（理论上不出现）仍需让 start/end 入图。
    if (row.consumeChainEdges.length === 0) {
      touchNode(nodes, row.consumeChain.start, 0n, row.consumeChain.currencyType)
      touchNode(nodes, row.consumeChain.end, 0n, row.consumeChain.currencyType)
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: withEndpointSequenceLabels(edges),
    stats: {
      totalChains: rows.length,
      loopedChains,
      openChains: rows.length - loopedChains,
      volumeByCurrency,
    },
  }
}

// 展示用：还原 SDK queryConsumeChains 实际请求的 URL（集合根 + id/pubkey 模式查询参数）。
export function buildConsumeChainUrl(baseUrl: string, query: ConsumeChainQuery): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams()
  const trimmed = query.nodeId.trim()
  params.set(consumeChainParamName(query.mode, detectIdentityKind(trimmed)), trimmed)

  if (query.loopStatus !== 'all') {
    params.set('isLoop', String(query.loopStatus === 'looped'))
  }

  params.set('page', String(query.page))
  params.set('size', String(query.size))

  return `${normalizedBaseUrl}/consume-chains?${params.toString()}`
}

export function shortId(id: string): string {
  return id.slice(0, 6).toUpperCase()
}

export function mergeConsumeChains(
  currentRows: ConsumeChainResponseDTO[],
  nextRows: ConsumeChainResponseDTO[],
): ConsumeChainResponseDTO[] {
  const rowsByChainId = new Map<string, ConsumeChainResponseDTO>()
  for (const row of currentRows) {
    rowsByChainId.set(row.consumeChain.id, row)
  }
  for (const row of nextRows) {
    if (!rowsByChainId.has(row.consumeChain.id)) {
      rowsByChainId.set(row.consumeChain.id, row)
    }
  }
  return Array.from(rowsByChainId.values())
}

export function formatAmount(amount: number | bigint, currencyType: number): string {
  const normalizedAmount = typeof amount === 'bigint' ? amount : BigInt(Math.trunc(amount))
  if (currencyType === 1) {
    const whole = normalizedAmount / 100n
    const cents = normalizedAmount % 100n
    return `${whole.toLocaleString()}.${cents.toString().padStart(2, '0')} CNY`
  }
  if (currencyType === 0) {
    return `${normalizedAmount.toLocaleString()} Au 微克`
  }
  return `${normalizedAmount.toLocaleString()} #${currencyType}`
}

// 把按币种分桶的金额渲染成单行（"125.00 CNY · 2,500,000 Au 微克"）。空桶显示 0。
export function formatVolumeByCurrency(volumeByCurrency: VolumeByCurrency): string {
  if (volumeByCurrency.size === 0) return formatAmount(0n, 1)
  return [...volumeByCurrency.entries()]
    .sort(([a], [b]) => a - b)
    .map(([currencyType, amount]) => formatAmount(amount, currencyType))
    .join(' · ')
}

function addAmount(target: VolumeByCurrency, currencyType: number, amount: bigint): void {
  target.set(currencyType, (target.get(currencyType) ?? 0n) + amount)
}

export function chainColor(chainId: string): string {
  const chainPalette = readGraphTokens().chainPalette
  let hash = 0
  for (let index = 0; index < chainId.length; index += 1) {
    hash = (hash * 31 + chainId.charCodeAt(index)) >>> 0
  }
  return chainPalette[hash % chainPalette.length] ?? '#0f766e'
}

function touchNode(
  nodes: Map<string, ChainGraphNode>,
  id: string,
  amount: bigint,
  currencyType: number,
): void {
  const existing = nodes.get(id)
  if (existing) {
    existing.chainCount += 1
    addAmount(existing.volumeByCurrency, currencyType, amount)
    return
  }

  const volumeByCurrency: VolumeByCurrency = new Map()
  addAmount(volumeByCurrency, currencyType, amount)
  nodes.set(id, {
    id,
    label: shortId(id),
    chainCount: 1,
    volumeByCurrency,
    kind: 'chain',
  })
}

// 本地密钥节点的最小展示信息（避免 chainGraph 依赖 storage 类型）。
export interface LocalNodeRef {
  id: string
  publicKeyHex: string
  label?: string
  position?: CanvasPosition
  registration?: {
    id: string
    status?: 'sent' | 'failed'
  }
  authorizations?: Array<{ status: 'sent' | 'failed' }>
}

export function flowNodeDisplayName(node: LocalNodeRef, index: number): string {
  return node.registration?.id ? shortId(node.registration.id) : `未注册${index + 1}`
}

// 由本地注册/授权记录推断画布状态标签（与本地节点表格的状态列保持一致）。
export function flowNodeCanvasStatus(node: LocalNodeRef): FlowNodeCanvasStatus {
  if (node.registration?.status === 'failed') return 'failed'
  if (node.registration?.status === 'sent') {
    return node.authorizations?.some((authorization) => authorization.status === 'sent')
      ? 'authorized'
      : 'registered'
  }
  return 'unregistered'
}

export const flowNodeStatusLabels: Record<FlowNodeCanvasStatus, string> = {
  unregistered: '未注册',
  registered: '已注册',
  authorized: '已授权',
  failed: '注册失败',
}

// Local nodes can match chain nodes by pubkey or by a backend node id, such as a flow
// registration id. Normalize those aliases to the local pubkey before Cytoscape sees the graph,
// so nodes and edges are drawn on the same canvas node instead of as duplicate lookalikes.
// Standalone local nodes are appended only when explicitly added to the canvas; omitting
// canvasNodeIds keeps the old unrestricted behavior for tests and non-gated callers.
export function mergeLocalNodes(
  graph: ChainGraph,
  flowNodes: LocalNodeRef[],
  consumeNodes: LocalNodeRef[],
  canvasNodeIds?: ReadonlySet<string>,
): ChainGraph {
  const localByPubkey = new Map<
    string,
    { kind: 'flow'; ref: LocalNodeRef; index: number } | { kind: 'consume'; ref: LocalNodeRef }
  >()
  const aliases = new Map<string, string>()
  const addAlias = (alias: string | undefined, pubkey: string): void => {
    const trimmed = alias?.trim()
    if (trimmed && !aliases.has(trimmed)) aliases.set(trimmed, pubkey)
  }

  flowNodes.forEach((ref, index) => {
    localByPubkey.set(ref.publicKeyHex, { kind: 'flow', ref, index })
    addAlias(ref.publicKeyHex, ref.publicKeyHex)
    addAlias(ref.registration?.id, ref.publicKeyHex)
  })
  consumeNodes.forEach((ref) => {
    if (!localByPubkey.has(ref.publicKeyHex)) {
      localByPubkey.set(ref.publicKeyHex, { kind: 'consume', ref })
    }
    addAlias(ref.publicKeyHex, ref.publicKeyHex)
  })

  const canonicalId = (id: string): string => aliases.get(id) ?? id
  const baseById = new Map<string, ChainGraphNode>()
  let changed = false
  for (const node of graph.nodes) {
    const id = canonicalId(node.id)
    if (id !== node.id) changed = true
    const normalized = id === node.id ? node : { ...node, id }
    const existing = baseById.get(id)
    baseById.set(id, existing ? mergeBaseNode(existing, normalized) : normalized)
  }

  const nodes = Array.from(baseById.values()).map((node) => {
    const local = localByPubkey.get(node.id)
    if (!local) return node
    changed = true
    return local.kind === 'flow'
      ? localFlowGraphNode(local.ref, local.index, node)
      : localConsumeGraphNode(local.ref, node)
  })

  const edges = graph.edges.map((edge) => {
    const source = canonicalId(edge.source)
    const target = canonicalId(edge.target)
    if (source === edge.source && target === edge.target) return edge
    changed = true
    return { ...edge, source, target }
  })

  // Append standalone local nodes only when they were explicitly added to the canvas.
  const seen = new Set(nodes.map((node) => node.id))
  const shouldAppend = (pubkey: string): boolean =>
    !seen.has(pubkey) && (canvasNodeIds === undefined || canvasNodeIds.has(pubkey))
  const extra: ChainGraphNode[] = []
  flowNodes.forEach((ref, index) => {
    if (!shouldAppend(ref.publicKeyHex)) return
    seen.add(ref.publicKeyHex)
    extra.push(localFlowGraphNode(ref, index))
  })
  consumeNodes.forEach((ref) => {
    if (!shouldAppend(ref.publicKeyHex)) return
    seen.add(ref.publicKeyHex)
    extra.push(localConsumeGraphNode(ref))
  })

  if (!changed && extra.length === 0) return graph
  return { ...graph, nodes: [...nodes, ...extra], edges: withEndpointSequenceLabels(edges) }
}

function withEndpointSequenceLabels(edges: ChainGraphEdge[]): ChainGraphEdge[] {
  const originalOrder = new Map<ChainGraphEdge, number>()
  const edgesByEndpoint = new Map<string, ChainGraphEdge[]>()

  edges.forEach((edge, index) => {
    originalOrder.set(edge, index)
    const key = `${edge.source}\0${edge.target}`
    const group = edgesByEndpoint.get(key)
    if (group) group.push(edge)
    else edgesByEndpoint.set(key, [edge])
  })

  const labelByEdge = new Map<ChainGraphEdge, string>()
  for (const group of edgesByEndpoint.values()) {
    const sorted = [...group].sort((left, right) => {
      if (left.relatedTransactionMountTimestamp < right.relatedTransactionMountTimestamp) return -1
      if (left.relatedTransactionMountTimestamp > right.relatedTransactionMountTimestamp) return 1
      return (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0)
    })
    sorted.forEach((edge, index) => {
      labelByEdge.set(edge, `第${index + 1}笔 ${formatAmount(edge.amount, edge.currencyType)}`)
    })
  }

  return edges.map((edge) => {
    const label = labelByEdge.get(edge) ?? formatAmount(edge.amount, edge.currencyType)
    return edge.label === label ? edge : { ...edge, label }
  })
}

function mergeBaseNode(left: ChainGraphNode, right: ChainGraphNode): ChainGraphNode {
  const volumeByCurrency = new Map(left.volumeByCurrency)
  for (const [currencyType, amount] of right.volumeByCurrency) {
    addAmount(volumeByCurrency, currencyType, amount)
  }
  return {
    ...left,
    chainCount: left.chainCount + right.chainCount,
    position: left.position ?? right.position,
    volumeByCurrency,
  }
}

// Build a local flow canvas node; when base exists, keep its chain metrics and position.
function localFlowGraphNode(
  ref: LocalNodeRef,
  index: number,
  base?: ChainGraphNode,
): ChainGraphNode {
  return {
    id: ref.publicKeyHex,
    label: flowNodeDisplayName(ref, index),
    chainCount: base?.chainCount ?? 0,
    // Copy the base map so the upgraded local node does not share mutable graph state.
    volumeByCurrency: new Map<number, bigint>(base?.volumeByCurrency),
    kind: 'local-flow',
    position: base?.position ?? ref.position,
    flowStatus: flowNodeCanvasStatus(ref),
  }
}

function localConsumeGraphNode(ref: LocalNodeRef, base?: ChainGraphNode): ChainGraphNode {
  return {
    id: ref.publicKeyHex,
    label: shortId(ref.id),
    chainCount: base?.chainCount ?? 0,
    volumeByCurrency: new Map<number, bigint>(base?.volumeByCurrency),
    kind: 'local-consume',
    position: base?.position ?? ref.position,
  }
}
