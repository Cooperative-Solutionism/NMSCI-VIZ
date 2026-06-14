export interface Point {
  x: number
  y: number
}

export function deterministicOffset(id: string): Point {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 33 + id.charCodeAt(index)) >>> 0
  }
  const angle = (hash % 360) * (Math.PI / 180)
  const radius = 126 + (hash % 48)
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

export function diffIds(currentIds: Iterable<string>, nextIds: Iterable<string>) {
  const current = new Set(currentIds)
  const next = new Set(nextIds)
  return {
    add: [...next].filter((id) => !current.has(id)),
    keep: [...next].filter((id) => current.has(id)),
    remove: [...current].filter((id) => !next.has(id)),
  }
}
