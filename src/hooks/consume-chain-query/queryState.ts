import { normalizeConsumeChainResponseDTO } from '@nmsci/sdk'
import type {
  ChainGraph,
  ChainGraphEdge,
  ChainGraphNode,
  ConsumeChainResponseDTO,
  ConsumeChainResponseDTORaw,
  LoopStatus,
} from '../../lib/types'

export type CurrencyFilter = 'all' | '1' | '0'
export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string }
export type DataOrigin = 'idle' | 'backend'
export type RunQueryOverride = { mode: 'start' | 'end' | 'node'; nodeId: string }

export function filterConsumeChainRows(
  rows: ConsumeChainResponseDTO[],
  currencyFilter: CurrencyFilter,
  loopStatus: LoopStatus,
): ConsumeChainResponseDTO[] {
  return rows.filter((row) => {
    const currencyMatches =
      currencyFilter === 'all' || row.consumeChain.currencyType === Number(currencyFilter)
    const loopMatches =
      loopStatus === 'all' || row.consumeChain.isLoop === (loopStatus === 'looped')
    return currencyMatches && loopMatches
  })
}

export function resolveEffectiveSelection(
  graph: ChainGraph,
  selection: Selection | null,
): Selection | null {
  if (selection?.kind === 'edge' && graph.edges.some((edge) => edge.id === selection.id)) {
    return selection
  }
  if (selection?.kind === 'node' && graph.nodes.some((node) => node.id === selection.id)) {
    return selection
  }
  if (graph.edges[0]) return { kind: 'edge', id: graph.edges[0].id }
  if (graph.nodes[0]) return { kind: 'node', id: graph.nodes[0].id }
  return null
}

export function findSelectedEdge(
  graphEdges: ChainGraphEdge[],
  effectiveSelection: Selection | null,
): ChainGraphEdge | null {
  if (effectiveSelection?.kind !== 'edge') return null
  return graphEdges.find((edge) => edge.id === effectiveSelection.id) ?? null
}

export function findSelectedNode(
  graphNodes: ChainGraphNode[],
  effectiveSelection: Selection | null,
): ChainGraphNode | null {
  if (effectiveSelection?.kind !== 'node') return null
  return graphNodes.find((node) => node.id === effectiveSelection.id) ?? null
}

export function findSelectedChain(
  rows: ConsumeChainResponseDTO[],
  selectedEdge: ChainGraphEdge | null,
): ConsumeChainResponseDTO | null {
  if (!selectedEdge) return null
  return rows.find((row) => row.consumeChain.id === selectedEdge.chainId) ?? null
}

export function normalizeRowsSafely(rawRows: ConsumeChainResponseDTORaw[]): {
  content: ConsumeChainResponseDTO[]
  skipped: number
} {
  const content: ConsumeChainResponseDTO[] = []
  let skipped = 0
  for (const raw of rawRows) {
    try {
      content.push(normalizeConsumeChainResponseDTO(raw))
    } catch {
      skipped += 1
    }
  }
  return { content, skipped }
}

export function skipWarning(skipped: number): string | null {
  if (skipped <= 0) return null
  return `已跳过 ${skipped} 条链路：金额超过精度安全范围（2^53）。`
}
