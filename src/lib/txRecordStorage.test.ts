import { describe, expect, it } from 'vitest'
import {
  loadLocalTxRecords,
  saveLocalTxRecords,
  txRecordStorageKey,
  type LocalTxRecord,
} from './txRecordStorage'

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

const record: LocalTxRecord = {
  id: 'rec-1',
  uuid: 'uuid-1',
  amount: '5000',
  currencyType: 1,
  consumeNodePubkey: `03${'a'.repeat(64)}`,
  flowNodePubkey: `02${'b'.repeat(64)}`,
  centralPubkey: `02${'c'.repeat(64)}`,
  txid: 'tx',
  rawBytesHex: '00',
  status: 'sent',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('tx record storage', () => {
  it('round-trips and keeps amount as a string', () => {
    const storage = fakeStorage()
    saveLocalTxRecords([record], storage)
    const loaded = loadLocalTxRecords(storage)
    expect(loaded).toEqual([record])
    expect(typeof loaded[0]?.amount).toBe('string')
  })

  it('returns [] for missing, malformed, or wrong-version documents', () => {
    expect(loadLocalTxRecords(fakeStorage())).toEqual([])
    expect(loadLocalTxRecords(fakeStorage({ [txRecordStorageKey]: '{' }))).toEqual([])
    expect(
      loadLocalTxRecords(fakeStorage({ [txRecordStorageKey]: JSON.stringify({ version: 9, records: [record] }) })),
    ).toEqual([])
  })
})
