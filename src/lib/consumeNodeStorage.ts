// 本地消费节点钥匙串。消费节点无注册/授权（仅一对密钥，由 consumeNodePubkey 标识），
// 故结构是 flowNodeStorage 的精简镜像。
export interface LocalConsumeNode {
  id: string
  label: string
  publicKeyHex: string
  privateKeyHex: string
  createdAt: string
  updatedAt: string
  position?: { x: number; y: number }
}

interface ConsumeNodeStorageDocument {
  version: 1
  nodes: LocalConsumeNode[]
}

export const consumeNodeStorageKey = 'nmsci.consumeNodes.v1'

export function loadLocalConsumeNodes(storage: Storage = window.localStorage): LocalConsumeNode[] {
  const raw = storage.getItem(consumeNodeStorageKey)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Partial<ConsumeNodeStorageDocument>
    if (parsed.version !== 1 || !Array.isArray(parsed.nodes)) return []
    return parsed.nodes.filter(isLocalConsumeNode)
  } catch {
    return []
  }
}

export function saveLocalConsumeNodes(
  nodes: LocalConsumeNode[],
  storage: Storage = window.localStorage,
): void {
  const document: ConsumeNodeStorageDocument = { version: 1, nodes }
  storage.setItem(consumeNodeStorageKey, JSON.stringify(document))
}

export function patchLocalConsumeNode(
  nodes: LocalConsumeNode[],
  id: string,
  patch: Partial<LocalConsumeNode>,
): LocalConsumeNode[] {
  return nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
}

function isLocalConsumeNode(value: unknown): value is LocalConsumeNode {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LocalConsumeNode
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.publicKeyHex === 'string'
    && typeof candidate.privateKeyHex === 'string'
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
}
