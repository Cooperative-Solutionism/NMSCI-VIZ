import { describe, expect, it } from 'vitest'
import {
  consumeNodeStorageKey,
  loadLocalConsumeNodes,
  patchLocalConsumeNode,
  saveLocalConsumeNodes,
  type LocalConsumeNode,
} from './consumeNodeStorage'

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
  it('round-trips through storage', () => {
    const storage = fakeStorage()
    saveLocalConsumeNodes([node], storage)
    expect(loadLocalConsumeNodes(storage)).toEqual([node])
  })

  it('returns [] for missing, malformed, or wrong-version documents', () => {
    expect(loadLocalConsumeNodes(fakeStorage())).toEqual([])
    expect(loadLocalConsumeNodes(fakeStorage({ [consumeNodeStorageKey]: 'not json' }))).toEqual([])
    expect(
      loadLocalConsumeNodes(
        fakeStorage({ [consumeNodeStorageKey]: JSON.stringify({ version: 2, nodes: [node] }) }),
      ),
    ).toEqual([])
  })

  it('patches a node by id and leaves others untouched', () => {
    expect(patchLocalConsumeNode([node], 'c1', { label: 'New' })[0]?.label).toBe('New')
    expect(patchLocalConsumeNode([node], 'missing', { label: 'New' })[0]?.label).toBe('C1')
  })
})
