export interface LocalFlowNodeRegistration {
  id: string
  rawBytesHex: string
  registerDifficultyTarget: number
  nonce: number
  txid?: string
  status: 'sent' | 'failed'
  message?: string
  updatedAt: string
}

export interface LocalFlowNodeAuthorization {
  id: string
  centralPubkeyHex: string
  rawBytesHex: string
  txid?: string
  status: 'sent' | 'failed'
  message?: string
  updatedAt: string
}

export interface LocalFlowNode {
  id: string
  label: string
  publicKeyHex: string
  privateKeyHex: string
  createdAt: string
  updatedAt: string
  registration?: LocalFlowNodeRegistration
  authorizations: LocalFlowNodeAuthorization[]
}

interface FlowNodeStorageDocument {
  version: 1
  nodes: LocalFlowNode[]
}

export const flowNodeStorageKey = 'nmsci.flowNodes.v1'

export function loadLocalFlowNodes(storage: Storage = window.localStorage): LocalFlowNode[] {
  const raw = storage.getItem(flowNodeStorageKey)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Partial<FlowNodeStorageDocument>
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes)) return []
    return parsed.nodes.filter(isLocalFlowNode)
  } catch {
    return []
  }
}

export function saveLocalFlowNodes(
  nodes: LocalFlowNode[],
  storage: Storage = window.localStorage,
): void {
  const document: FlowNodeStorageDocument = {
    version: 1,
    nodes,
  }
  storage.setItem(flowNodeStorageKey, JSON.stringify(document))
}

export function upsertLocalFlowNode(
  node: LocalFlowNode,
  storage: Storage = window.localStorage,
): LocalFlowNode[] {
  const nodes = loadLocalFlowNodes(storage)
  const existingIndex = nodes.findIndex((currentNode) => currentNode.id === node.id)
  if (existingIndex >= 0) {
    nodes[existingIndex] = node
  } else {
    nodes.unshift(node)
  }
  saveLocalFlowNodes(nodes, storage)
  return nodes
}

function isLocalFlowNode(value: unknown): value is LocalFlowNode {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LocalFlowNode
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.publicKeyHex === 'string'
    && typeof candidate.privateKeyHex === 'string'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && Array.isArray(candidate.authorizations)
}
