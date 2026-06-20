export const GRAPH_VIEW_STORAGE_KEY = 'nmsci.graph.view.v1'

export type GraphHighlightMode = 'related' | 'cycles'

export interface GraphViewState {
  zoom: number
  pan: { x: number; y: number }
  selectedId: string | null
  highlightMode: GraphHighlightMode
}

interface NormalizeOptions {
  elementIds?: ReadonlySet<string>
  hasCycles?: boolean
  minZoom?: number
  maxZoom?: number
}

export const DEFAULT_GRAPH_VIEW_STATE: GraphViewState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  selectedId: null,
  highlightMode: 'related',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readStorage(storage?: Storage): Storage | null {
  if (storage) return storage
  if (typeof window === 'undefined') return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function normalizeGraphViewState(
  value: unknown,
  options: NormalizeOptions = {},
): GraphViewState {
  const minZoom = options.minZoom ?? 0.35
  const maxZoom = options.maxZoom ?? 2.4
  if (!isRecord(value)) return DEFAULT_GRAPH_VIEW_STATE

  const rawZoom = finiteNumber(value.zoom)
  const rawPan = isRecord(value.pan) ? value.pan : null
  const rawPanX = rawPan ? finiteNumber(rawPan.x) : null
  const rawPanY = rawPan ? finiteNumber(rawPan.y) : null
  const rawSelectedId = typeof value.selectedId === 'string' ? value.selectedId : null
  const rawMode = value.highlightMode

  const selectedId =
    rawSelectedId && (!options.elementIds || options.elementIds.has(rawSelectedId))
      ? rawSelectedId
      : null
  const highlightMode: GraphHighlightMode =
    rawMode === 'cycles' && options.hasCycles !== false
      ? 'cycles'
      : rawMode === 'related'
        ? 'related'
        : 'related'

  const pan =
    rawPanX !== null && rawPanY !== null
      ? { x: rawPanX, y: rawPanY }
      : DEFAULT_GRAPH_VIEW_STATE.pan

  return {
    zoom: clamp(rawZoom ?? DEFAULT_GRAPH_VIEW_STATE.zoom, minZoom, maxZoom),
    pan,
    selectedId,
    highlightMode,
  }
}

export function loadGraphViewState(
  storage?: Storage,
  options?: NormalizeOptions,
): GraphViewState {
  const targetStorage = readStorage(storage)
  if (!targetStorage) return DEFAULT_GRAPH_VIEW_STATE

  try {
    const raw = targetStorage.getItem(GRAPH_VIEW_STORAGE_KEY)
    return normalizeGraphViewState(raw ? JSON.parse(raw) : null, options)
  } catch {
    return DEFAULT_GRAPH_VIEW_STATE
  }
}

export function saveGraphViewState(
  state: GraphViewState,
  storage?: Storage,
  options?: NormalizeOptions,
): void {
  const targetStorage = readStorage(storage)
  if (!targetStorage) return

  try {
    targetStorage.setItem(
      GRAPH_VIEW_STORAGE_KEY,
      JSON.stringify(normalizeGraphViewState(state, options)),
    )
  } catch {
    // Persisting the view is opportunistic; graph interaction must keep working.
  }
}
