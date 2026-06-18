import type {
  CanvasPosition,
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainQuery,
  ConsumeChainResponseDTO,
  NodeKind,
  VolumeByCurrency,
} from './types'
import { dashboardQueryPage, dashboardQuerySize } from '../app/config'
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
    edges,
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

  params.set('page', String(dashboardQueryPage))
  params.set('size', String(dashboardQuerySize))

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
  }
}

export function flowNodeDisplayName(node: LocalNodeRef, index: number): string {
  return node.registration?.id ? shortId(node.registration.id) : `未注册${index + 1}`
}

// 把本地密钥节点（流转/消费）叠加到查询得到的链图上，使其直接显示在画布、可在无查询结果时先建后查。
// 以 pubkey 为 id；与链节点的 UUID id 不会冲突。
export function mergeLocalNodes(
  graph: ChainGraph,
  flowNodes: LocalNodeRef[],
  consumeNodes: LocalNodeRef[],
): ChainGraph {
  const seen = new Set(graph.nodes.map((node) => node.id))
  const extra: ChainGraphNode[] = []
  const append = (
    refs: LocalNodeRef[],
    kind: NodeKind,
    labelForNode: (node: LocalNodeRef, index: number) => string,
  ): void => {
    refs.forEach((ref, index) => {
      if (seen.has(ref.publicKeyHex)) return
      seen.add(ref.publicKeyHex)
      extra.push({
        id: ref.publicKeyHex,
        label: labelForNode(ref, index),
        chainCount: 0,
        volumeByCurrency: new Map(),
        kind,
        position: ref.position,
      })
    })
  }
  append(flowNodes, 'local-flow', flowNodeDisplayName)
  append(consumeNodes, 'local-consume', (ref) => shortId(ref.id))
  if (extra.length === 0) return graph
  return { ...graph, nodes: [...graph.nodes, ...extra] }
}
