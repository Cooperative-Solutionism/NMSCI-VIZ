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

// 画布节点来源：来自查询的链节点，或本地密钥（流转/消费）叠加层。
export type NodeKind = 'chain' | 'local-flow' | 'local-consume'

// 本地流转节点在画布上的注册/授权状态标签。
// 后端没有“注册失败”这一节点状态：注册失败的节点回退为未注册（见 flowNodeCanvasStatus）。
export type FlowNodeCanvasStatus = 'unregistered' | 'registered' | 'authorized'

export interface CanvasPosition {
  x: number
  y: number
}

// 按币种归集的金额（key = currencyType）。混币求和无意义，故所有聚合都按币种分桶。
export type VolumeByCurrency = Map<number, bigint>

export interface ChainGraphNode {
  id: string
  label: string
  chainCount: number
  // 节点吞吐量 = 关联边金额之和，按币种分桶（不再把链额与边额重复计入同一节点）。
  volumeByCurrency: VolumeByCurrency
  kind: NodeKind
  // 本地节点的画布落点（右键添加时记录）；链节点无此字段，由布局算法定位。
  position?: CanvasPosition
  // 本地流转节点的注册/授权状态，用于画布上的状态标签；其他节点无此字段。
  flowStatus?: FlowNodeCanvasStatus
}

// 总计模式下，合并同 source→target 的多条链边后挂在边上的汇总数据。
export interface AggregatedEdgeMetrics {
  totalAmount: bigint
  loopedAmount: bigint
  // 回流率 = 成环金额 / 总金额（0~1）；总金额为 0 时为 0。
  reflowRate: number
  edgeCount: number
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
  // 仅在总计模式合并边上存在；详细模式的逐段边无此字段。
  aggregated?: AggregatedEdgeMetrics
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
