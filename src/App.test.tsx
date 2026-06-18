import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_LAYOUT_STORAGE_KEY,
  installAppTestLifecycle,
  openBrowseTab,
  openQueryTab,
  readSource,
  sourceExists,
} from './test/appTestHarness'
import App from './App'

describe('App initial state', () => {
  installAppTestLifecycle()

  it('starts as a graph-first workspace with collapsed panel entries', () => {
    localStorage.clear()
    const { container } = render(<App />)

    expect(container.querySelector('#network-graph')).toBeTruthy()
    expect(container.querySelectorAll('.dock-icon')).toHaveLength(6)
    expect(container.querySelector('[role="tab"]')).toBeNull()
    expect(container.querySelector('.topbar')).toBeNull()
    expect(localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)).toBeNull()
  })

  it('starts without demo data or a demo reset action', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /demo/i })).toBeNull()
    expect((screen.getByLabelText('流转节点 ID / 公钥') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText('运行查询以探索消费网络。')).toBeTruthy()
    expect(document.querySelector('.topbar')).toBeNull()
  })

  it('renders the main interface in Chinese', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: '跳转到图谱' })).toBeTruthy()
    expect(document.querySelector('.topbar')).toBeNull()
    expect(screen.getByRole('tab', { name: '查询' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '浏览' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '密钥' })).toBeNull()
  })

  it('splits graph chrome into reusable panel content components', () => {
    const graphPanel = readSource('src/features/network-explorer/components/GraphPanel.tsx')
    expect(graphPanel).not.toContain('graph-welcome')
    expect(graphPanel).not.toContain('metrics-strip')
    expect(graphPanel).not.toContain('export-bar')
    expect(graphPanel).not.toContain('探索消费网络')

    expect(sourceExists('src/features/network-explorer/components/MetricsPanelContent.tsx')).toBe(
      true,
    )
    expect(sourceExists('src/features/network-explorer/components/ExportPanelContent.tsx')).toBe(
      true,
    )
    expect(sourceExists('src/features/network-explorer/components/SystemPanelContent.tsx')).toBe(
      true,
    )

    const metricsPanel = sourceExists(
      'src/features/network-explorer/components/MetricsPanelContent.tsx',
    )
      ? readSource('src/features/network-explorer/components/MetricsPanelContent.tsx')
      : ''
    const exportPanel = sourceExists(
      'src/features/network-explorer/components/ExportPanelContent.tsx',
    )
      ? readSource('src/features/network-explorer/components/ExportPanelContent.tsx')
      : ''
    const systemPanel = sourceExists(
      'src/features/network-explorer/components/SystemPanelContent.tsx',
    )
      ? readSource('src/features/network-explorer/components/SystemPanelContent.tsx')
      : ''

    expect(metricsPanel).toContain('@/components/ui/card')
    expect(metricsPanel).toContain('CardHeader')
    expect(metricsPanel).toContain('formatVolumeByCurrency')
    expect(exportPanel).toContain('graphEdgeCount === 0')
    expect(exportPanel).toContain('filteredRowCount === 0')
    expect(exportPanel).toContain('void onCopyCurl()')
    expect(systemPanel).toContain('SystemStatusStrip')
  })

  it('does not render fixed page or size controls', () => {
    const { container } = render(<App />)

    expect(container.querySelector('[name="page"]')).toBeNull()
    expect(container.querySelector('[name="size"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /上一页/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /下一页/ })).toBeNull()
  })

  it('does not show the old graph welcome card and disables export before any query', () => {
    render(<App />)

    const graph = screen.getByRole('region', { name: '网络可视化' })
    expect(within(graph).queryByText('探索消费网络')).toBeNull()
    expect(graph.querySelector('.graph-panel-body')).toHaveStyle({
      display: 'grid',
      gridRow: '1 / -1',
      minHeight: '0',
    })
    expect(screen.getByRole('button', { name: /^csv$/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^json$/i })).toBeDisabled()
  })

  it('keeps query tabs usable without the draggable query shell', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /拖动控制台面板/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /打开控制台面板/ })).toBeNull()

    openBrowseTab()
    expect(screen.getByRole('button', { name: /浏览节点/ })).toBeTruthy()

    openQueryTab()
    expect(screen.getByLabelText('流转节点 ID / 公钥')).toBeTruthy()
  })
})
