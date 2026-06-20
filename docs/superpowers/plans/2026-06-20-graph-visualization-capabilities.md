# Graph Visualization Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add graph search, related/cycle highlighting, saved graph view state, and density hints to the existing Cytoscape canvas without changing backend APIs or business controllers.

**Architecture:** Keep graph-specific view state inside `src/components/network-graph/*` and `src/components/NetworkGraph.tsx`. Add pure helpers for persisted state and highlight derivation, a focused `GraphSearch` component, and small Cytoscape hook extensions for focusing nodes, applying classes, and reporting pan/zoom. `features/network-explorer` continues to pass graph data and selection callbacks only.

**Tech Stack:** React + TypeScript + Vite + Vitest + Testing Library + Cytoscape + lucide-react + localStorage + CSS.

---

## File Structure

- Create `src/components/network-graph/graphViewState.ts`: pure localStorage model, normalization, load, save, and selection validation for graph view state.
- Create `src/components/network-graph/graphViewState.test.ts`: unit coverage for valid state, corrupt JSON, invalid fields, missing selected element, and cycles fallback.
- Create `src/components/network-graph/GraphSearch.tsx`: compact canvas search control and pure search matcher.
- Create `src/components/network-graph/GraphSearch.test.tsx`: component coverage for matching, empty graph, no-result feedback, click and Enter location.
- Create `src/components/network-graph/graphHighlight.ts`: pure helpers for active chain ids and cycle endpoint ids.
- Create `src/components/network-graph/graphHighlight.test.ts`: unit coverage for related mode, cycles mode, no active highlight, and endpoint derivation.
- Modify `src/components/network-graph/useCytoscapeGraph.ts`: accept highlight mode and cycle chains, apply Cytoscape classes, expose `focusNode`, and report view changes.
- Modify `src/components/network-graph/graphStyle.ts`: add `edge.cycle-highlight` and `node.cycle-endpoint` styles.
- Modify `src/components/network-graph/GraphTools.tsx`: add `相关` / `循环` mode buttons while preserving zoom, fit, and PNG actions.
- Modify `src/components/NetworkGraph.tsx`: wire search, highlight mode, density status text, graph view persistence, restored selection, and hook props.
- Modify `src/components/NetworkGraph.test.tsx`: extend current hook-mock tests for search, mode switching, density hint, restored selection, and persisted state.
- Modify `src/styles/network-graph.css`: position and size search/mode controls without blocking canvas use.

## Task 1: Graph View State Model

**Purpose:** Build the pure persisted state layer before touching UI or Cytoscape so invalid localStorage data cannot break the graph.

**Files:**

- Create: `src/components/network-graph/graphViewState.ts`
- Create: `src/components/network-graph/graphViewState.test.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `src/components/network-graph/graphViewState.test.ts`:

```ts
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

  it('normalizes an empty string selectedId to null', () => {
    expect(normalizeGraphViewState({ selectedId: '' }).selectedId).toBeNull()
    expect(
      normalizeGraphViewState({ selectedId: '' }, { elementIds: new Set(['']) }).selectedId,
    ).toBeNull()
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
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
npm test -- src/components/network-graph/graphViewState.test.ts
```

Expected: fail with an import resolution error because `graphViewState.ts` does not exist.

- [ ] **Step 3: Implement the graph view state model**

Create `src/components/network-graph/graphViewState.ts`:

```ts
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
```

- [ ] **Step 4: Run the focused tests and commit**

Run:

```bash
npm test -- src/components/network-graph/graphViewState.test.ts
```

Expected: pass.

Commit:

```bash
git add src/components/network-graph/graphViewState.ts src/components/network-graph/graphViewState.test.ts
git commit -m "feat: add graph view state model"
```

## Task 2: Graph Search Component

**Purpose:** Add a focused, testable search component before wiring it into the live canvas.

**Files:**

- Create: `src/components/network-graph/GraphSearch.tsx`
- Create: `src/components/network-graph/GraphSearch.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `src/components/network-graph/GraphSearch.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ChainGraphNode } from '../../lib/types'
import { findGraphSearchMatches, GraphSearch } from './GraphSearch'

const nodes: ChainGraphNode[] = [
  node('node-alpha', 'Alpha flow'),
  node('03ABCDEF001122', 'Local flow'),
  node('node-beta', 'Beta consume'),
]

describe('findGraphSearchMatches', () => {
  it('matches id and label fragments case-insensitively', () => {
    expect(findGraphSearchMatches(nodes, 'ALPHA').map((match) => match.id)).toEqual(['node-alpha'])
    expect(findGraphSearchMatches(nodes, 'abcdef').map((match) => match.id)).toEqual([
      '03ABCDEF001122',
    ])
    expect(findGraphSearchMatches(nodes, 'consume').map((match) => match.id)).toEqual([
      'node-beta',
    ])
  })

  it('returns no matches for blank queries', () => {
    expect(findGraphSearchMatches(nodes, '   ')).toEqual([])
  })
})

describe('GraphSearch', () => {
  it('selects the first matching node from the locate button', () => {
    const onSelectNode = vi.fn()
    render(<GraphSearch nodes={nodes} onSelectNode={onSelectNode} />)

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'flow' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定位节点' }))

    expect(screen.getByText('匹配 2 个节点')).toBeInTheDocument()
    expect(onSelectNode).toHaveBeenCalledWith(nodes[0])
  })

  it('selects the first matching node from Enter', () => {
    const onSelectNode = vi.fn()
    render(<GraphSearch nodes={nodes} onSelectNode={onSelectNode} />)

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'beta' },
    })
    fireEvent.keyDown(screen.getByLabelText('搜索图谱节点'), { key: 'Enter' })

    expect(onSelectNode).toHaveBeenCalledWith(nodes[2])
  })

  it('shows an inline no-result message without calling select', () => {
    const onSelectNode = vi.fn()
    render(<GraphSearch nodes={nodes} onSelectNode={onSelectNode} />)

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'missing' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定位节点' }))

    expect(screen.getByText('未找到匹配节点')).toBeInTheDocument()
    expect(onSelectNode).not.toHaveBeenCalled()
  })

  it('disables search controls for an empty graph', () => {
    render(<GraphSearch nodes={[]} onSelectNode={vi.fn()} />)

    expect(screen.getByLabelText('搜索图谱节点')).toBeDisabled()
    expect(screen.getByRole('button', { name: '定位节点' })).toBeDisabled()
  })
})

function node(id: string, label: string): ChainGraphNode {
  return {
    id,
    label,
    chainCount: 1,
    kind: 'chain',
    volumeByCurrency: new Map([[1, 100n]]),
  }
}
```

- [ ] **Step 2: Run the new tests and verify they fail**

Run:

```bash
npm test -- src/components/network-graph/GraphSearch.test.tsx
```

Expected: fail with an import resolution error because `GraphSearch.tsx` does not exist.

- [ ] **Step 3: Implement the search component**

Create `src/components/network-graph/GraphSearch.tsx`:

```tsx
import { Search } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import type { ChainGraphNode } from '../../lib/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

interface GraphSearchProps {
  nodes: ChainGraphNode[]
  onSelectNode: (node: ChainGraphNode) => void
}

export function findGraphSearchMatches(
  nodes: ChainGraphNode[],
  query: string,
): ChainGraphNode[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return nodes.filter((node) => {
    return (
      node.id.toLowerCase().includes(normalizedQuery) ||
      node.label.toLowerCase().includes(normalizedQuery)
    )
  })
}

export function GraphSearch({ nodes, onSelectNode }: GraphSearchProps) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => findGraphSearchMatches(nodes, query), [nodes, query])
  const disabled = nodes.length === 0
  const hasQuery = query.trim().length > 0
  const hasNoMatches = hasQuery && matches.length === 0

  const locateFirstMatch = () => {
    const firstMatch = matches[0]
    if (firstMatch) onSelectNode(firstMatch)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    locateFirstMatch()
  }

  return (
    <div className="graph-search" role="search" aria-label="图谱节点搜索">
      <div className="graph-search__row">
        <Input
          aria-label="搜索图谱节点"
          autoComplete="off"
          disabled={disabled}
          name="graphSearch"
          placeholder="搜索节点 ID / 公钥"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          aria-label="定位节点"
          disabled={disabled || matches.length === 0}
          size="icon"
          title="定位节点"
          type="button"
          variant="ghost"
          onClick={locateFirstMatch}
        >
          <Search aria-hidden="true" />
        </Button>
      </div>
      {hasNoMatches ? <div className="graph-search__hint">未找到匹配节点</div> : null}
      {matches.length > 0 ? (
        <div className="graph-search__hint">匹配 {matches.length} 个节点</div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run the focused tests and commit**

Run:

```bash
npm test -- src/components/network-graph/GraphSearch.test.tsx
```

Expected: pass.

Commit:

```bash
git add src/components/network-graph/GraphSearch.tsx src/components/network-graph/GraphSearch.test.tsx
git commit -m "feat: add graph node search control"
```

## Task 3: Highlight Helpers and Cytoscape Hook Extension

**Purpose:** Add graph highlight semantics and node focusing at the Cytoscape boundary while keeping the logic testable.

**Files:**

- Create: `src/components/network-graph/graphHighlight.ts`
- Create: `src/components/network-graph/graphHighlight.test.ts`
- Modify: `src/components/network-graph/useCytoscapeGraph.ts`
- Modify: `src/components/network-graph/graphStyle.ts`

- [ ] **Step 1: Write failing helper tests**

Create `src/components/network-graph/graphHighlight.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ChainGraphEdge } from '../../lib/types'
import { cycleEndpointIds, highlightedChainsForMode } from './graphHighlight'

const edges: ChainGraphEdge[] = [
  edge('edge-a', 'node-a', 'node-b', 'chain-a', 'open'),
  edge('edge-b', 'node-b', 'node-c', 'chain-b', 'looped'),
  edge('edge-c', 'node-c', 'node-d', 'chain-b', 'looped'),
]

describe('graph highlight helpers', () => {
  it('uses selected related chains in related mode', () => {
    expect(
      Array.from(highlightedChainsForMode('related', new Set(['chain-a']), new Set(['chain-b']))),
    ).toEqual(['chain-a'])
  })

  it('uses cycle chains in cycles mode', () => {
    expect(
      Array.from(highlightedChainsForMode('cycles', new Set(['chain-a']), new Set(['chain-b']))),
    ).toEqual(['chain-b'])
  })

  it('returns cycle endpoints from highlighted cycle chains', () => {
    expect(Array.from(cycleEndpointIds(edges, new Set(['chain-b']))).sort()).toEqual([
      'node-b',
      'node-c',
      'node-d',
    ])
  })
})

function edge(
  id: string,
  source: string,
  target: string,
  chainId: string,
  status: ChainGraphEdge['status'],
): ChainGraphEdge {
  return {
    id,
    source,
    target,
    chainId,
    label: '1.00 CNY',
    amount: 100n,
    currencyType: 1,
    status,
    color: '#0f766e',
    relatedTransactionRecord: 'record',
    relatedTransactionMount: 'mount',
    relatedTransactionMountTimestamp: 1n,
  }
}
```

- [ ] **Step 2: Run the helper tests and verify they fail**

Run:

```bash
npm test -- src/components/network-graph/graphHighlight.test.ts
```

Expected: fail with an import resolution error because `graphHighlight.ts` does not exist.

- [ ] **Step 3: Implement highlight helpers**

Create `src/components/network-graph/graphHighlight.ts`:

```ts
import type { ChainGraphEdge } from '../../lib/types'
import type { GraphHighlightMode } from './graphViewState'

export function highlightedChainsForMode(
  mode: GraphHighlightMode,
  selectedChainIds: ReadonlySet<string>,
  cycleChainIds: ReadonlySet<string>,
): ReadonlySet<string> {
  return mode === 'cycles' ? cycleChainIds : selectedChainIds
}

export function cycleEndpointIds(
  edges: readonly ChainGraphEdge[],
  cycleChainIds: ReadonlySet<string>,
): Set<string> {
  const endpointIds = new Set<string>()
  for (const edge of edges) {
    if (!cycleChainIds.has(edge.chainId)) continue
    endpointIds.add(edge.source)
    endpointIds.add(edge.target)
  }
  return endpointIds
}
```

- [ ] **Step 4: Extend the Cytoscape hook**

Modify `src/components/network-graph/useCytoscapeGraph.ts`:

1. Update imports:

```ts
import cytoscape, { type Core, type EdgeSingular, type NodeSingular } from 'cytoscape'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { readGraphTokens } from '../../lib/tokens'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../lib/types'
import { cycleEndpointIds, highlightedChainsForMode } from './graphHighlight'
import { createGraphStyle } from './graphStyle'
import { syncGraphElements } from './graphSync'
import type { GraphHighlightMode, GraphViewState } from './graphViewState'
import type { ContextMenuState } from './types'
```

2. Replace `UseCytoscapeGraphParams` with:

```ts
interface UseCytoscapeGraphParams {
  graph: ChainGraph
  selectedId: string | null
  selectedChainIds: ReadonlySet<string>
  cycleChainIds: ReadonlySet<string>
  highlightMode: GraphHighlightMode
  initialViewState?: GraphViewState
  onSelectNode: (node: ChainGraphNode) => void
  onSelectEdge: (edge: ChainGraphEdge) => void
  onOpenMenu: (menu: ContextMenuState) => void
  onCloseMenu: () => void
  onViewChange?: (view: Pick<GraphViewState, 'zoom' | 'pan'>) => void
}
```

3. In the hook parameter destructuring, include the new values:

```ts
export function useCytoscapeGraph({
  graph,
  selectedId,
  selectedChainIds,
  cycleChainIds,
  highlightMode,
  initialViewState,
  onSelectNode,
  onSelectEdge,
  onOpenMenu,
  onCloseMenu,
  onViewChange,
}: UseCytoscapeGraphParams) {
```

4. Add refs after the callback refs:

```ts
  const onViewChangeRef = useRef(onViewChange)
  const initialViewAppliedRef = useRef(false)
```

5. Add this effect next to the other callback-ref effects:

```ts
  useEffect(() => {
    onViewChangeRef.current = onViewChange
  }, [onViewChange])
```

6. Add `focusNode` before the return:

```ts
  const focusNode = useCallback((nodeId: string) => {
    const cy = cyRef.current
    if (!cy) return
    const target = cy.getElementById(nodeId)
    if (target.empty()) return

    cy.animate(
      {
        center: { eles: target },
        zoom: Math.max(cy.zoom(), 1.1),
      },
      {
        duration: 220,
      },
    )
  }, [])
```

7. After the graph sync effect, add initial view application:

```ts
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !initialViewState || initialViewAppliedRef.current) return
    initialViewAppliedRef.current = true
    cy.zoom(initialViewState.zoom)
    cy.pan(initialViewState.pan)
  }, [graph.edges.length, graph.nodes.length, initialViewState])
```

8. After initial view application, add debounced pan/zoom reporting:

```ts
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    let timeoutId: number | undefined
    const reportView = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        onViewChangeRef.current?.({
          zoom: cy.zoom(),
          pan: cy.pan(),
        })
      }, 120)
    }

    cy.on('pan zoom', reportView)
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      cy.off('pan zoom', reportView)
    }
  }, [])
```

9. Replace the existing selection/highlight effect with:

```ts
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().unselect()
    cy.edges().removeClass('chain-highlight chain-dimmed cycle-highlight')
    cy.nodes().removeClass('cycle-endpoint')

    const activeChainIds = highlightedChainsForMode(
      highlightMode,
      selectedChainIds,
      cycleChainIds,
    )

    if (activeChainIds.size > 0) {
      cy.edges().forEach((edge) => {
        const { chainId } = edge.data() as { chainId?: unknown }
        const highlighted = typeof chainId === 'string' && activeChainIds.has(chainId)
        edge.toggleClass('chain-highlight', highlighted)
        edge.toggleClass('chain-dimmed', !highlighted)
        edge.toggleClass('cycle-highlight', highlightMode === 'cycles' && highlighted)
      })
    }

    if (highlightMode === 'cycles') {
      const endpointIds = cycleEndpointIds(graph.edges, cycleChainIds)
      endpointIds.forEach((nodeId) => {
        cy.getElementById(nodeId).addClass('cycle-endpoint')
      })
    }

    if (selectedId) cy.getElementById(selectedId).select()
  }, [cycleChainIds, graph.edges, highlightMode, selectedChainIds, selectedId])
```

10. Replace the return with:

```ts
  return { containerRef, cyRef, focusNode }
```

- [ ] **Step 5: Add graph style selectors**

Modify `src/components/network-graph/graphStyle.ts` by adding these selectors before `edge:selected`:

```ts
    {
      selector: 'edge.cycle-highlight',
      style: {
        opacity: 1,
        'line-color': '#b45309',
        'target-arrow-color': '#b45309',
        width: 5.5,
        'z-index': 24,
      },
    },
    {
      selector: 'node.cycle-endpoint',
      style: {
        'border-color': '#b45309',
        'border-width': 4,
      },
    },
```

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npm test -- src/components/network-graph/graphHighlight.test.ts src/components/network-graph/graphSync.test.ts
```

Expected: pass.

Run:

```bash
npm run lint
```

Expected: pass.

Commit:

```bash
git add src/components/network-graph/graphHighlight.ts src/components/network-graph/graphHighlight.test.ts src/components/network-graph/useCytoscapeGraph.ts src/components/network-graph/graphStyle.ts
git commit -m "feat: add graph highlight modes"
```

## Task 4: NetworkGraph Search, Mode Controls, and Density Status

**Purpose:** Wire the new user-facing controls into `NetworkGraph` while preserving existing canvas actions and tests.

**Files:**

- Modify: `src/components/network-graph/GraphTools.tsx`
- Modify: `src/components/NetworkGraph.tsx`
- Modify: `src/components/NetworkGraph.test.tsx`
- Modify: `src/styles/network-graph.css`

- [ ] **Step 1: Extend the NetworkGraph tests**

Modify `src/components/NetworkGraph.test.tsx`:

1. Add a reusable focus mock near the existing `vi.mock`:

```ts
const hookMocks = vi.hoisted(() => ({
  focusNode: vi.fn(),
}))

vi.mock('./network-graph/useCytoscapeGraph', () => ({
  useCytoscapeGraph: vi.fn(() => ({
    containerRef: { current: null },
    cyRef: { current: null },
    focusNode: hookMocks.focusNode,
  })),
}))
```

2. Change `edge-c1` in `baseGraph.edges` to looped:

```ts
    edge('edge-c1', 'node-d', 'node-e', 'chain-c', 'looped'),
```

3. Change the `edge` helper signature and status assignment:

```ts
function edge(
  id: string,
  source: string,
  target: string,
  chainId: string,
  status: ChainGraph['edges'][number]['status'] = 'open',
): ChainGraph['edges'][number] {
  return {
    id,
    source,
    target,
    chainId,
    label: '1.00 CNY',
    amount: 100n,
    currencyType: 1,
    status,
    color: '#0f766e',
    relatedTransactionRecord: 'record',
    relatedTransactionMount: 'mount',
    relatedTransactionMountTimestamp: 1n,
  }
}
```

4. Add these tests inside the existing `describe` block:

```tsx
  it('searches and focuses the first matching node', () => {
    const onSelectNode = vi.fn()
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={onSelectNode}
      />,
    )

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'node-c' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定位节点' }))

    expect(onSelectNode).toHaveBeenCalledWith(baseGraph.nodes[2])
    expect(hookMocks.focusNode).toHaveBeenCalledWith('node-c')
  })

  it('switches to cycle highlighting when cycles are available', () => {
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '循环链路' }))

    const params = vi.mocked(useCytoscapeGraph).mock.calls.at(-1)?.[0] as
      | { cycleChainIds?: Set<string>; highlightMode?: string }
      | undefined

    expect(params?.highlightMode).toBe('cycles')
    expect(Array.from(params?.cycleChainIds ?? [])).toEqual(['chain-c'])
  })

  it('disables cycle highlighting when no cycle edges exist', () => {
    render(
      <NetworkGraph
        graph={{
          ...baseGraph,
          edges: baseGraph.edges.map((item) => ({ ...item, status: 'open' as const })),
        }}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '循环链路' })).toBeDisabled()
  })

  it('shows selected short id and density guidance for large graphs', () => {
    const largeGraph: ChainGraph = {
      ...baseGraph,
      nodes: Array.from({ length: 101 }, (_, index) => node(`node-${index}`)),
    }

    render(
      <NetworkGraph
        graph={largeGraph}
        selectedId="node-100"
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    expect(screen.getByText('选中 NODE-1')).toBeInTheDocument()
    expect(screen.getByText('节点较多，建议使用搜索定位')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/components/NetworkGraph.test.tsx
```

Expected: fail because `GraphTools` does not expose highlight mode buttons and `NetworkGraph` does not render `GraphSearch`.

- [ ] **Step 3: Extend GraphTools**

Replace `src/components/network-graph/GraphTools.tsx` with:

```tsx
import { Download, Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import type { GraphHighlightMode } from './graphViewState'
import { Button } from '../ui/button'

interface GraphToolsProps {
  hasCycles: boolean
  highlightMode: GraphHighlightMode
  onDownloadPng: () => void
  onFit: () => void
  onHighlightModeChange: (mode: GraphHighlightMode) => void
  onZoomBy: (delta: number) => void
}

export function GraphTools({
  hasCycles,
  highlightMode,
  onDownloadPng,
  onFit,
  onHighlightModeChange,
  onZoomBy,
}: GraphToolsProps) {
  return (
    <div className="graph-tools" aria-label="图谱控制">
      <div className="graph-tools__mode" role="group" aria-label="高亮模式">
        <Button
          aria-label="相关链路"
          aria-pressed={highlightMode === 'related'}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onHighlightModeChange('related')}
        >
          相关
        </Button>
        <Button
          aria-label="循环链路"
          aria-pressed={highlightMode === 'cycles'}
          disabled={!hasCycles}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => onHighlightModeChange('cycles')}
        >
          循环
        </Button>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="放大"
        title="放大"
        onClick={() => onZoomBy(0.15)}
      >
        <ZoomIn aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="缩小"
        title="缩小"
        onClick={() => onZoomBy(-0.15)}
      >
        <ZoomOut aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="适配图谱"
        title="适配图谱"
        onClick={onFit}
      >
        <Maximize2 aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="下载 PNG"
        title="下载 PNG"
        onClick={onDownloadPng}
      >
        <Download aria-hidden="true" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Wire NetworkGraph UI and hook props**

Modify `src/components/NetworkGraph.tsx`:

1. Add imports:

```ts
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { shortId } from '../lib/chainGraph'
import { GraphSearch } from './network-graph/GraphSearch'
import type { GraphHighlightMode } from './network-graph/graphViewState'
```

2. Add cycle state after `selectedChainIds`:

```ts
  const cycleChainIds = useMemo(
    () => new Set(graph.edges.filter((edge) => edge.status === 'looped').map((edge) => edge.chainId)),
    [graph.edges],
  )
  const hasCycles = cycleChainIds.size > 0
  const [highlightMode, setHighlightMode] = useState<GraphHighlightMode>('related')

  useEffect(() => {
    if (!hasCycles && highlightMode === 'cycles') setHighlightMode('related')
  }, [hasCycles, highlightMode])
```

3. Update the hook call:

```ts
  const { containerRef, cyRef, focusNode } = useCytoscapeGraph({
    graph,
    selectedId,
    selectedChainIds,
    cycleChainIds,
    highlightMode,
    onSelectNode,
    onSelectEdge,
    onOpenMenu: setMenu,
    onCloseMenu: closeMenu,
  })
```

4. Add search handler after `handleDownloadPng`:

```ts
  const handleSearchSelect = useCallback(
    (node: ChainGraphNode) => {
      onSelectNode(node)
      focusNode(node.id)
    },
    [focusNode, onSelectNode],
  )
```

5. Replace `selectedState` with:

```ts
  const activeHighlightCount = highlightMode === 'cycles' ? cycleChainIds.size : selectedChainIds.size
  const selectedState = selectedId ? `选中 ${shortId(selectedId)}` : '未选择'
  const highlightState = highlightMode === 'cycles' ? `循环 ${cycleChainIds.size}` : `高亮链 ${activeHighlightCount}`
  const densityHint = graph.nodes.length > 100 ? '节点较多，建议使用搜索定位' : null
```

6. In `.graph-statusbar__meta`, add highlight and density spans:

```tsx
          <span>{highlightState}</span>
          <span>{selectedState}</span>
          {densityHint ? <span>{densityHint}</span> : null}
```

7. Render search after the canvas:

```tsx
      <GraphSearch nodes={graph.nodes} onSelectNode={handleSearchSelect} />
```

8. Update the `GraphTools` render:

```tsx
      <GraphTools
        hasCycles={hasCycles}
        highlightMode={highlightMode}
        onDownloadPng={handleDownloadPng}
        onFit={fitGraph}
        onHighlightModeChange={setHighlightMode}
        onZoomBy={zoomBy}
      />
```

- [ ] **Step 5: Add search and mode CSS**

Append to `src/styles/network-graph.css` after `.graph-tools button:hover`:

```css
.graph-tools__mode {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-right: 4px;
  padding-right: 4px;
  border-right: 1px solid rgb(217 222 232 / 0.9);
}

.graph-tools__mode button {
  width: auto;
  min-width: 42px;
  padding: 0 8px;
}

.graph-tools__mode button[aria-pressed='true'] {
  background: var(--teal-soft);
  color: var(--teal);
}

.graph-search {
  position: absolute;
  top: 68px;
  right: 16px;
  z-index: 14;
  display: grid;
  gap: 4px;
  width: min(280px, calc(100vw - 32px));
  border: 1px solid rgb(198 207 220 / 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  padding: 6px;
  box-shadow:
    0 16px 42px -28px rgba(30, 42, 62, 0.42),
    0 1px 8px -5px rgba(30, 42, 62, 0.22);
}

.graph-search__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 4px;
}

.graph-search__hint {
  padding: 0 2px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
}
```

- [ ] **Step 6: Run focused tests and commit**

Run:

```bash
npm test -- src/components/NetworkGraph.test.tsx src/components/network-graph/GraphSearch.test.tsx
```

Expected: pass.

Run:

```bash
npm run lint
```

Expected: pass.

Commit:

```bash
git add src/components/network-graph/GraphTools.tsx src/components/NetworkGraph.tsx src/components/NetworkGraph.test.tsx src/styles/network-graph.css
git commit -m "feat: wire graph search and highlight controls"
```

## Task 5: Persist and Restore Graph View State

**Purpose:** Save graph pan, zoom, selection, and highlight mode under `nmsci.graph.view.v1` and restore only valid state for the current graph.

**Files:**

- Modify: `src/components/NetworkGraph.tsx`
- Modify: `src/components/NetworkGraph.test.tsx`
- Modify: `src/components/network-graph/useCytoscapeGraph.ts`

- [ ] **Step 1: Add persistence tests**

Add these tests to `src/components/NetworkGraph.test.tsx`:

Update the test imports:

```ts
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
```

```tsx
  it('restores a saved node selection and initial view state', () => {
    localStorage.setItem(
      'nmsci.graph.view.v1',
      JSON.stringify({
        zoom: 1.4,
        pan: { x: 12, y: 18 },
        selectedId: 'node-c',
        highlightMode: 'related',
      }),
    )
    const onSelectNode = vi.fn()

    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={onSelectNode}
      />,
    )

    const params = vi.mocked(useCytoscapeGraph).mock.calls.at(-1)?.[0] as
      | { initialViewState?: unknown }
      | undefined

    expect(onSelectNode).toHaveBeenCalledWith(baseGraph.nodes[2])
    expect(params?.initialViewState).toEqual({
      zoom: 1.4,
      pan: { x: 12, y: 18 },
      selectedId: 'node-c',
      highlightMode: 'related',
    })
  })

  it('saves selection and highlight mode changes', () => {
    const onSelectNode = vi.fn()
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={onSelectNode}
      />,
    )

    fireEvent.change(screen.getByLabelText('搜索图谱节点'), {
      target: { value: 'node-d' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定位节点' }))
    fireEvent.click(screen.getByRole('button', { name: '循环链路' }))

    expect(localStorage.getItem('nmsci.graph.view.v1')).toContain('"selectedId":"node-d"')
    expect(localStorage.getItem('nmsci.graph.view.v1')).toContain('"highlightMode":"cycles"')
  })

  it('saves pan and zoom changes reported by Cytoscape', () => {
    render(
      <NetworkGraph
        graph={baseGraph}
        selectedId={null}
        onSelectEdge={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    )

    const params = vi.mocked(useCytoscapeGraph).mock.calls.at(-1)?.[0] as
      | { onViewChange?: (view: { zoom: number; pan: { x: number; y: number } }) => void }
      | undefined
    act(() => {
      params?.onViewChange?.({ zoom: 1.8, pan: { x: 40, y: -10 } })
    })

    expect(localStorage.getItem('nmsci.graph.view.v1')).toContain('"zoom":1.8')
    expect(localStorage.getItem('nmsci.graph.view.v1')).toContain('"pan":{"x":40,"y":-10}')
  })
```

Add this cleanup near the top of the test file:

```ts
afterEach(() => {
  localStorage.clear()
  hookMocks.focusNode.mockClear()
  vi.mocked(useCytoscapeGraph).mockClear()
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/components/NetworkGraph.test.tsx
```

Expected: fail because `NetworkGraph` does not load or save `nmsci.graph.view.v1`.

- [ ] **Step 3: Add NetworkGraph persistence**

Modify `src/components/NetworkGraph.tsx`:

1. Update imports:

```ts
import {
  loadGraphViewState,
  normalizeGraphViewState,
  saveGraphViewState,
  type GraphHighlightMode,
  type GraphViewState,
} from './network-graph/graphViewState'
```

2. Add graph element ids after `hasCycles`:

```ts
  const graphElementIds = useMemo(
    () => new Set([...graph.nodes.map((node) => node.id), ...graph.edges.map((edge) => edge.id)]),
    [graph.edges, graph.nodes],
  )
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes])
  const edgeById = useMemo(() => new Map(graph.edges.map((edge) => [edge.id, edge])), [graph.edges])
```

3. Replace the highlight mode state with:

```ts
  const initialViewState = useMemo(
    () => loadGraphViewState(undefined, { elementIds: graphElementIds, hasCycles }),
    [graphElementIds, hasCycles],
  )
  const [graphViewState, setGraphViewState] = useState<GraphViewState>(initialViewState)
  const highlightMode = graphViewState.highlightMode

  const persistGraphViewState = useCallback(
    (patch: Partial<GraphViewState>) => {
      setGraphViewState((current) => {
        const next = normalizeGraphViewState(
          {
            ...current,
            ...patch,
            pan: patch.pan ?? current.pan,
          },
          { elementIds: graphElementIds, hasCycles },
        )
        saveGraphViewState(next, undefined, { elementIds: graphElementIds, hasCycles })
        return next
      })
    },
    [graphElementIds, hasCycles],
  )
```

4. Replace the no-cycles effect with:

```ts
  useEffect(() => {
    if (!hasCycles && highlightMode === 'cycles') {
      persistGraphViewState({ highlightMode: 'related' })
    }
  }, [hasCycles, highlightMode, persistGraphViewState])
```

5. Add restored selection effect:

```ts
  useEffect(() => {
    const restoredSelectedId = initialViewState.selectedId
    if (!restoredSelectedId || selectedId === restoredSelectedId) return

    const restoredNode = nodeById.get(restoredSelectedId)
    if (restoredNode) {
      onSelectNode(restoredNode)
      return
    }

    const restoredEdge = edgeById.get(restoredSelectedId)
    if (restoredEdge) onSelectEdge(restoredEdge)
  }, [edgeById, initialViewState.selectedId, nodeById, onSelectEdge, onSelectNode, selectedId])
```

6. Update `handleSearchSelect`:

```ts
  const handleSearchSelect = useCallback(
    (node: ChainGraphNode) => {
      onSelectNode(node)
      focusNode(node.id)
      persistGraphViewState({ selectedId: node.id })
    },
    [focusNode, onSelectNode, persistGraphViewState],
  )
```

7. Add mode setter:

```ts
  const handleHighlightModeChange = useCallback(
    (mode: GraphHighlightMode) => {
      persistGraphViewState({ highlightMode: mode })
    },
    [persistGraphViewState],
  )
```

8. Add view change handler:

```ts
  const handleViewChange = useCallback(
    (view: Pick<GraphViewState, 'zoom' | 'pan'>) => {
      persistGraphViewState(view)
    },
    [persistGraphViewState],
  )
```

9. Update the hook call:

```ts
    initialViewState={initialViewState}
    onViewChange={handleViewChange}
```

10. Update `GraphTools`:

```tsx
        onHighlightModeChange={handleHighlightModeChange}
```

- [ ] **Step 4: Confirm useCytoscapeGraph uses the view callback**

If Task 3 did not add the `initialViewState` and `onViewChange` hook logic exactly, update `src/components/network-graph/useCytoscapeGraph.ts` now with the snippets from Task 3 Step 4 items 7 and 8.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm test -- src/components/NetworkGraph.test.tsx src/components/network-graph/graphViewState.test.ts
```

Expected: pass.

Run:

```bash
npm run lint
```

Expected: pass.

Commit:

```bash
git add src/components/NetworkGraph.tsx src/components/NetworkGraph.test.tsx src/components/network-graph/useCytoscapeGraph.ts
git commit -m "feat: persist graph view state"
```

## Task 6: Full Verification and Integration Fixes

**Purpose:** Run the project quality gates and fix integration fallout from the graph changes.

**Files:**

- Modify only files touched by previous tasks if verification finds a specific failure.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: all test files pass. Existing baseline before this plan was 43 files and 213 tests; the new count will be higher because this plan adds three test files and extends `NetworkGraph.test.tsx`.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: pass. If lint reports an unused import, remove that import from the named file and rerun this command.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: pass. The existing `@nmsci/sdk` browser externalization warning for Node `crypto` may still appear; this plan does not address SDK bundling.

- [ ] **Step 4: Commit verification-only fixes**

If Step 1, 2, or 3 required small test or type fixes, commit them:

```bash
git add src/components src/styles
git commit -m "fix: stabilize graph visualization integration"
```

If no files changed after verification, skip this commit.

- [ ] **Step 5: Record final status**

Run:

```bash
git status --short
git log --oneline -6
```

Expected: `git status --short` has no unstaged or staged changes. The recent log includes the graph state, search, highlight, persistence, and any verification fix commits.

## Self-Review

- Spec coverage: Task 1 and Task 5 cover `nmsci.graph.view.v1`; Task 2 and Task 4 cover search; Task 3 and Task 4 cover related/cycle highlighting; Task 4 covers density hints; Task 6 covers verification.
- Scope check: the plan stays inside `src/components/network-graph/*`, `src/components/NetworkGraph.tsx`, `src/components/NetworkGraph.test.tsx`, and `src/styles/network-graph.css`; it does not touch backend APIs, keyring, transaction dialogs, or network explorer controllers.
- Type consistency: `GraphHighlightMode` is defined once in `graphViewState.ts` and reused by `GraphTools`, `NetworkGraph`, `graphHighlight`, and `useCytoscapeGraph`; `GraphViewState` owns `zoom`, `pan`, `selectedId`, and `highlightMode`.
