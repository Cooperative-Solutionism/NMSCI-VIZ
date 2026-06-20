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

const DEFAULT_ZOOM = 1
const DEFAULT_PAN_X = 0
const DEFAULT_PAN_Y = 0
const DEFAULT_SELECTED_ID = null
const DEFAULT_HIGHLIGHT_MODE: GraphHighlightMode = 'related'

export const DEFAULT_GRAPH_VIEW_STATE: GraphViewState = {
  zoom: DEFAULT_ZOOM,
  pan: { x: DEFAULT_PAN_X, y: DEFAULT_PAN_Y },
  selectedId: DEFAULT_SELECTED_ID,
  highlightMode: DEFAULT_HIGHLIGHT_MODE,
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

function createDefaultPan(): GraphViewState['pan'] {
  return { x: DEFAULT_PAN_X, y: DEFAULT_PAN_Y }
}

function createDefaultGraphViewState(): GraphViewState {
  return {
    zoom: DEFAULT_ZOOM,
    pan: createDefaultPan(),
    selectedId: DEFAULT_SELECTED_ID,
    highlightMode: DEFAULT_HIGHLIGHT_MODE,
  }
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
  if (!isRecord(value)) return createDefaultGraphViewState()

  const rawZoom = finiteNumber(value.zoom)
  const rawPan = isRecord(value.pan) ? value.pan : null
  const rawPanX = rawPan ? finiteNumber(rawPan.x) : null
  const rawPanY = rawPan ? finiteNumber(rawPan.y) : null
  const rawSelectedId = typeof value.selectedId === 'string' ? value.selectedId : null
  const rawMode = value.highlightMode

  const selectedId =
    rawSelectedId !== null &&
    rawSelectedId.length > 0 &&
    (!options.elementIds || options.elementIds.has(rawSelectedId))
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
      : createDefaultPan()

  return {
    zoom: clamp(rawZoom ?? DEFAULT_ZOOM, minZoom, maxZoom),
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
  if (!targetStorage) return createDefaultGraphViewState()

  try {
    const raw = targetStorage.getItem(GRAPH_VIEW_STORAGE_KEY)
    return normalizeGraphViewState(raw ? JSON.parse(raw) : null, options)
  } catch {
    return createDefaultGraphViewState()
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
