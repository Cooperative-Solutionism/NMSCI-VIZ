export function formatMicros(value: number | bigint): string {
  const micros = typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
  const millis = micros / 1000n
  const timestamp = Number(millis)
  if (!Number.isFinite(timestamp)) return '-'
  return new Date(timestamp).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

export function formatOptional(value: string | number | bigint | undefined): string {
  if (value === undefined || value === '') return '-'
  return String(value)
}

export function formatDateTime(value: string): string {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value
  return new Date(timestamp).toLocaleString()
}

export function shortHex(hex: string): string {
  return `${hex.slice(0, 10).toUpperCase()}...${hex.slice(-6).toUpperCase()}`
}

export function maskSecret(hex: string): string {
  return `${hex.slice(0, 6)}...${hex.slice(-6)}`
}
