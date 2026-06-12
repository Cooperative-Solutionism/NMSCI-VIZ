export type QueryMode = 'start' | 'end'
export type LoopStatus = 'all' | 'looped' | 'open'
export type EdgeStatus = 'looped' | 'open'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface SliceResponseDTO<T> {
  content: T[]
  page: number
  size: number
  numberOfElements: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface ConsumeChainRaw {
  id: string
  start: string
  end: string
  amount: number
  currencyType: number
  isLoop: boolean
  tailMountTimestamp: number
}

export interface ConsumeChainEdgeRaw {
  id: string
  source: string
  target: string
  amount: number
  currencyType: number
  chain: string
  relatedTransactionRecord: string
  relatedTransactionMount: string
  relatedTransactionMountTimestamp: number
  isLoop: boolean
}

export interface ConsumeChainResponseDTORaw {
  consumeChain: ConsumeChainRaw
  consumeChainEdges: ConsumeChainEdgeRaw[]
}

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
