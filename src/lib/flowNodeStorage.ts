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

// 存储形态：私钥以密文 privateKey 落盘（pubkey/label 等元数据保持明文，便于免解锁渲染）。
// privateKeyHex 仅为旧版明文遗留字段，加载时透传、下次保存即被加密迁移。
type StoredFlowNode = Omit<LocalFlowNode, 'privateKeyHex'> & {
  privateKey?: EncryptedSecret
  privateKeyHex?: string
}

interface FlowNodeStorageDocument {
  version: 1
  nodes: StoredFlowNode[]
}

export const flowNodeStorageKey = 'nmsci.flowNodes.v1'

// 解密载入：每个节点的密文私钥经 codec 解密为内存态 privateKeyHex；旧版明文节点直接透传。
export async function loadLocalFlowNodes(
  codec: SecretCodec,
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
    const privateKeyHex = stored.privateKey
      ? await codec.decrypt(stored.privateKey)
      : stored.privateKeyHex
    if (typeof privateKeyHex !== 'string') continue
    const { privateKey: _enc, privateKeyHex: _legacy, ...rest } = stored
    nodes.push({ ...rest, privateKeyHex })
  }
  return nodes
}

// 加密保存：每个节点的内存态 privateKeyHex 经 codec 加密为密文 privateKey 落盘，明文不入 localStorage。
export async function saveLocalFlowNodes(
  nodes: LocalFlowNode[],
  codec: SecretCodec,
  storage: Storage = window.localStorage,
): Promise<void> {
  const stored: StoredFlowNode[] = []
  for (const node of nodes) {
    const { privateKeyHex, ...rest } = node
    stored.push({ ...rest, privateKey: await codec.encrypt(privateKeyHex) })
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
