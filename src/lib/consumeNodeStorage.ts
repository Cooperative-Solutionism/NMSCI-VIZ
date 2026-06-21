import type { EncryptedSecret, SecretCodec } from './keyVault'

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

// 存储形态：保险库启用时私钥以密文 privateKey 落盘；关闭（codec 为 null）时以明文 privateKeyHex 落盘。
// privateKeyHex 同时承担旧版明文遗留，加载透传、启用解锁后保存即加密迁移。
type StoredConsumeNode = Omit<LocalConsumeNode, 'privateKeyHex'> & {
  privateKey?: EncryptedSecret
  privateKeyHex?: string
}

interface ConsumeNodeStorageDocument {
  version: 1
  nodes: StoredConsumeNode[]
}

export const consumeNodeStorageKey = 'nmsci.consumeNodes.v1'

export async function loadLocalConsumeNodes(
  codec: SecretCodec | null,
  storage: Storage = window.localStorage,
): Promise<LocalConsumeNode[]> {
  const raw = storage.getItem(consumeNodeStorageKey)
  if (!raw) return []

  let parsed: Partial<ConsumeNodeStorageDocument>
  try {
    parsed = JSON.parse(raw) as Partial<ConsumeNodeStorageDocument>
  } catch {
    return []
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.nodes)) return []

  const nodes: LocalConsumeNode[] = []
  for (const stored of parsed.nodes) {
    if (!isStoredConsumeNode(stored)) continue
    const privateKeyHex =
      codec && stored.privateKey ? await codec.decrypt(stored.privateKey) : stored.privateKeyHex
    if (typeof privateKeyHex !== 'string') continue
    const { privateKey: _enc, privateKeyHex: _legacy, ...rest } = stored
    nodes.push({ ...rest, privateKeyHex })
  }
  return nodes
}

export async function saveLocalConsumeNodes(
  nodes: LocalConsumeNode[],
  codec: SecretCodec | null,
  storage: Storage = window.localStorage,
): Promise<void> {
  if (!codec) {
    saveLocalConsumeNodesPlaintext(nodes, storage)
    return
  }
  const stored: StoredConsumeNode[] = []
  for (const node of nodes) {
    const { privateKeyHex, ...rest } = node
    stored.push({ ...rest, privateKey: await codec.encrypt(privateKeyHex) })
  }
  const document: ConsumeNodeStorageDocument = { version: 1, nodes: stored }
  storage.setItem(consumeNodeStorageKey, JSON.stringify(document))
}

export function saveLocalConsumeNodesPlaintext(
  nodes: LocalConsumeNode[],
  storage: Storage = window.localStorage,
): void {
  const stored: StoredConsumeNode[] = nodes.map((node) => {
    const { privateKeyHex, ...rest } = node
    return { ...rest, privateKeyHex }
  })
  const document: ConsumeNodeStorageDocument = { version: 1, nodes: stored }
  storage.setItem(consumeNodeStorageKey, JSON.stringify(document))
}

export function hasLegacyPlaintextConsumeNodes(storage: Storage = window.localStorage): boolean {
  const raw = storage.getItem(consumeNodeStorageKey)
  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as Partial<ConsumeNodeStorageDocument>
    if (!Array.isArray(parsed.nodes)) return false
    return parsed.nodes.some((node) => typeof node?.privateKeyHex === 'string')
  } catch {
    return false
  }
}

export function patchLocalConsumeNode(
  nodes: LocalConsumeNode[],
  id: string,
  patch: Partial<LocalConsumeNode>,
): LocalConsumeNode[] {
  return nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
}

function isStoredConsumeNode(value: unknown): value is StoredConsumeNode {
  if (!value || typeof value !== 'object') return false
  const candidate = value as StoredConsumeNode
  const hasSecret =
    (candidate.privateKey != null && typeof candidate.privateKey === 'object')
    || typeof candidate.privateKeyHex === 'string'
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.publicKeyHex === 'string'
    && hasSecret
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
}
