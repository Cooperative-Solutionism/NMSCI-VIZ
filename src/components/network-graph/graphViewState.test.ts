import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_GRAPH_VIEW_STATE,
  GRAPH_VIEW_STORAGE_KEY,
  loadGraphViewState,
  normalizeGraphViewState,
  saveGraphViewState,
  type GraphViewState,
} from './graphViewState'

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(GRAPH_VIEW_STORAGE_KEY, initial)

  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe('graph view state', () => {
  it('normalizes a valid saved state and keeps a selected graph element', () => {
    const state = normalizeGraphViewState(
      {
        zoom: 1.7,
        pan: { x: 24, y: -12 },
        selectedId: 'edge-a',
        highlightMode: 'cycles',
      },
      {
        elementIds: new Set(['node-a', 'edge-a']),
        hasCycles: true,
      },
    )

    expect(state).toEqual({
      zoom: 1.7,
      pan: { x: 24, y: -12 },
      selectedId: 'edge-a',
      highlightMode: 'cycles',
    })
  })

  it('repairs malformed values and falls back from cycles when no cycle exists', () => {
    const state = normalizeGraphViewState(
      {
        zoom: Number.POSITIVE_INFINITY,
        pan: { x: 'bad', y: 8 },
        selectedId: 'missing',
        highlightMode: 'cycles',
      },
      {
        elementIds: new Set(['node-a']),
        hasCycles: false,
      },
    )

    expect(state).toEqual(DEFAULT_GRAPH_VIEW_STATE)
  })

  it('clamps zoom into Cytoscape bounds', () => {
    expect(normalizeGraphViewState({ zoom: 99 }).zoom).toBe(2.4)
    expect(normalizeGraphViewState({ zoom: 0.01 }).zoom).toBe(0.35)
  })

  it('loads defaults for missing, corrupt, or unreadable storage', () => {
    expect(loadGraphViewState(memoryStorage())).toEqual(DEFAULT_GRAPH_VIEW_STATE)
    expect(loadGraphViewState(memoryStorage('{broken'))).toEqual(DEFAULT_GRAPH_VIEW_STATE)

    const localStorageGetter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('localStorage unavailable')
    })
    try {
      expect(loadGraphViewState()).toEqual(DEFAULT_GRAPH_VIEW_STATE)
    } finally {
      localStorageGetter.mockRestore()
    }
  })

  it('saves normalized JSON and ignores storage write failures', () => {
    const storage = memoryStorage()
    const state: GraphViewState = {
      zoom: 1.2,
      pan: { x: 10, y: 20 },
      selectedId: 'node-a',
      highlightMode: 'related',
    }

    saveGraphViewState(state, storage, { elementIds: new Set(['node-a']), hasCycles: false })
    expect(storage.getItem(GRAPH_VIEW_STORAGE_KEY)).toBe(JSON.stringify(state))

    const failingStorage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('quota exceeded')
      },
    } as Storage
    expect(() => saveGraphViewState(state, failingStorage)).not.toThrow()
  })
})
