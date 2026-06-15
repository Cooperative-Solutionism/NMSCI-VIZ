import { describe, expect, it, vi } from 'vitest'

const sdkMocks = vi.hoisted(() => ({
  mineNonce: vi.fn(async () => 7),
  signCentralPubkeyEmpowerPayload: vi.fn(async () => 'cd'.repeat(64)),
  signFlowNodeRegisterPayload: vi.fn(async () => 'ab'.repeat(64)),
  mineTransactionRecordNonce: vi.fn(async () => 11),
  mineTransactionMountNonce: vi.fn(async () => 13),
  signTransactionRecordPayload: vi.fn(async (_payload: Uint8Array, key: string) =>
    (key.endsWith('1') ? 'aa' : 'bb').repeat(64),
  ),
  signTransactionMountPayload: vi.fn(async (_payload: Uint8Array, key: string) =>
    (key.endsWith('1') ? 'a1' : 'b1').repeat(64),
  ),
}))

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    mineNonce: sdkMocks.mineNonce,
    signCentralPubkeyEmpowerPayload: sdkMocks.signCentralPubkeyEmpowerPayload,
    signFlowNodeRegisterPayload: sdkMocks.signFlowNodeRegisterPayload,
    mineTransactionRecordNonce: sdkMocks.mineTransactionRecordNonce,
    mineTransactionMountNonce: sdkMocks.mineTransactionMountNonce,
    signTransactionRecordPayload: sdkMocks.signTransactionRecordPayload,
    signTransactionMountPayload: sdkMocks.signTransactionMountPayload,
  }
})

describe('message builders', () => {
  it('builds stable flow-node registration bytes and PoW prefix', async () => {
    const { buildRegisterMessage } = await import('./messageBuilders')
    const {
      MsgType,
      calculateTargetFromNBits,
      concat,
      nBitsToBytes,
      pubkeyToBytes,
      toBytesBigEndian,
      toHex,
      uuidToBytes,
    } = await import('@nmsci/sdk')
    const uuid = '00000000-0000-4000-8000-000000000001'
    const difficultyHex = '1d00ffff'
    const publicKeyHex = '02'.padEnd(66, '1')

    const built = await buildRegisterMessage({
      uuid,
      privateKeyHex: '01'.padStart(64, '0'),
      publicKeyHex,
      difficultyHex,
    })

    const expectedPrefix = concat(
      toBytesBigEndian(MsgType.FLOW_NODE_REGISTRATION, 2),
      uuidToBytes(uuid),
      nBitsToBytes(difficultyHex),
    )
    expect(sdkMocks.mineNonce).toHaveBeenCalledWith(
      expectedPrefix,
      pubkeyToBytes(publicKeyHex),
      calculateTargetFromNBits(difficultyHex),
    )
    expect(built.nonce).toBe(7)
    expect(built.rawBytesHex).toBe(
      `${toHex(expectedPrefix)}00000007${publicKeyHex}${'ab'.repeat(64)}`,
    )
  })

  it('normalizes compressed public keys through SDK byte parsing', async () => {
    const { normalizePubkeyHex } = await import('./messageBuilders')

    expect(normalizePubkeyHex(`0x${'02'.padEnd(66, '1')}`)).toBe('02'.padEnd(66, '1'))
  })

  it('builds a 263-byte transaction record signed by consume + flow keys', async () => {
    const { buildTransactionRecordMessage } = await import('./messageBuilders')
    const consumePrivateKeyHex = '01'.padStart(64, '0')
    const flowPrivateKeyHex = '02'.padStart(64, '0')
    const built = await buildTransactionRecordMessage({
      uuid: '00000000-0000-4000-8000-000000000001',
      amount: 5000n,
      currencyType: 1,
      difficultyHex: '1d00ffff',
      consumeNodePubkeyHex: `03${'a'.repeat(64)}`,
      flowNodePubkeyHex: `02${'b'.repeat(64)}`,
      centralPubkeyHex: `02${'c'.repeat(64)}`,
      consumePrivateKeyHex,
      flowPrivateKeyHex,
    })

    expect(built.nonce).toBe(11)
    expect(built.rawBytesHex.length).toBe(263 * 2)
    expect(sdkMocks.signTransactionRecordPayload).toHaveBeenCalledTimes(2)
    expect(sdkMocks.signTransactionRecordPayload.mock.calls.map((call) => call[1])).toEqual([
      consumePrivateKeyHex,
      flowPrivateKeyHex,
    ])
  })

  it('builds a 269-byte transaction mount linked to a record id', async () => {
    const { buildTransactionMountMessage } = await import('./messageBuilders')
    const built = await buildTransactionMountMessage({
      uuid: '00000000-0000-4000-8000-000000000002',
      mountedTransactionRecordId: '00000000-0000-4000-8000-0000000000aa',
      difficultyHex: '1d00ffff',
      consumeNodePubkeyHex: `03${'a'.repeat(64)}`,
      flowNodePubkeyHex: `02${'b'.repeat(64)}`,
      centralPubkeyHex: `02${'c'.repeat(64)}`,
      consumePrivateKeyHex: '01'.padStart(64, '0'),
      flowPrivateKeyHex: '02'.padStart(64, '0'),
    })

    expect(built.nonce).toBe(13)
    expect(built.rawBytesHex.length).toBe(269 * 2)
    expect(sdkMocks.signTransactionMountPayload).toHaveBeenCalledTimes(2)
  })
})
