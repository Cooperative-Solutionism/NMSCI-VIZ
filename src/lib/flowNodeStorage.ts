import type { EncryptedSecret, SecretCodec } from './keyVault'

export interface LocalFlowNodeRegistration {
  id: string
  rawBytesHex: string
  registerDifficultyTarget: string
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
  // 画布落点（右键添加时记录），用于在图上稳定定位本地节点。
  position?: { x: number; y: number }
  registration?: LocalFlowNodeRegistration
  authorizations: LocalFlowNodeAuthorization[]
}

// 存储形态：保险库启用时私钥以密文 privateKey 落盘（pubkey/label 等元数据保持明文，便于免解锁渲染）。
// 保险库关闭（codec 为 null）时私钥以明文 privateKeyHex 落盘；该字段同时承担旧版明文遗留，
// 加载时透传、启用并解锁后下次保存即被加密迁移。
type StoredFlowNode = Omit<LocalFlowNode, 'privateKeyHex'> & {
  privateKey?: EncryptedSecret
  privateKeyHex?: string
}

interface FlowNodeStorageDocument {
  version: 1
  nodes: StoredFlowNode[]
}

export const flowNodeStorageKey = 'nmsci.flowNodes.v1'

// 载入：codec 非空时密文私钥经其解密为内存态 privateKeyHex；codec 为 null（保险库关闭）
// 或旧版明文节点直接透传 privateKeyHex。关闭态遇到仅有密文的节点（无法解密）则跳过。
export async function loadLocalFlowNodes(
  codec: SecretCodec | null,
  storage: Storage = window.localStorage,
): Promise<LocalFlowNode[]> {
  const raw = storage.getItem(flowNodeStorageKey)
  if (!raw) return []

  let parsed: Partial<FlowNodeStorageDocument>
  try {
    parsed = JSON.parse(raw) as Partial<FlowNodeStorageDocument>
  } catch {
    return []
  }
  if (parsed.version !== 1 || !Array.isArray(parsed.nodes)) return []

  const nodes: LocalFlowNode[] = []
  for (const stored of parsed.nodes) {
    if (!isStoredFlowNode(stored)) continue
    const privateKeyHex =
      codec && stored.privateKey ? await codec.decrypt(stored.privateKey) : stored.privateKeyHex
    if (typeof privateKeyHex !== 'string') continue
    const { privateKey: _enc, privateKeyHex: _legacy, ...rest } = stored
    nodes.push({ ...rest, privateKeyHex })
  }
  return nodes
}

// 保存：codec 非空时内存态 privateKeyHex 经其加密为密文 privateKey 落盘，明文不入 localStorage；
// codec 为 null（保险库关闭）时私钥以明文 privateKeyHex 落盘。
export async function saveLocalFlowNodes(
  nodes: LocalFlowNode[],
  codec: SecretCodec | null,
  storage: Storage = window.localStorage,
): Promise<void> {
  const stored: StoredFlowNode[] = []
  for (const node of nodes) {
    const { privateKeyHex, ...rest } = node
    stored.push(codec ? { ...rest, privateKey: await codec.encrypt(privateKeyHex) } : { ...rest, privateKeyHex })
  }
  const document: FlowNodeStorageDocument = { version: 1, nodes: stored }
  storage.setItem(flowNodeStorageKey, JSON.stringify(document))
}

// 是否存在旧版明文私钥（用于解锁后一次性加密迁移的判定）。
export function hasLegacyPlaintextFlowNodes(storage: Storage = window.localStorage): boolean {
  return countLegacyPlaintext(storage.getItem(flowNodeStorageKey)) > 0
}

function countLegacyPlaintext(raw: string | null): number {
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as Partial<FlowNodeStorageDocument>
    if (!Array.isArray(parsed.nodes)) return 0
    return parsed.nodes.filter((node) => typeof node?.privateKeyHex === 'string').length
  } catch {
    return 0
  }
}

export function patchLocalFlowNode(
  nodes: LocalFlowNode[],
  id: string,
  patch: Partial<LocalFlowNode>,
): LocalFlowNode[] {
  return nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))
}

function isStoredFlowNode(value: unknown): value is StoredFlowNode {
  if (!value || typeof value !== 'object') return false
  const candidate = value as StoredFlowNode
  const hasSecret =
    (candidate.privateKey != null && typeof candidate.privateKey === 'object')
    || typeof candidate.privateKeyHex === 'string'
  return typeof candidate.id === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.publicKeyHex === 'string'
    && hasSecret
    && typeof candidate.createdAt === 'string'
    && typeof candidate.updatedAt === 'string'
    && Array.isArray(candidate.authorizations)
}
