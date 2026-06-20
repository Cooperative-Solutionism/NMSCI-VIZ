import type { ChainGraphEdge } from '../../lib/types'
import type { GraphHighlightMode } from './graphViewState'

export function highlightedChainsForMode(
  mode: GraphHighlightMode,
  selectedChainIds: ReadonlySet<string>,
  cycleChainIds: ReadonlySet<string>,
): ReadonlySet<string> {
  return mode === 'cycles' ? cycleChainIds : selectedChainIds
}

export function cycleEndpointIds(
  edges: readonly ChainGraphEdge[],
  cycleChainIds: ReadonlySet<string>,
): Set<string> {
  const endpointIds = new Set<string>()
  for (const edge of edges) {
    if (!cycleChainIds.has(edge.chainId)) continue
    endpointIds.add(edge.source)
    endpointIds.add(edge.target)
  }
  return endpointIds
}
