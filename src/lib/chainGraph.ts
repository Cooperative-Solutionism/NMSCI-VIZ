import type {
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainQuery,
  ConsumeChainResponseDTORaw,
  EdgeStatus,
} from './types'

export function buildGraphFromConsumeChains(rows: ConsumeChainResponseDTORaw[]): ChainGraph {
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
      volume: rows.reduce((sum, row) => sum + row.consumeChain.amount, 0),
      currencyType: rows[0]?.consumeChain.currencyType ?? 1,
    },
  }
}

export function buildConsumeChainUrl(baseUrl: string, query: ConsumeChainQuery): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const endpointByMode: Record<ConsumeChainQuery['mode'], string> = {
    start: '/consume-chain/by-start',
    end: '/consume-chain/by-end',
    node: '/consume-chain/by-node',
  }
  const nodeParamByMode: Record<ConsumeChainQuery['mode'], string> = {
    start: 'start',
    end: 'end',
    node: 'node',
  }
  const endpoint = endpointByMode[query.mode]
  const nodeParam = nodeParamByMode[query.mode]
  const params = new URLSearchParams()
  params.set(nodeParam, query.nodeId)

  if (query.loopStatus !== 'all') {
    params.set('isLoop', String(query.loopStatus === 'looped'))
  }

  params.set('page', String(query.page))
  params.set('size', String(query.size))

  return `${normalizedBaseUrl}${endpoint}?${params.toString()}`
}

export function shortId(id: string): string {
  return id.slice(0, 6).toUpperCase()
}

export function mergeConsumeChains(
  currentRows: ConsumeChainResponseDTORaw[],
  nextRows: ConsumeChainResponseDTORaw[],
): ConsumeChainResponseDTORaw[] {
  const rowsByChainId = new Map<string, ConsumeChainResponseDTORaw>()
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

export function formatAmount(amount: number, currencyType: number): string {
  if (currencyType === 1) {
    return `${(amount / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} CNY`
  }
  if (currencyType === 0) {
    return `${amount.toLocaleString()} ug Au`
  }
  return `${amount.toLocaleString()} #${currencyType}`
}

export function edgeColor(status: EdgeStatus): string {
  return status === 'looped' ? '#178f69' : '#d88a21'
}

function touchNode(nodes: Map<string, ChainGraphNode>, id: string, amount: number): void {
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
