// 本地已创建的消费记录（供挂载步骤选择）。amount 以字符串存储（bigint 不可 JSON 序列化）；
// id 为后端返回的记录 id，挂载时作为 mountedTransactionRecordId。
export interface LocalTxRecord {
  id: string
  uuid: string
  amount: string
  currencyType: number
  consumeNodePubkey: string
  flowNodePubkey: string
  centralPubkey: string
  txid?: string
  rawBytesHex: string
  status: 'sent' | 'failed'
  message?: string
  createdAt: string
}

interface TxRecordStorageDocument {
  version: 1
  records: LocalTxRecord[]
}

export const txRecordStorageKey = 'nmsci.txRecords.v1'

export function loadLocalTxRecords(storage: Storage = window.localStorage): LocalTxRecord[] {
  const raw = storage.getItem(txRecordStorageKey)
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw) as Partial<TxRecordStorageDocument>
    if (parsed.version !== 1 || !Array.isArray(parsed.records)) return []
    return parsed.records.filter(isLocalTxRecord)
  } catch {
    return []
  }
}

export function saveLocalTxRecords(
  records: LocalTxRecord[],
  storage: Storage = window.localStorage,
): void {
  const document: TxRecordStorageDocument = { version: 1, records }
  storage.setItem(txRecordStorageKey, JSON.stringify(document))
}

function isLocalTxRecord(value: unknown): value is LocalTxRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LocalTxRecord
  return typeof candidate.id === 'string'
    && typeof candidate.amount === 'string'
    && typeof candidate.currencyType === 'number'
    && typeof candidate.consumeNodePubkey === 'string'
    && typeof candidate.flowNodePubkey === 'string'
    && typeof candidate.createdAt === 'string'
}
