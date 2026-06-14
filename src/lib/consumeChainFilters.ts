import type { ConsumeChainQueryFilters } from '@nmsci/sdk'
import type { IdentityKind, LoopStatus, QueryMode } from './types'

export function statusLabel(status: LoopStatus): string {
  if (status === 'looped') return 'Looped'
  if (status === 'open') return 'Open'
  return 'All'
}

// 压缩 secp256k1 公钥固定为 33 字节 = 66 个 hex 字符；其余（含 36 位 UUID）按 id 处理。
// 后端会把 pubkey 解析为对应流转节点 id 后再查询（API.md §1.7），因此运维只持有公钥也能直接检索。
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

// 还原 SDK queryConsumeChains 实际命中的查询参数名（mode × id/pubkey）。
export function consumeChainParamName(mode: QueryMode, kind: IdentityKind): string {
  if (mode === 'start') return kind === 'pubkey' ? 'startPubkey' : 'startId'
  if (mode === 'end') return kind === 'pubkey' ? 'endPubkey' : 'endId'
  return kind === 'pubkey' ? 'nodePubkey' : 'nodeId'
}
