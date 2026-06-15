export function normalizeNBitsHex(value: string, label: string): string {
  const trimmed = value.trim().replace(/^0x/i, '')
  if (!/^[0-9a-f]{1,8}$/i.test(trimmed)) {
    throw new Error(`${label}必须是 1 到 8 位十六进制字符`)
  }
  return trimmed.toLowerCase().padStart(8, '0')
}
