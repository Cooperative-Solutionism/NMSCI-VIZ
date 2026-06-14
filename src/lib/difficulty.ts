export function normalizeNBitsHex(value: string, label: string): string {
  const trimmed = value.trim().replace(/^0x/i, '')
  if (!/^[0-9a-f]{1,8}$/i.test(trimmed)) {
    throw new Error(`${label} must be 1 to 8 hex digits`)
  }
  return trimmed.toLowerCase().padStart(8, '0')
}
