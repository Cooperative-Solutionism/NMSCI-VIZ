import type { ConsumeChainQueryFilters } from '@nmsci/sdk'
import type { LoopStatus, QueryMode } from './types'

export function statusLabel(status: LoopStatus): string {
  if (status === 'looped') return 'Looped'
  if (status === 'open') return 'Open'
  return 'All'
}

export function consumeChainFilters(
  mode: QueryMode,
  nodeId: string,
  loopStatus: LoopStatus,
): ConsumeChainQueryFilters {
  const isLoop = loopStatus === 'all' ? undefined : loopStatus === 'looped'
  if (mode === 'start') return { startId: nodeId, isLoop }
  if (mode === 'end') return { endId: nodeId, isLoop }
  return { nodeId, isLoop }
}
