import { describe, expect, it } from 'vitest'
import { formatMicros } from './format'

describe('format helpers', () => {
  it('formats bigint microsecond timestamps as UTC milliseconds', () => {
    expect(formatMicros(1_700_000_000_123_456n)).toBe('2023-11-14 22:13:20 UTC')
  })
})
