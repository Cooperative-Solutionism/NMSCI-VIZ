import { describe, expect, it } from 'vitest'
import { normalizeNBitsHex } from './difficulty'

describe('nBits difficulty helpers', () => {
  it('normalizes nBits hex to eight lowercase digits', () => {
    expect(normalizeNBitsHex('1d00ffff', 'Register difficulty target')).toBe('1d00ffff')
    expect(normalizeNBitsHex('0x1D00FFFF', 'Register difficulty target')).toBe('1d00ffff')
    expect(normalizeNBitsHex('abc', 'Register difficulty target')).toBe('00000abc')
  })

  it('rejects non-hex and oversized nBits values', () => {
    expect(() => normalizeNBitsHex('', 'Register difficulty target')).toThrow(
      'Register difficulty target must be 1 to 8 hex digits',
    )
    expect(() => normalizeNBitsHex('200000000', 'Register difficulty target')).toThrow(
      'Register difficulty target must be 1 to 8 hex digits',
    )
    expect(() => normalizeNBitsHex('1234zzzz', 'Register difficulty target')).toThrow(
      'Register difficulty target must be 1 to 8 hex digits',
    )
  })
})
