import type {
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainQuery,
  ConsumeChainResponseDTO,
} from './types'
import { readGraphTokens } from './tokens'

export function buildGraphFromConsumeChains(rows: ConsumeChainResponseDTO[]): ChainGraph {
  const nodes = new Map<string, ChainGraphNode>()
  const edges: ChainGraphEdge[] = []

  for (const row of rows) {
    touchNode(nodes, row.consumeChain.start, row.consumeChain.amount)

    for (const edge of row.consumeChainEdges) {
      touchNode(nodes, edge.source, edge.amount)
      touchNode(nodes, edge.target, edge.amount)
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

    touchNode(nodes, row.consumeChain.end, row.consumeChain.amount)
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    stats: {
      totalChains: rows.length,
      loopedChains: rows.filter((row) => row.consumeChain.isLoop).length,
      openChains: rows.filter((row) => !row.consumeChain.isLoop).length,
      volume: rows.reduce((sum, row) => sum + row.consumeChain.amount, 0n),
      currencyType: rows[0]?.consumeChain.currencyType ?? 1,
    },
  }
}

// 展示用：还原 SDK queryConsumeChains 实际请求的 URL（集合根 + id 模式查询参数）。
export function buildConsumeChainUrl(baseUrl: string, query: ConsumeChainQuery): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const nodeParamByMode: Record<ConsumeChainQuery['mode'], string> = {
    start: 'startId',
    end: 'endId',
    node: 'nodeId',
  }
  const params = new URLSearchParams()
  params.set(nodeParamByMode[query.mode], query.nodeId)

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

export function chainColor(chainId: string): string {
  const chainPalette = readGraphTokens().chainPalette
  let hash = 0
  for (let index = 0; index < chainId.length; index += 1) {
    hash = (hash * 31 + chainId.charCodeAt(index)) >>> 0
  }
  return chainPalette[hash % chainPalette.length] ?? '#0f766e'
}

function touchNode(nodes: Map<string, ChainGraphNode>, id: string, amount: bigint): void {
  const existing = nodes.get(id)
  if (existing) {
    existing.chainCount += 1
    existing.volume += amount
    return
  }

  nodes.set(id, {
    id,
    label: shortId(id),
    chainCount: 1,
    volume: amount,
  })
}
