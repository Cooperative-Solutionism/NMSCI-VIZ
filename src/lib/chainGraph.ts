import type {
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainQuery,
  ConsumeChainResponseDTO,
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
    return `${normalizedAmount.toLocaleString()} ug Au`
  }
  return `${normalizedAmount.toLocaleString()} #${currencyType}`
}

// 把按币种分桶的金额渲染成单行（"125.00 CNY · 2,500,000 ug Au"）。空桶显示 0。
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
  })
}
