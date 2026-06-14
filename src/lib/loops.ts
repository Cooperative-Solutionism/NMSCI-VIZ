import type { ConsumeChainResponseDTO } from './types'

// 一条成环（循环交易）消费链的摘要。环路即该链本身：其边集合构成 start→…→end→start 的回路。
export interface LoopSummary {
  chainId: string
  start: string
  end: string
  length: number
  amount: bigint
  currencyType: number
  tailMountTimestamp: bigint
  edgeIds: string[]
  firstEdgeId: string | null
}

export type LoopSort = 'amount' | 'length' | 'recency'

export function extractLoops(rows: ConsumeChainResponseDTO[]): LoopSummary[] {
  const loops: LoopSummary[] = []
  for (const row of rows) {
    if (!row.consumeChain.isLoop) continue
    const edgeIds = row.consumeChainEdges.map((edge) => edge.id)
    loops.push({
      chainId: row.consumeChain.id,
      start: row.consumeChain.start,
      end: row.consumeChain.end,
      length: row.consumeChainEdges.length,
      amount: row.consumeChain.amount,
      currencyType: row.consumeChain.currencyType,
      tailMountTimestamp: row.consumeChain.tailMountTimestamp,
      edgeIds,
      firstEdgeId: edgeIds[0] ?? null,
    })
  }
  return loops
}

export function sortLoops(loops: LoopSummary[], sort: LoopSort): LoopSummary[] {
  const copy = [...loops]
  if (sort === 'length') {
    return copy.sort((a, b) => b.length - a.length)
  }
  if (sort === 'recency') {
    return copy.sort((a, b) => compareBigint(b.tailMountTimestamp, a.tailMountTimestamp))
  }
  return copy.sort((a, b) => compareBigint(b.amount, a.amount))
}

function compareBigint(a: bigint, b: bigint): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
