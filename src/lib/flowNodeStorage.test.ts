import { beforeEach, describe, expect, it } from 'vitest'
import {
  hasLegacyPlaintextFlowNodes,
  loadLocalFlowNodes,
  patchLocalFlowNode,
  saveLocalFlowNodes,
  type LocalFlowNode,
} from './flowNodeStorage'
import type { SecretCodec } from './keyVault'

// 可逆假编解码器（base64 往返），让存储测试无需真实 Web Crypto。
const fakeCodec: SecretCodec = {
  encrypt: (plaintext) => Promise.resolve({ iv: 'iv', ct: btoa(plaintext) }),
  decrypt: (secret) => Promise.resolve(atob(secret.ct)),
}

const node: LocalFlowNode = {
  id: 'local-node-1',
  label: 'NODE01',
  publicKeyHex: '02'.padEnd(66, '1'),
  privateKeyHex: '0'.repeat(63) + '1',
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
  authorizations: [],
}

describe('flow node local storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('encrypts the private key at rest and round-trips through decryption', async () => {
    await saveLocalFlowNodes([node], fakeCodec)

    const raw = localStorage.getItem('nmsci.flowNodes.v1')
    expect(raw).toContain('"version":1')
    expect(raw).toContain('"privateKey"')
    // 明文私钥绝不落盘。
    expect(raw).not.toContain(node.privateKeyHex)
    expect(await loadLocalFlowNodes(fakeCodec)).toEqual([node])
  })

  it('stores and reads plaintext when the vault is off (null codec)', async () => {
    await saveLocalFlowNodes([node], null)

    const raw = localStorage.getItem('nmsci.flowNodes.v1')
    // 关闭态：私钥以明文 privateKeyHex 落盘，没有密文字段。
    expect(raw).toContain(node.privateKeyHex)
    expect(raw).not.toContain('"privateKey"')
    // 关闭态加载（null codec）读回明文，且被识别为待迁移（启用后可加密）。
    expect(await loadLocalFlowNodes(null)).toEqual([node])
    expect(hasLegacyPlaintextFlowNodes()).toBe(true)
  })

  it('patches matching nodes without duplicating the same local id', async () => {
    const patchedNodes = patchLocalFlowNode([node], node.id, {
      label: 'NODE02',
      updatedAt: '2026-06-13T00:01:00.000Z',
    })
    await saveLocalFlowNodes(patchedNodes, fakeCodec)

    expect(await loadLocalFlowNodes(fakeCodec)).toEqual([{
      ...node,
      label: 'NODE02',
      updatedAt: '2026-06-13T00:01:00.000Z',
    }])
  })

  it('treats malformed localStorage payloads as empty data', async () => {
    localStorage.setItem('nmsci.flowNodes.v1', '{broken')

    expect(await loadLocalFlowNodes(fakeCodec)).toEqual([])
  })

  it('reads legacy plaintext nodes for migration and flags them', async () => {
    // 旧版明文文档（privateKeyHex 直存），加载应透传，并被识别为待迁移。
    localStorage.setItem(
      'nmsci.flowNodes.v1',
      JSON.stringify({ version: 1, nodes: [node] }),
    )

    expect(hasLegacyPlaintextFlowNodes()).toBe(true)
    expect(await loadLocalFlowNodes(fakeCodec)).toEqual([node])

    // 迁移：以密文重存后不再有明文遗留。
    await saveLocalFlowNodes([node], fakeCodec)
    expect(hasLegacyPlaintextFlowNodes()).toBe(false)
  })
})
