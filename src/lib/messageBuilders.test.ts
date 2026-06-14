import { describe, expect, it, vi } from 'vitest'

const sdkMocks = vi.hoisted(() => ({
  mineNonce: vi.fn(async () => 7),
  signCentralPubkeyEmpowerPayload: vi.fn(async () => 'cd'.repeat(64)),
  signFlowNodeRegisterPayload: vi.fn(async () => 'ab'.repeat(64)),
}))

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    mineNonce: sdkMocks.mineNonce,
    signCentralPubkeyEmpowerPayload: sdkMocks.signCentralPubkeyEmpowerPayload,
    signFlowNodeRegisterPayload: sdkMocks.signFlowNodeRegisterPayload,
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
})
