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

// 反转 rowsToJson：把导出的消费链 JSON 解析回 ConsumeChainResponseDTO[]（导入外部节点-文件来源）。
// 不能直接走 SDK 的 normalize——其 toSafeBigInt 仅接受 number，会拒绝导出时被序列化成字符串的金额。
// BigInt() 同时接受数字与数字字符串，故导出文件（字符串）与原始后端 JSON（数字）都能解析。
// 逐行容错：坏行跳过并计数，与 normalizeRowsSafely 的 {content, skipped} 形状保持一致。
export function parseExportedConsumeChainsJson(text: string): {
  content: ConsumeChainResponseDTO[]
  skipped: number
} {
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed)) {
    throw new Error('JSON 顶层必须是消费链数组。')
  }
  const content: ConsumeChainResponseDTO[] = []
  let skipped = 0
  for (const raw of parsed) {
    try {
      content.push(reviveConsumeChainRow(raw))
    } catch {
      skipped += 1
    }
  }
  return { content, skipped }
}

function reviveConsumeChainRow(raw: unknown): ConsumeChainResponseDTO {
  if (typeof raw !== 'object' || raw === null) throw new Error('行不是对象。')
  const row = raw as Record<string, unknown>
  const chain = row.consumeChain as Record<string, unknown> | undefined
  const edges = row.consumeChainEdges
  if (!chain || !Array.isArray(edges)) {
    throw new Error('缺少 consumeChain 或 consumeChainEdges。')
  }
  return {
    consumeChain: {
      id: String(chain.id),
      start: String(chain.start),
      end: String(chain.end),
      amount: BigInt(chain.amount as string | number),
      currencyType: Number(chain.currencyType),
      isLoop: Boolean(chain.isLoop),
      tailMountTimestamp: BigInt(chain.tailMountTimestamp as string | number),
    },
    consumeChainEdges: edges.map((edge) => {
      const e = edge as Record<string, unknown>
      return {
        id: String(e.id),
        source: String(e.source),
        target: String(e.target),
        amount: BigInt(e.amount as string | number),
        currencyType: Number(e.currencyType),
        chain: String(e.chain),
        relatedTransactionRecord: String(e.relatedTransactionRecord),
        relatedTransactionMount: String(e.relatedTransactionMount),
        relatedTransactionMountTimestamp: BigInt(
          e.relatedTransactionMountTimestamp as string | number,
        ),
        isLoop: Boolean(e.isLoop),
      }
    }),
  }
}

export function toCurl(url: string): string {
  return `curl '${url.replace(/'/g, "'\\''")}'`
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
