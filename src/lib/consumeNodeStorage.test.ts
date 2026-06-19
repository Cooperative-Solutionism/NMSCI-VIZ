import { describe, expect, it } from 'vitest'
import {
  consumeNodeStorageKey,
  loadLocalConsumeNodes,
  patchLocalConsumeNode,
  saveLocalConsumeNodes,
  type LocalConsumeNode,
} from './consumeNodeStorage'
import type { SecretCodec } from './keyVault'

// 可逆假编解码器（base64 往返），让存储测试无需真实 Web Crypto。
const fakeCodec: SecretCodec = {
  encrypt: (plaintext) => Promise.resolve({ iv: 'iv', ct: btoa(plaintext) }),
  decrypt: (secret) => Promise.resolve(atob(secret.ct)),
}

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

const node: LocalConsumeNode = {
  id: 'c1',
  label: 'C1',
  publicKeyHex: `03${'a'.repeat(64)}`,
  privateKeyHex: '0'.repeat(64),
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('consume node storage', () => {
  it('round-trips through storage with the private key encrypted at rest', async () => {
    const storage = fakeStorage()
    await saveLocalConsumeNodes([node], fakeCodec, storage)
    expect(storage.getItem(consumeNodeStorageKey)).not.toContain(node.privateKeyHex)
    expect(await loadLocalConsumeNodes(fakeCodec, storage)).toEqual([node])
  })

  it('stores and reads plaintext when the vault is off (null codec)', async () => {
    const storage = fakeStorage()
    await saveLocalConsumeNodes([node], null, storage)

    const raw = storage.getItem(consumeNodeStorageKey)
    // 关闭态：私钥以明文 privateKeyHex 落盘，没有密文字段。
    expect(raw).toContain(node.privateKeyHex)
    expect(raw).not.toContain('"privateKey"')
    expect(await loadLocalConsumeNodes(null, storage)).toEqual([node])
  })

  it('returns [] for missing, malformed, or wrong-version documents', async () => {
    expect(await loadLocalConsumeNodes(fakeCodec, fakeStorage())).toEqual([])
    expect(
      await loadLocalConsumeNodes(fakeCodec, fakeStorage({ [consumeNodeStorageKey]: 'not json' })),
    ).toEqual([])
    expect(
      await loadLocalConsumeNodes(
        fakeCodec,
        fakeStorage({ [consumeNodeStorageKey]: JSON.stringify({ version: 2, nodes: [node] }) }),
      ),
    ).toEqual([])
  })

  it('patches a node by id and leaves others untouched', () => {
    expect(patchLocalConsumeNode([node], 'c1', { label: 'New' })[0]?.label).toBe('New')
    expect(patchLocalConsumeNode([node], 'missing', { label: 'New' })[0]?.label).toBe('C1')
  })
})
