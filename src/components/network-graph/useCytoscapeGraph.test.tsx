import { StrictMode, useEffect, type ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode } from '../../lib/types'
import { useCytoscapeGraph } from './useCytoscapeGraph'

const cyMock = vi.hoisted(() => {
  type ElementGroup = 'nodes' | 'edges'
  type Point = { x: number; y: number }
  type ElementDefinition = {
    group?: ElementGroup
    data?: Record<string, unknown>
    position?: Point
  }

  function splitClasses(classNames: string): string[] {
    return classNames.split(/\s+/).filter(Boolean)
  }

  class MockElement {
    private readonly elementId: string
    private readonly group: ElementGroup | null
    private elementData: Record<string, unknown>
    private readonly elementPosition: Point
    private removed: boolean
    readonly classes = new Set<string>()
    selected = false

    constructor(
      elementId: string,
      group: ElementGroup | null,
      data: Record<string, unknown>,
      elementPosition: Point,
      removed = false,
    ) {
      this.elementId = elementId
      this.group = group
      this.elementData = data
      this.elementPosition = elementPosition
      this.removed = removed
    }

    id(): string {
      return this.elementId
    }

    empty(): boolean {
      return this.removed
    }

    nonempty(): boolean {
      return !this.removed
    }

    data(): Record<string, unknown>
    data(next: Record<string, unknown>): this
    data(next?: Record<string, unknown>): Record<string, unknown> | this {
      if (!next) return this.elementData
      this.elementData = next
      return this
    }

    position(): Point {
      return this.elementPosition
    }

    remove(): void {
      this.removed = true
    }

    isNode(): boolean {
      return this.group === 'nodes' && !this.removed
    }

    isEdge(): boolean {
      return this.group === 'edges' && !this.removed
    }

    addClass(classNames: string): this {
      splitClasses(classNames).forEach((className) => this.classes.add(className))
      return this
    }

    removeClass(classNames: string): this {
      splitClasses(classNames).forEach((className) => this.classes.delete(className))
      return this
    }

    toggleClass(className: string, enabled: boolean): this {
      if (enabled) this.classes.add(className)
      else this.classes.delete(className)
      return this
    }

    hasClass(className: string): boolean {
      return this.classes.has(className)
    }

    select(): this {
      this.selected = true
      return this
    }

    unselect(): this {
      this.selected = false
      return this
    }
  }

  class MockCollection {
    private readonly elements: MockElement[]

    constructor(elements: MockElement[]) {
      this.elements = elements
    }

    empty(): boolean {
      return this.elements.filter((element) => element.nonempty()).length === 0
    }

    forEach(callback: (element: MockElement) => void): void {
      this.elements.filter((element) => element.nonempty()).forEach(callback)
    }

    removeClass(classNames: string): this {
      this.forEach((element) => element.removeClass(classNames))
      return this
    }

    unselect(): this {
      this.forEach((element) => element.unselect())
      return this
    }
  }

  class MockCy {
    private readonly elementsById = new Map<string, MockElement>()
    private zoomValue = 1
    private panValue: Point = { x: 0, y: 0 }
    readonly zoomCalls: number[] = []
    readonly panCalls: Point[] = []
    readonly layoutCalls: Record<string, unknown>[] = []
    readonly animateCalls: Array<{ animation: unknown; options: unknown }> = []
    readonly destroy = vi.fn()
    readonly on = vi.fn()
    readonly off = vi.fn()

    add(definition: ElementDefinition): MockElement {
      const data = definition.data ?? {}
      const id = String(data.id)
      const element = new MockElement(
        id,
        definition.group ?? 'nodes',
        data,
        definition.position ?? { x: 0, y: 0 },
      )
      this.elementsById.set(id, element)
      return element
    }

    nodes(): MockCollection {
      return new MockCollection(
        Array.from(this.elementsById.values()).filter((element) => element.isNode()),
      )
    }

    edges(): MockCollection {
      return new MockCollection(
        Array.from(this.elementsById.values()).filter((element) => element.isEdge()),
      )
    }

    elements(): MockCollection {
      return new MockCollection(Array.from(this.elementsById.values()))
    }

    getElementById(id: string): MockElement {
      return this.elementsById.get(id) ?? new MockElement(id, null, {}, { x: 0, y: 0 }, true)
    }

    extent(): { x1: number; x2: number; y1: number; y2: number } {
      return { x1: 0, x2: 400, y1: 0, y2: 300 }
    }

    layout(options: Record<string, unknown>): { run: () => void } {
      this.layoutCalls.push(options)
      return {
        run: () => {
          if (options.fit) {
            this.zoomValue = 0.45
            this.panValue = { x: -12, y: -18 }
          }
        },
      }
    }

    zoom(): number
    zoom(next: number): number
    zoom(next?: number): number {
      if (typeof next === 'number') {
        this.zoomCalls.push(next)
        this.zoomValue = next
      }
      return this.zoomValue
    }

    pan(): Point
    pan(next: Point): Point
    pan(next?: Point): Point {
      if (next) {
        this.panValue = { ...next }
        this.panCalls.push({ ...next })
      }
      return { ...this.panValue }
    }

    animate(animation: unknown, options: unknown): void {
      this.animateCalls.push({ animation, options })
    }

    view(): { zoom: number; pan: Point } {
      return {
        zoom: this.zoomValue,
        pan: { ...this.panValue },
      }
    }

    hasClass(id: string, className: string): boolean {
      return this.getElementById(id).hasClass(className)
    }
  }

  const instances: MockCy[] = []

  function instance(index = instances.length - 1): MockCy {
    const current = instances[index]
    if (!current) throw new Error(`Missing Cytoscape mock instance ${index}`)
    return current
  }

  const cytoscape = vi.fn(() => {
    const cy = new MockCy()
    instances.push(cy)
    return cy
  })

  return {
    cytoscape,
    reset: () => {
      instances.length = 0
      cytoscape.mockClear()
    },
    instanceCount: () => instances.length,
    view: (index?: number) => instance(index).view(),
    zoomCalls: (index?: number) => instance(index).zoomCalls,
    panCalls: (index?: number) => instance(index).panCalls,
    layoutCalls: (index?: number) => instance(index).layoutCalls,
    animateCalls: (index?: number) => instance(index).animateCalls,
    hasClass: (id: string, className: string, index?: number) =>
      instance(index).hasClass(id, className),
  }
})

vi.mock('cytoscape', () => ({
  default: cyMock.cytoscape,
}))

type HookParams = Parameters<typeof useCytoscapeGraph>[0]
type HookResult = ReturnType<typeof useCytoscapeGraph>

const savedView = {
  zoom: 1.7,
  pan: { x: 40, y: -24 },
  selectedId: null,
  highlightMode: 'related' as const,
}

describe('useCytoscapeGraph', () => {
  let latestHook: HookResult | null = null

  beforeEach(() => {
    latestHook = null
    cyMock.reset()
  })

  afterEach(() => {
    cleanup()
  })

  it('restores the initial view after graph data arrives instead of fitting the first layout', () => {
    const { rerender } = render(
      <HookHarness
        params={params({
          graph: emptyGraph(),
          initialViewState: savedView,
        })}
        onHook={(hook) => {
          latestHook = hook
        }}
      />,
    )

    expect(cyMock.zoomCalls()).toEqual([])
    expect(cyMock.panCalls()).toEqual([])

    rerender(
      <HookHarness
        params={params({
          graph: populatedGraph(),
          initialViewState: savedView,
        })}
        onHook={(hook) => {
          latestHook = hook
        }}
      />,
    )

    expect(cyMock.layoutCalls()).toEqual([])
    expect(cyMock.zoomCalls()).toEqual([savedView.zoom])
    expect(cyMock.panCalls()).toEqual([savedView.pan])
    expect(cyMock.view()).toEqual({
      zoom: savedView.zoom,
      pan: savedView.pan,
    })
  })

  it('does not fit local-only nodes when they are first added to an empty canvas', () => {
    const { rerender } = render(
      <HookHarness
        params={params({ graph: emptyGraph() })}
        onHook={(hook) => {
          latestHook = hook
        }}
      />,
    )

    rerender(
      <HookHarness
        params={params({ graph: localOnlyGraph() })}
        onHook={(hook) => {
          latestHook = hook
        }}
      />,
    )

    expect(cyMock.layoutCalls()).toEqual([])
  })

  it('restores the initial view on a Cytoscape instance recreated by StrictMode', () => {
    render(
      <StrictMode>
        <HookHarness
          params={params({
            graph: populatedGraph(),
            initialViewState: savedView,
          })}
          onHook={(hook) => {
            latestHook = hook
          }}
        />
      </StrictMode>,
    )

    const recreatedInstanceIndex = cyMock.instanceCount() - 1
    expect(cyMock.instanceCount()).toBeGreaterThan(1)
    expect(cyMock.zoomCalls(recreatedInstanceIndex)).toEqual([savedView.zoom])
    expect(cyMock.panCalls(recreatedInstanceIndex)).toEqual([savedView.pan])
    expect(cyMock.view(recreatedInstanceIndex)).toEqual({
      zoom: savedView.zoom,
      pan: savedView.pan,
    })
  })

  it('applies cycle highlight classes from cycle highlight mode', () => {
    render(
      <HookHarness
        params={params({
          graph: populatedGraph(),
          selectedChainIds: new Set(['chain-a']),
          cycleChainIds: new Set(['chain-b']),
          highlightMode: 'cycles',
        })}
        onHook={(hook) => {
          latestHook = hook
        }}
      />,
    )

    expect(cyMock.hasClass('edge-a', 'chain-dimmed')).toBe(true)
    expect(cyMock.hasClass('edge-b', 'chain-highlight')).toBe(true)
    expect(cyMock.hasClass('edge-b', 'cycle-highlight')).toBe(true)
    expect(cyMock.hasClass('edge-c', 'cycle-highlight')).toBe(true)
    expect(cyMock.hasClass('node-b', 'cycle-endpoint')).toBe(true)
    expect(cyMock.hasClass('node-c', 'cycle-endpoint')).toBe(true)
    expect(cyMock.hasClass('node-d', 'cycle-endpoint')).toBe(true)
  })

  it('does not animate focus for edge ids', () => {
    render(
      <HookHarness
        params={params({ graph: populatedGraph() })}
        onHook={(hook) => {
          latestHook = hook
        }}
      />,
    )

    act(() => {
      latestHook?.focusNode('edge-b')
    })

    expect(cyMock.animateCalls()).toEqual([])
  })
})

function HookHarness({
  params,
  onHook,
}: {
  params: HookParams
  onHook: (hook: HookResult) => void
}): ReactNode {
  const { containerRef, cyRef, focusNode } = useCytoscapeGraph(params)

  useEffect(() => {
    onHook({ containerRef, cyRef, focusNode })
  }, [containerRef, cyRef, focusNode, onHook])

  return <div ref={containerRef} />
}

function params(overrides: Partial<HookParams> = {}): HookParams {
  return {
    graph: emptyGraph(),
    selectedId: null,
    selectedChainIds: new Set(),
    onSelectNode: vi.fn(),
    onSelectEdge: vi.fn(),
    onOpenMenu: vi.fn(),
    onCloseMenu: vi.fn(),
    ...overrides,
  }
}

function emptyGraph(): ChainGraph {
  return {
    nodes: [],
    edges: [],
    stats: {
      totalChains: 0,
      loopedChains: 0,
      openChains: 0,
      volumeByCurrency: new Map(),
    },
  }
}

function populatedGraph(): ChainGraph {
  return {
    nodes: [node('node-a'), node('node-b'), node('node-c'), node('node-d')],
    edges: [
      edge('edge-a', 'node-a', 'node-b', 'chain-a', 'open'),
      edge('edge-b', 'node-b', 'node-c', 'chain-b', 'looped'),
      edge('edge-c', 'node-c', 'node-d', 'chain-b', 'looped'),
    ],
    stats: {
      totalChains: 2,
      loopedChains: 1,
      openChains: 1,
      volumeByCurrency: new Map([[1, 300n]]),
    },
  }
}

function localOnlyGraph(): ChainGraph {
  return {
    nodes: [
      {
        id: '03aaaaaa1111',
        label: '未注册1',
        chainCount: 0,
        volumeByCurrency: new Map(),
        kind: 'local-flow',
      },
    ],
    edges: [],
    stats: {
      totalChains: 0,
      loopedChains: 0,
      openChains: 0,
      volumeByCurrency: new Map(),
    },
  }
}

function node(id: string): ChainGraphNode {
  return {
    id,
    label: id,
    chainCount: 1,
    volumeByCurrency: new Map([[1, 100n]]),
    kind: 'chain',
  }
}

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
