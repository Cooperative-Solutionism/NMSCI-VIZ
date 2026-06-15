import type { ChainGraphEdge, ConsumeChainResponseDTO } from './types'

const CSV_HEADER = [
  'chainId',
  'edgeId',
  'source',
  'target',
  'amount',
  'currencyType',
  'status',
  'record',
  'mount',
  'mountTimestamp',
]

// 把当前图的边导出为 CSV，便于分析师把发现带出工具（表格/报表/工单）。
export function edgesToCsv(edges: ChainGraphEdge[]): string {
  const lines = [CSV_HEADER]
  for (const edge of edges) {
    lines.push([
      edge.chainId,
      edge.id,
      edge.source,
      edge.target,
      edge.amount.toString(),
      String(edge.currencyType),
      edge.status,
      edge.relatedTransactionRecord,
      edge.relatedTransactionMount,
      edge.relatedTransactionMountTimestamp.toString(),
    ])
  }
  return lines.map((cells) => cells.map(csvCell).join(',')).join('\n')
}

// 把消费链原始结果导出为 JSON（bigint 转字符串，避免序列化失败）。
export function rowsToJson(rows: ConsumeChainResponseDTO[]): string {
  return JSON.stringify(rows, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value), 2)
}

export function toCurl(url: string): string {
  return `curl '${url.replace(/'/g, "'\\''")}'`
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
