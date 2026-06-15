import { describe, expect, it } from 'vitest'
import { consumeChainFilters, consumeChainParamName, detectIdentityKind } from './consumeChainFilters'

describe('consume chain filters', () => {
  it('detects 66-hex public keys as pubkey and everything else as id', () => {
    expect(detectIdentityKind(`02${'a'.repeat(64)}`)).toBe('pubkey')
    expect(detectIdentityKind('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe('id')
    expect(detectIdentityKind(`  ${'0'.repeat(66)}  `)).toBe('pubkey')
    expect(detectIdentityKind('not-a-key')).toBe('id')
    expect(detectIdentityKind(`02${'a'.repeat(63)}`)).toBe('id')
  })

  it('maps mode + identity kind to the right backend filter', () => {
    expect(consumeChainFilters('start', 'node-1', 'all')).toEqual({ startId: 'node-1', isLoop: undefined })
    expect(consumeChainFilters('end', 'node-1', 'looped')).toEqual({ endId: 'node-1', isLoop: true })
    expect(consumeChainFilters('node', 'node-1', 'open')).toEqual({ nodeId: 'node-1', isLoop: false })

    const pubkey = `02${'b'.repeat(64)}`
    expect(consumeChainFilters('start', pubkey, 'all')).toEqual({ startPubkey: pubkey, isLoop: undefined })
    expect(consumeChainFilters('end', pubkey, 'looped')).toEqual({ endPubkey: pubkey, isLoop: true })
    expect(consumeChainFilters('node', pubkey, 'all')).toEqual({ nodePubkey: pubkey, isLoop: undefined })
  })

  it('exposes the matching query-parameter name for URL preview', () => {
    expect(consumeChainParamName('start', 'id')).toBe('startId')
    expect(consumeChainParamName('start', 'pubkey')).toBe('startPubkey')
    expect(consumeChainParamName('end', 'pubkey')).toBe('endPubkey')
    expect(consumeChainParamName('node', 'id')).toBe('nodeId')
  })
})
