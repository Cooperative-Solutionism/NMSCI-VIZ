import { describe, expect, it } from 'vitest'
import { normalizeNBitsHex } from './difficulty'

describe('nBits difficulty helpers', () => {
  it('normalizes nBits hex to eight lowercase digits', () => {
    expect(normalizeNBitsHex('1d00ffff', '注册难度目标')).toBe('1d00ffff')
    expect(normalizeNBitsHex('0x1D00FFFF', '注册难度目标')).toBe('1d00ffff')
    expect(normalizeNBitsHex('abc', '注册难度目标')).toBe('00000abc')
  })

  it('rejects non-hex and oversized nBits values', () => {
    expect(() => normalizeNBitsHex('', '注册难度目标')).toThrow(
      '注册难度目标必须是 1 到 8 位十六进制字符',
    )
    expect(() => normalizeNBitsHex('200000000', '注册难度目标')).toThrow(
      '注册难度目标必须是 1 到 8 位十六进制字符',
    )
    expect(() => normalizeNBitsHex('1234zzzz', '注册难度目标')).toThrow(
      '注册难度目标必须是 1 到 8 位十六进制字符',
    )
  })
})
