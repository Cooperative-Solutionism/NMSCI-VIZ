// 后端 DTO 类型统一从 @nmsci/sdk 复用，避免与 SDK 漂移。
export type {
  ApiResponse,
  SliceResponseDTO,
  BlockInfoRaw,
  FlowNodeRegisterMsgRaw,
  CentralPubkeyEmpowerMsgRaw,
  ConsumeChainRaw,
  ConsumeChainEdgeRaw,
  ConsumeChainResponseDTORaw,
} from '@nmsci/sdk'

// 以下为可视化专属类型（非后端 DTO）。
export type QueryMode = 'start' | 'end' | 'node'
export type LoopStatus = 'all' | 'looped' | 'open'
export type EdgeStatus = 'looped' | 'open'

export interface ChainGraphNode {
  id: string
  label: string
  chainCount: number
  volume: number
}

export interface ChainGraphEdge {
  id: string
  source: string
  target: string
  label: string
  amount: number
  currencyType: number
  chainId: string
  status: EdgeStatus
  color: string
  relatedTransactionRecord: string
  relatedTransactionMount: string
  relatedTransactionMountTimestamp: number
}

export interface ChainGraphStats {
  totalChains: number
  loopedChains: number
  openChains: number
  volume: number
  currencyType: number
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
