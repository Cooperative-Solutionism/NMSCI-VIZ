// 后端 DTO 类型统一从 @nmsci/sdk 复用，避免与 SDK 漂移。
export type {
  ApiResponse,
  SliceResponseDTO,
  BlockInfoRaw,
  FlowNodeRegisterMsgRaw,
  CentralPubkeyEmpowerMsgRaw,
  ConsumeChainRaw,
  ConsumeChainResponseDTO,
  ConsumeChainEdgeRaw,
  ConsumeChainResponseDTORaw,
} from '@nmsci/sdk'

// 以下为可视化专属类型（非后端 DTO）。
export type QueryMode = 'start' | 'end' | 'node'
export type LoopStatus = 'all' | 'looped' | 'open'
export type EdgeStatus = 'looped' | 'open'
export type IdentityKind = 'id' | 'pubkey'

// 按币种归集的金额（key = currencyType）。混币求和无意义，故所有聚合都按币种分桶。
export type VolumeByCurrency = Map<number, bigint>

export interface ChainGraphNode {
  id: string
  label: string
  chainCount: number
  // 节点吞吐量 = 关联边金额之和，按币种分桶（不再把链额与边额重复计入同一节点）。
  volumeByCurrency: VolumeByCurrency
}

export interface ChainGraphEdge {
  id: string
  source: string
  target: string
  label: string
  amount: bigint
  currencyType: number
  chainId: string
  status: EdgeStatus
  color: string
  relatedTransactionRecord: string
  relatedTransactionMount: string
  relatedTransactionMountTimestamp: bigint
}

export interface ChainGraphStats {
  totalChains: number
  loopedChains: number
  openChains: number
  // 总流量按币种分桶（CNY 分 与 Au 微克 不可相加）。
  volumeByCurrency: VolumeByCurrency
}

export interface ChainGraph {
  nodes: ChainGraphNode[]
  edges: ChainGraphEdge[]
  stats: ChainGraphStats
}

export interface ConsumeChainQuery {
  mode: QueryMode
  nodeId: string
  loopStatus: LoopStatus
  page: number
  size: number
}
