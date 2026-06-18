import type { ConsumeChainQueryFilters } from '@nmsci/sdk'
import type { IdentityKind, LoopStatus, QueryMode } from './types'

export function statusLabel(status: LoopStatus): string {
  if (status === 'looped') return '成环'
  if (status === 'open') return '开放'
  return '全部'
}

export function detectIdentityKind(value: string): IdentityKind {
  return /^[0-9a-fA-F]{66}$/.test(value.trim()) ? 'pubkey' : 'id'
}

export function consumeChainFilters(
  mode: QueryMode,
  value: string,
  loopStatus: LoopStatus,
): ConsumeChainQueryFilters {
  const isLoop = loopStatus === 'all' ? undefined : loopStatus === 'looped'
  const trimmed = value.trim()
  const kind = detectIdentityKind(trimmed)
  if (mode === 'start') {
    return kind === 'pubkey' ? { startPubkey: trimmed, isLoop } : { startId: trimmed, isLoop }
  }
  if (mode === 'end') {
    return kind === 'pubkey' ? { endPubkey: trimmed, isLoop } : { endId: trimmed, isLoop }
  }
  return kind === 'pubkey' ? { nodePubkey: trimmed, isLoop } : { nodeId: trimmed, isLoop }
}

export function consumeChainParamName(mode: QueryMode, kind: IdentityKind): string {
  if (mode === 'start') return kind === 'pubkey' ? 'startPubkey' : 'startId'
  if (mode === 'end') return kind === 'pubkey' ? 'endPubkey' : 'endId'
  return kind === 'pubkey' ? 'nodePubkey' : 'nodeId'
}
