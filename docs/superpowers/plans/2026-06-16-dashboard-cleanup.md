# Dashboard Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将大屏首页改为“图优先”的简洁工作台：默认只显示网络图和左侧可拖动折叠入口，所有辅助内容改为可折叠悬浮面板，移除底部分页，查询固定请求 `page=0&size=200`，并把每个面板的折叠状态、折叠入口位置、展开面板位置保存到 localStorage。

**Architecture:** 新增 `features/dashboard-layout` 负责布局状态、localStorage 持久化、悬浮面板和面板编排；现有 network explorer 业务 controller 保持不重写，只把查询、详情、循环、指标、导出、系统状态拆成可插入悬浮层的内容组件。`App.tsx` 只保留业务状态组装和 `DashboardWorkspace` 渲染。

**Tech Stack:** React + TypeScript + Vite + Vitest + Testing Library + lucide-react + CSS。

---

## Task 1: Add Dashboard Layout State Model

**Purpose:** 先用纯函数定义面板 ID、默认位置、localStorage key、归一化和持久化逻辑，避免 UI 组件直接处理脏数据。

**Files:**

- Create `src/features/dashboard-layout/dashboardLayout.ts`
- Create `src/features/dashboard-layout/dashboardLayout.test.ts`

**Steps:**

- [ ] Write failing tests:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  dashboardPanelIds,
  defaultDashboardLayout,
  loadDashboardLayout,
  normalizeDashboardLayout,
  saveDashboardLayout,
  updatePanelLayout,
} from './dashboardLayout'

describe('dashboard layout model', () => {
  it('starts with every panel collapsed on first visit', () => {
    expect(dashboardPanelIds).toEqual(['query', 'details', 'loops', 'metrics', 'export', 'system'])
    expect(Object.values(defaultDashboardLayout).every((panel) => panel.collapsed)).toBe(true)
    expect(defaultDashboardLayout.query.dockPosition).toEqual({ x: 16, y: 16 })
    expect(defaultDashboardLayout.system.dockPosition).toEqual({ x: 16, y: 296 })
  })

  it('repairs missing and malformed saved layout data', () => {
    const layout = normalizeDashboardLayout({
      query: {
        collapsed: false,
        dockPosition: { x: 24, y: 32 },
        panelPosition: { x: 88, y: 48 },
      },
      details: {
        collapsed: 'bad',
        dockPosition: { x: 'bad', y: 10 },
        panelPosition: null,
      },
    })

    expect(layout.query.collapsed).toBe(false)
    expect(layout.query.dockPosition).toEqual({ x: 24, y: 32 })
    expect(layout.details).toEqual(defaultDashboardLayout.details)
    expect(layout.loops).toEqual(defaultDashboardLayout.loops)
  })

  it('clamps stored coordinates into the visible workspace', () => {
    const layout = normalizeDashboardLayout(
      {
        query: {
          collapsed: false,
          dockPosition: { x: -200, y: 9999 },
          panelPosition: { x: 9999, y: -50 },
        },
      },
      { width: 320, height: 240 },
    )

    expect(layout.query.dockPosition).toEqual({ x: 0, y: 192 })
    expect(layout.query.panelPosition).toEqual({ x: 320, y: 0 })
  })

  it('loads defaults when localStorage is empty or invalid', () => {
    const emptyStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    } as unknown as Storage

    expect(loadDashboardLayout(emptyStorage)).toEqual(defaultDashboardLayout)

    const invalidStorage = {
      getItem: vi.fn(() => '{bad json'),
      setItem: vi.fn(),
    } as unknown as Storage

    expect(loadDashboardLayout(invalidStorage)).toEqual(defaultDashboardLayout)
  })

  it('saves normalized layout JSON', () => {
    const storage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
    } as unknown as Storage

    saveDashboardLayout(
      updatePanelLayout(defaultDashboardLayout, 'query', {
        collapsed: false,
        dockPosition: { x: 20, y: 30 },
      }),
      storage,
    )

    expect(storage.setItem).toHaveBeenCalledWith(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      expect.stringContaining('"query"'),
    )
  })
})
```

- [ ] Run and confirm the new tests fail because the module does not exist:

```powershell
npm test -- src/features/dashboard-layout/dashboardLayout.test.ts
```

- [ ] Implement `dashboardLayout.ts`:

```ts
export type DashboardPanelId = 'query' | 'details' | 'loops' | 'metrics' | 'export' | 'system'

export type DashboardPoint = {
  x: number
  y: number
}

export type DashboardPanelLayout = {
  collapsed: boolean
  dockPosition: DashboardPoint
  panelPosition: DashboardPoint
}

export type DashboardLayoutState = Record<DashboardPanelId, DashboardPanelLayout>

export const DASHBOARD_LAYOUT_STORAGE_KEY = 'nmsci.dashboard.layout.v1'

export const dashboardPanelIds: DashboardPanelId[] = [
  'query',
  'details',
  'loops',
  'metrics',
  'export',
  'system',
]

export const defaultDashboardLayout: DashboardLayoutState = {
  query: {
    collapsed: true,
    dockPosition: { x: 16, y: 16 },
    panelPosition: { x: 72, y: 16 },
  },
  details: {
    collapsed: true,
    dockPosition: { x: 16, y: 72 },
    panelPosition: { x: 880, y: 80 },
  },
  loops: {
    collapsed: true,
    dockPosition: { x: 16, y: 128 },
    panelPosition: { x: 880, y: 360 },
  },
  metrics: {
    collapsed: true,
    dockPosition: { x: 16, y: 184 },
    panelPosition: { x: 72, y: 96 },
  },
  export: {
    collapsed: true,
    dockPosition: { x: 16, y: 240 },
    panelPosition: { x: 72, y: 176 },
  },
  system: {
    collapsed: true,
    dockPosition: { x: 16, y: 296 },
    panelPosition: { x: 72, y: 256 },
  },
}

const dockSize = 48

const isPoint = (value: unknown): value is DashboardPoint => {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<DashboardPoint>
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

const clampPoint = (
  point: DashboardPoint,
  bounds?: { width: number; height: number },
  size = 0,
) => {
  if (!bounds) return point

  return {
    x: Math.min(Math.max(0, point.x), Math.max(0, bounds.width - size)),
    y: Math.min(Math.max(0, point.y), Math.max(0, bounds.height - size)),
  }
}

export const normalizeDashboardLayout = (
  input: unknown,
  bounds?: { width: number; height: number },
): DashboardLayoutState => {
  const source = input && typeof input === 'object' ? (input as Partial<DashboardLayoutState>) : {}

  return dashboardPanelIds.reduce((layout, id) => {
    const fallback = defaultDashboardLayout[id]
    const candidate = source[id] as Partial<DashboardPanelLayout> | undefined
    const collapsed =
      typeof candidate?.collapsed === 'boolean' ? candidate.collapsed : fallback.collapsed
    const dockPosition = isPoint(candidate?.dockPosition)
      ? candidate.dockPosition
      : fallback.dockPosition
    const panelPosition = isPoint(candidate?.panelPosition)
      ? candidate.panelPosition
      : fallback.panelPosition

    layout[id] = {
      collapsed,
      dockPosition: clampPoint(dockPosition, bounds, dockSize),
      panelPosition: clampPoint(panelPosition, bounds),
    }

    return layout
  }, {} as DashboardLayoutState)
}

export const loadDashboardLayout = (storage = window.localStorage): DashboardLayoutState => {
  try {
    const raw = storage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)
    return normalizeDashboardLayout(raw ? JSON.parse(raw) : null)
  } catch {
    return defaultDashboardLayout
  }
}

export const saveDashboardLayout = (
  layout: DashboardLayoutState,
  storage = window.localStorage,
): void => {
  storage.setItem(DASHBOARD_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeDashboardLayout(layout)))
}

export const updatePanelLayout = (
  layout: DashboardLayoutState,
  panelId: DashboardPanelId,
  patch: Partial<DashboardPanelLayout>,
): DashboardLayoutState => ({
  ...layout,
  [panelId]: {
    ...layout[panelId],
    ...patch,
  },
})
```

- [ ] Re-run the focused test:

```powershell
npm test -- src/features/dashboard-layout/dashboardLayout.test.ts
```

- [ ] Commit:

```powershell
git add src/features/dashboard-layout/dashboardLayout.ts src/features/dashboard-layout/dashboardLayout.test.ts
git commit -m "添加大屏布局状态模型"
```

## Task 2: Extend Draggable Hook for Persisted Positions

**Purpose:** 复用现有拖拽能力，让折叠入口和展开面板都能传入初始位置，并只在拖拽结束或键盘微调后写入 layout 状态。

**Files:**

- Modify `src/shared/hooks/useDraggable.ts`
- Create `src/shared/hooks/useDraggable.test.tsx`

**Steps:**

- [ ] Write tests for initial position, pointer drag end, and keyboard nudge:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useDraggable } from './useDraggable'

function DragProbe({ onDragEnd }: { onDragEnd: (position: { x: number; y: number }) => void }) {
  const draggable = useDraggable<HTMLButtonElement>({
    initialPosition: { x: 10, y: 20 },
    onDragEnd,
  })

  return (
    <button
      ref={draggable.elementRef}
      style={draggable.style}
      onPointerDown={draggable.onPointerDown}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') draggable.nudgeBy(8, 0)
      }}
    >
      drag
    </button>
  )
}

describe('useDraggable', () => {
  it('applies the initial position', () => {
    render(<DragProbe onDragEnd={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'drag' })).toHaveStyle({
      transform: 'translate3d(10px, 20px, 0)',
    })
  })

  it('reports keyboard nudges as completed drag positions', async () => {
    const onDragEnd = vi.fn()
    const user = userEvent.setup()

    render(<DragProbe onDragEnd={onDragEnd} />)

    await user.tab()
    await user.keyboard('{ArrowRight}')

    expect(onDragEnd).toHaveBeenCalledWith({ x: 18, y: 20 })
  })
})
```

- [ ] Run and confirm failure before the hook change:

```powershell
npm test -- src/shared/hooks/useDraggable.test.tsx
```

- [ ] Update hook options and initialization:

```ts
type DraggablePoint = {
  x: number
  y: number
}

type UseDraggableOptions = {
  boundsRef?: RefObject<HTMLElement>
  margin?: number
  initialPosition?: DraggablePoint | null
  onDragEnd?: (position: DraggablePoint) => void
}

const [position, setPosition] = useState<DraggablePoint>(() => initialPosition ?? { x: 0, y: 0 })

useEffect(() => {
  if (!initialPosition) return
  setPosition(initialPosition)
}, [initialPosition?.x, initialPosition?.y])
```

- [ ] Update pointer-up and `nudgeBy` paths to call `onDragEnd` with the final clamped position:

```ts
const completeDrag = useCallback(
  (nextPosition: DraggablePoint) => {
    onDragEnd?.(nextPosition)
  },
  [onDragEnd],
)

const nudgeBy = useCallback(
  (deltaX: number, deltaY: number) => {
    setPosition((current) => {
      const next = clampPosition({
        x: current.x + deltaX,
        y: current.y + deltaY,
      })
      completeDrag(next)
      return next
    })
  },
  [clampPosition, completeDrag],
)
```

- [ ] Run focused and existing tests that exercise QueryPanel dragging:

```powershell
npm test -- src/shared/hooks/useDraggable.test.tsx src/App.test.tsx
```

- [ ] Commit:

```powershell
git add src/shared/hooks/useDraggable.ts src/shared/hooks/useDraggable.test.tsx
git commit -m "扩展拖拽位置持久化支持"
```

## Task 3: Add Floating Dock and Panel Components

**Purpose:** 建立通用 UI 基础件，支持折叠入口可拖动、展开面板可拖动、键盘微调和清晰的中文辅助名称。

**Files:**

- Create `src/features/dashboard-layout/components/DockIcon.tsx`
- Create `src/features/dashboard-layout/components/FloatingPanel.tsx`
- Create `src/features/dashboard-layout/components/FloatingPanel.test.tsx`

**Steps:**

- [ ] Write tests for collapsed icon and expanded panel controls:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'
import { DockIcon } from './DockIcon'
import { FloatingPanel } from './FloatingPanel'

describe('floating dashboard components', () => {
  it('renders a draggable dock icon with an expanded state', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()

    render(
      <DockIcon
        label="查询"
        icon={Search}
        position={{ x: 16, y: 16 }}
        onOpen={onOpen}
        onPositionChange={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: '打开查询面板' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(onOpen).toHaveBeenCalled()
  })

  it('renders a floating panel with a collapse button', async () => {
    const user = userEvent.setup()
    const onCollapse = vi.fn()

    render(
      <FloatingPanel
        title="查询"
        position={{ x: 72, y: 16 }}
        onCollapse={onCollapse}
        onPositionChange={vi.fn()}
      >
        <p>面板内容</p>
      </FloatingPanel>,
    )

    expect(screen.getByRole('dialog', { name: '查询' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '折叠查询面板' }))
    expect(onCollapse).toHaveBeenCalled()
  })
})
```

- [ ] Implement `DockIcon.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'
import { KeyboardEvent } from 'react'
import { useDraggable } from '../../../shared/hooks/useDraggable'
import type { DashboardPoint } from '../dashboardLayout'

type DockIconProps = {
  label: string
  icon: LucideIcon
  position: DashboardPoint
  onOpen: () => void
  onPositionChange: (position: DashboardPoint) => void
}

export function DockIcon({ label, icon: Icon, position, onOpen, onPositionChange }: DockIconProps) {
  const draggable = useDraggable<HTMLButtonElement>({
    initialPosition: position,
    onDragEnd: onPositionChange,
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') draggable.nudgeBy(0, -8)
    if (event.key === 'ArrowDown') draggable.nudgeBy(0, 8)
    if (event.key === 'ArrowLeft') draggable.nudgeBy(-8, 0)
    if (event.key === 'ArrowRight') draggable.nudgeBy(8, 0)
  }

  return (
    <button
      ref={draggable.elementRef}
      type="button"
      className="dock-icon"
      style={draggable.style}
      aria-label={`打开${label}面板`}
      aria-expanded="false"
      title={label}
      onClick={onOpen}
      onPointerDown={draggable.onPointerDown}
      onKeyDown={handleKeyDown}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
```

- [ ] Implement `FloatingPanel.tsx`:

```tsx
import { ChevronLeft, GripVertical } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useDraggable } from '../../../shared/hooks/useDraggable'
import type { DashboardPoint } from '../dashboardLayout'

type FloatingPanelProps = {
  title: string
  position: DashboardPoint
  children: ReactNode
  onCollapse: () => void
  onPositionChange: (position: DashboardPoint) => void
}

export function FloatingPanel({
  title,
  position,
  children,
  onCollapse,
  onPositionChange,
}: FloatingPanelProps) {
  const draggable = useDraggable<HTMLDivElement>({
    initialPosition: position,
    onDragEnd: onPositionChange,
  })

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') draggable.nudgeBy(0, -8)
    if (event.key === 'ArrowDown') draggable.nudgeBy(0, 8)
    if (event.key === 'ArrowLeft') draggable.nudgeBy(-8, 0)
    if (event.key === 'ArrowRight') draggable.nudgeBy(8, 0)
  }

  return (
    <section
      ref={draggable.elementRef}
      className="floating-panel"
      style={draggable.style}
      role="dialog"
      aria-label={title}
    >
      <div
        className="floating-panel__header"
        role="button"
        tabIndex={0}
        aria-label={`移动${title}面板`}
        onPointerDown={draggable.onPointerDown}
        onKeyDown={handleKeyDown}
      >
        <GripVertical size={16} aria-hidden="true" />
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={`折叠${title}面板`}
          onClick={onCollapse}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="floating-panel__body">{children}</div>
    </section>
  )
}
```

- [ ] Run tests:

```powershell
npm test -- src/features/dashboard-layout/components/FloatingPanel.test.tsx
```

- [ ] Commit:

```powershell
git add src/features/dashboard-layout/components/DockIcon.tsx src/features/dashboard-layout/components/FloatingPanel.tsx src/features/dashboard-layout/components/FloatingPanel.test.tsx
git commit -m "添加悬浮面板基础组件"
```

## Task 4: Create Dashboard Workspace and Panel Registry

**Purpose:** 用一个工作台组件统一管理图、悬浮入口、展开面板和 localStorage 写入节奏。

**Files:**

- Create `src/features/dashboard-layout/components/DashboardWorkspace.tsx`
- Create `src/features/dashboard-layout/components/DashboardWorkspace.test.tsx`
- Create `src/features/dashboard-layout/panelRegistry.tsx`

**Steps:**

- [ ] Write a focused workspace test:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DashboardWorkspace } from './DashboardWorkspace'

describe('DashboardWorkspace', () => {
  it('starts with collapsed dock entries and opens a selected panel', async () => {
    const user = userEvent.setup()

    render(
      <DashboardWorkspace
        graph={<div>网络图</div>}
        panels={[
          { id: 'query', label: '查询', iconName: 'search', content: <div>查询内容</div> },
          { id: 'details', label: '详情', iconName: 'panel', content: <div>详情内容</div> },
        ]}
      />,
    )

    expect(screen.getByText('网络图')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开查询面板' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '查询' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '打开查询面板' }))

    expect(screen.getByRole('dialog', { name: '查询' })).toBeInTheDocument()
    expect(screen.getByText('查询内容')).toBeInTheDocument()
  })
})
```

- [ ] Implement a panel metadata type that uses real lucide icons:

```tsx
import {
  Activity,
  Download,
  Info,
  ListTree,
  PanelRight,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { DashboardPanelId } from './dashboardLayout'

export type DashboardPanelConfig = {
  id: DashboardPanelId
  label: string
  icon: LucideIcon
  content: ReactNode
}

export const dashboardPanelIcons: Record<DashboardPanelId, LucideIcon> = {
  query: Search,
  details: PanelRight,
  loops: ListTree,
  metrics: Activity,
  export: Download,
  system: Info,
}
```

- [ ] Implement `DashboardWorkspace` with state load once and save on layout updates:

```tsx
import { ReactNode, useMemo, useState } from 'react'
import {
  type DashboardPanelId,
  type DashboardPoint,
  loadDashboardLayout,
  saveDashboardLayout,
  updatePanelLayout,
} from '../dashboardLayout'
import { dashboardPanelIcons, type DashboardPanelConfig } from '../panelRegistry'
import { DockIcon } from './DockIcon'
import { FloatingPanel } from './FloatingPanel'

type DashboardWorkspaceProps = {
  graph: ReactNode
  panels: DashboardPanelConfig[]
}

export function DashboardWorkspace({ graph, panels }: DashboardWorkspaceProps) {
  const [layout, setLayout] = useState(() => loadDashboardLayout())
  const panelsById = useMemo(() => new Map(panels.map((panel) => [panel.id, panel])), [panels])

  const updateLayout = (
    panelId: DashboardPanelId,
    patch: Parameters<typeof updatePanelLayout>[2],
  ) => {
    setLayout((current) => {
      const next = updatePanelLayout(current, panelId, patch)
      saveDashboardLayout(next)
      return next
    })
  }

  const updateDockPosition = (panelId: DashboardPanelId, position: DashboardPoint) => {
    updateLayout(panelId, { dockPosition: position })
  }

  const updatePanelPosition = (panelId: DashboardPanelId, position: DashboardPoint) => {
    updateLayout(panelId, { panelPosition: position })
  }

  return (
    <main className="dashboard-workspace">
      <div className="dashboard-graph">{graph}</div>
      {panels.map((panel) => {
        const panelLayout = layout[panel.id]
        const Icon = panel.icon ?? dashboardPanelIcons[panel.id]

        return panelLayout.collapsed ? (
          <DockIcon
            key={panel.id}
            label={panel.label}
            icon={Icon}
            position={panelLayout.dockPosition}
            onOpen={() => updateLayout(panel.id, { collapsed: false })}
            onPositionChange={(position) => updateDockPosition(panel.id, position)}
          />
        ) : (
          <FloatingPanel
            key={panel.id}
            title={panel.label}
            position={panelLayout.panelPosition}
            onCollapse={() => updateLayout(panel.id, { collapsed: true })}
            onPositionChange={(position) => updatePanelPosition(panel.id, position)}
          >
            {panelsById.get(panel.id)?.content}
          </FloatingPanel>
        )
      })}
    </main>
  )
}
```

- [ ] Run focused test:

```powershell
npm test -- src/features/dashboard-layout/components/DashboardWorkspace.test.tsx
```

- [ ] Commit:

```powershell
git add src/features/dashboard-layout/components/DashboardWorkspace.tsx src/features/dashboard-layout/components/DashboardWorkspace.test.tsx src/features/dashboard-layout/panelRegistry.tsx
git commit -m "添加大屏工作台编排组件"
```

## Task 5: Split Current UI Content into Floating Panel Content

**Purpose:** 去掉固定顶部、固定右栏、图标题区和欢迎卡，把原内容拆成能放入悬浮面板的内容组件。

**Files:**

- Modify `src/features/network-explorer/components/GraphPanel.tsx`
- Modify `src/features/network-explorer/components/InspectorPanel.tsx`
- Modify `src/features/network-explorer/components/QueryPanel.tsx`
- Create `src/features/network-explorer/components/MetricsPanelContent.tsx`
- Create `src/features/network-explorer/components/ExportPanelContent.tsx`
- Create `src/features/network-explorer/components/SystemPanelContent.tsx`

**Steps:**

- [ ] Move metric cards from `GraphPanel` into `MetricsPanelContent`:

```tsx
import { MetricCard } from '../../../components/MetricCard'

type MetricsPanelContentProps = {
  networkNodeCount: number
  networkEdgeCount: number
  visibleRowCount: number
  selectedNodeId: string | null
}

export function MetricsPanelContent({
  networkNodeCount,
  networkEdgeCount,
  visibleRowCount,
  selectedNodeId,
}: MetricsPanelContentProps) {
  return (
    <div className="metrics-panel">
      <MetricCard label="节点" value={networkNodeCount} />
      <MetricCard label="关系" value={networkEdgeCount} />
      <MetricCard label="记录" value={visibleRowCount} />
      <MetricCard label="选中" value={selectedNodeId ?? '无'} tone="muted" />
    </div>
  )
}
```

- [ ] Move export buttons from `GraphPanel` into `ExportPanelContent`:

```tsx
type ExportPanelContentProps = {
  requestUrl: string
  onExportCsv: () => void
  onExportJson: () => void
  onCopyCurl: () => void
}

export function ExportPanelContent({
  requestUrl,
  onExportCsv,
  onExportJson,
  onCopyCurl,
}: ExportPanelContentProps) {
  return (
    <div className="export-panel">
      <button type="button" className="secondary-button" onClick={onExportCsv}>
        导出 CSV
      </button>
      <button type="button" className="secondary-button" onClick={onExportJson}>
        导出 JSON
      </button>
      <button
        type="button"
        className="secondary-button"
        onClick={onCopyCurl}
        disabled={!requestUrl}
      >
        复制 curl
      </button>
    </div>
  )
}
```

- [ ] Wrap existing `SystemStatusStrip` in `SystemPanelContent`:

```tsx
import { SystemStatusStrip } from '../../../components/SystemStatusStrip'

type SystemPanelContentProps = {
  apiBase: string
  vaultUnlocked: boolean
  loading: boolean
  hasError: boolean
}

export function SystemPanelContent(props: SystemPanelContentProps) {
  return <SystemStatusStrip {...props} />
}
```

- [ ] Simplify `GraphPanel` to render only the graph region and error boundary:

```tsx
export function GraphPanel({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  highlightedNodeIds,
  highlightedEdgeIds,
  loading,
  error,
  onSelectNode,
  onSelectEdge,
  onExtendNode,
}: GraphPanelProps) {
  return (
    <section className="graph-panel" aria-label="网络图">
      {error ? (
        <div className="graph-error" role="alert">
          {error}
        </div>
      ) : null}
      <GraphErrorBoundary>
        <NetworkGraph
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          loading={loading}
          onSelectNode={onSelectNode}
          onSelectEdge={onSelectEdge}
          onExtendNode={onExtendNode}
        />
      </GraphErrorBoundary>
    </section>
  )
}
```

- [ ] Remove the fixed shell from `QueryPanel`; keep query, browse, and keys tabs as content:

```tsx
return (
  <div className="query-panel-content">
    <div className="query-tabs" role="tablist" aria-label="查询工具">
      ...
    </div>
    ...
  </div>
)
```

- [ ] Remove `LoopsPanel` from `InspectorPanel` so it only renders selected detail content:

```tsx
return (
  <div className="inspector-panel-content">
    <header>
      <p className="eyebrow">详情</p>
      <h2>{title}</h2>
    </header>
    {content}
  </div>
)
```

- [ ] Run component tests that reference these components:

```powershell
npm test -- src/App.test.tsx src/webGuidelines.test.ts
```

- [ ] Commit:

```powershell
git add src/features/network-explorer/components
git commit -m "拆分大屏悬浮面板内容"
```

## Task 6: Fix Query Size and Remove Pagination

**Purpose:** 完全移除底部分页和页面大小输入，查询始终使用 `page=0&size=200`。

**Files:**

- Modify `src/app/config.ts`
- Modify `src/hooks/useConsumeChainQuery.ts`
- Modify `src/features/network-explorer/components/QueryPanel.tsx`
- Delete or stop rendering `src/features/network-explorer/components/FooterBar.tsx`
- Modify `src/App.test.tsx`
- Modify `src/webGuidelines.test.ts`

**Steps:**

- [ ] Update config:

```ts
export const defaultApiBase = import.meta.env.VITE_API_BASE ?? '/api'
export const dashboardQuerySize = 200
```

- [ ] Update `useConsumeChainQuery` to use fixed values:

```ts
import { dashboardQuerySize } from '../app/config'

const fixedPage = 0

const runQuery = useCallback(
  async (override?: Partial<QueryState>) => {
    const query = { mode, nodeId, loopStatus, currencyFilter, ...override }
    const result = await queryConsumeChains(apiBase, {
      mode: query.mode,
      nodeId: query.nodeId,
      loopStatus: query.loopStatus,
      currency: query.currencyFilter,
      page: fixedPage,
      size: dashboardQuerySize,
    })
    ...
  },
  [apiBase, mode, nodeId, loopStatus, currencyFilter],
)
```

- [ ] Remove these props from `QueryPanelProps` and JSX:

```ts
page: number
size: number
onSetPage: (page: number) => void
onSetSize: (size: number) => void
```

- [ ] Remove labels and inputs named `page` and `size` from `QueryPanel`.

- [ ] Remove `FooterBar` import and JSX from `src/app/App.tsx`.

- [ ] Update tests to assert the fixed request URL:

```tsx
expect(fetchSpy).toHaveBeenCalledWith(
  expect.stringContaining('/api/accounts/0xabc/consume-chain?'),
  expect.any(Object),
)
expect(fetchSpy.mock.calls[0][0].toString()).toContain('page=0')
expect(fetchSpy.mock.calls[0][0].toString()).toContain('size=200')
expect(screen.queryByRole('navigation', { name: '分页' })).not.toBeInTheDocument()
```

- [ ] Update `webGuidelines.test.ts` so it no longer expects `name="page"` or `name="size"`, and instead asserts no `FooterBar` fixed bottom UI remains.

- [ ] Run focused tests:

```powershell
npm test -- src/App.test.tsx src/webGuidelines.test.ts
```

- [ ] Commit:

```powershell
git add src/app/config.ts src/hooks/useConsumeChainQuery.ts src/features/network-explorer/components/QueryPanel.tsx src/features/network-explorer/components/FooterBar.tsx src/App.test.tsx src/webGuidelines.test.ts
git commit -m "移除底部分页并固定查询数量"
```

## Task 7: Integrate Dashboard Workspace in App and Update Styles

**Purpose:** 让 `App.tsx` 使用新的工作台，所有辅助功能由悬浮面板承载；CSS 改成全屏图面和悬浮层。

**Files:**

- Modify `src/app/App.tsx`
- Modify `src/app/App.css`
- Modify `src/App.test.tsx`

**Steps:**

- [ ] Build panel configs in `App.tsx`:

```tsx
const dashboardPanels = [
  {
    id: 'query',
    label: '查询',
    icon: dashboardPanelIcons.query,
    content: (
      <QueryPanel
        apiBase={apiBase}
        mode={mode}
        nodeId={nodeId}
        loopStatus={loopStatus}
        currencyFilter={currencyFilter}
        requestUrl={requestUrl}
        vaultUnlocked={vaultUnlocked}
        vaultLabel={vaultLabel}
        vaultMessage={vaultMessage}
        browserItems={browserItems}
        registrationDraft={registrationDraft}
        onSetApiBase={setApiBase}
        onSetMode={setMode}
        onSetNodeId={setNodeId}
        onSetLoopStatus={setLoopStatus}
        onSetCurrencyFilter={setCurrencyFilter}
        onRunQuery={() => runQuery()}
        onUnlockVault={unlockVault}
        onLockVault={lockVault}
        onAddKey={addKey}
        onImportKey={importKey}
        onSelectBrowserNode={selectBrowserNode}
        onRegistrationDraftChange={setRegistrationDraft}
        onRegisterNode={registerNode}
      />
    ),
  },
  {
    id: 'details',
    label: '详情',
    icon: dashboardPanelIcons.details,
    content: <InspectorPanel ... />,
  },
  {
    id: 'loops',
    label: '循环',
    icon: dashboardPanelIcons.loops,
    content: <LoopsPanel loops={loops} onSelectLoop={selectLoop} />,
  },
  {
    id: 'metrics',
    label: '指标',
    icon: dashboardPanelIcons.metrics,
    content: <MetricsPanelContent ... />,
  },
  {
    id: 'export',
    label: '导出',
    icon: dashboardPanelIcons.export,
    content: <ExportPanelContent ... />,
  },
  {
    id: 'system',
    label: '系统',
    icon: dashboardPanelIcons.system,
    content: <SystemPanelContent ... />,
  },
] satisfies DashboardPanelConfig[]
```

- [ ] Replace old shell JSX with:

```tsx
return (
  <div className="app-shell">
    <DashboardWorkspace
      graph={
        <GraphPanel
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          loading={loading}
          error={errorMessage}
          onSelectNode={selectNode}
          onSelectEdge={selectEdge}
          onExtendNode={extendFromNode}
        />
      }
      panels={dashboardPanels}
    />
  </div>
)
```

- [ ] Replace old page grid CSS with full-screen graph and floating surfaces:

```css
.app-shell {
  min-height: 100vh;
  background: #f5f7fb;
  color: #101828;
}

.dashboard-workspace {
  position: relative;
  width: 100vw;
  min-height: 100vh;
  overflow: hidden;
}

.dashboard-graph,
.graph-panel {
  position: absolute;
  inset: 0;
}

.dock-icon {
  position: absolute;
  z-index: 30;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(16, 24, 40, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 24px rgba(16, 24, 40, 0.14);
  color: #184e77;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
}

.floating-panel {
  position: absolute;
  z-index: 40;
  width: min(380px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow: hidden;
  border: 1px solid rgba(16, 24, 40, 0.14);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 44px rgba(16, 24, 40, 0.18);
}

.floating-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(16, 24, 40, 0.1);
  cursor: grab;
  touch-action: none;
}

.floating-panel__header h2 {
  flex: 1;
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.2;
}

.floating-panel__body {
  max-height: calc(100vh - 92px);
  overflow: auto;
  padding: 12px;
}
```

- [ ] Remove or rewrite obsolete CSS selectors for `.topbar`, `.footerbar`, old fixed `.query-panel`, old fixed `.inspector-panel`, `.graph-welcome`, `.graph-header`, and `.metrics-strip`.

- [ ] Update `App.test.tsx` helpers so tests open panels through dock buttons:

```tsx
async function openPanel(label: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: `打开${label}面板` }))
}
```

- [ ] Add regression assertions for default collapsed state and persistence:

```tsx
expect(screen.getByRole('button', { name: '打开查询面板' })).toBeInTheDocument()
expect(screen.queryByRole('dialog', { name: '查询' })).not.toBeInTheDocument()

await openPanel('查询')
expect(screen.getByRole('dialog', { name: '查询' })).toBeInTheDocument()
expect(window.localStorage.getItem('nmsci.dashboard.layout.v1')).toContain('"collapsed":false')
```

- [ ] Run app tests:

```powershell
npm test -- src/App.test.tsx
```

- [ ] Commit:

```powershell
git add src/app/App.tsx src/app/App.css src/App.test.tsx
git commit -m "接入大屏悬浮工作台"
```

## Task 8: Final Verification and Cleanup

**Purpose:** 完整验证中文化、指南测试、构建和代码格式，确保没有旧分页或固定外壳残留。

**Files:**

- Inspect all touched files
- Commit any verification-only test fixes with Chinese message

**Steps:**

- [ ] Search for old pagination UI and obsolete shell imports:

```powershell
rg -n "FooterBar|name=\"page\"|name=\"size\"|footerbar|graph-welcome|TopBar" src
```

Expected result: no app-rendered references to `FooterBar`, no `name="page"`, no `name="size"`, no `graph-welcome`, no `TopBar` import from `App.tsx`.

- [ ] Run static design guideline tests:

```powershell
npm test -- src/webGuidelines.test.ts
```

- [ ] Run the full test suite:

```powershell
npm test
```

- [ ] Run build:

```powershell
npm run build
```

- [ ] Run formatting check:

```powershell
npx prettier --check "src/**/*.{ts,tsx,css}" "docs/**/*.md"
```

- [ ] Inspect final diff:

```powershell
git status --short
git diff --check
git diff --stat
```

- [ ] If verification required test or style edits, commit them:

```powershell
git add src docs
git commit -m "完善大屏清理验证"
```
