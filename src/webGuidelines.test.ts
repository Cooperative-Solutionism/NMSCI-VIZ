import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function cssRule(css: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(css)?.[1] ?? ''
}

function collectTsxFiles(dir = join(root, 'src')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return collectTsxFiles(path)
    if (!entry.isFile() || !entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) {
      return []
    }
    return relative(root, path).replaceAll('\\', '/')
  })
}

describe('web interface guideline regressions', () => {
  const uiTsx = collectTsxFiles()

  it('keeps non-auth form controls named with autocomplete disabled', () => {
    const queryPanel = read('src/features/network-explorer/components/QueryPanel.tsx')
    const recordForm = read('src/components/TransactionRecordForm.tsx')
    const mountForm = read('src/components/TransactionMountForm.tsx')
    const flowPanel = read('src/components/FlowNodeOperatePanel.tsx')
    const vaultGate = read('src/components/VaultGate.tsx')

    for (const name of ['apiBase', 'nodeId', 'currencyFilter']) {
      expect(queryPanel).toContain(`name="${name}"`)
    }
    expect(queryPanel).not.toContain('name="page"')
    expect(queryPanel).not.toContain('name="size"')
    for (const name of [
      'consumeNodePubkey',
      'amount',
      'currencyType',
      'difficultyHex',
      'centralPubkey',
    ]) {
      expect(recordForm).toContain(`name="${name}"`)
    }
    for (const name of ['mountedRecordId', 'mountDifficultyHex']) {
      expect(mountForm).toContain(`name="${name}"`)
    }
    for (const name of ['registerDifficultyTarget', 'authorizationCentralPubkey']) {
      expect(flowPanel).toContain(`name="${name}"`)
    }
    expect(vaultGate).toContain('name="vaultPassphrase"')
  })

  it('uses guideline typography for loading labels and text ellipses', () => {
    const text = uiTsx.map((file) => read(file)).join('\n')

    expect(text).not.toMatch(/(['"`])[^'"`\n]*\.\.\.[^'"`\n]*\1/)
    expect(text).not.toMatch(/>[^<\n]*\.\.\.[^<\n]*</)
    expect(text).not.toContain('toLocaleString()')
    expect(text).toContain('加载中…')
    expect(text).toContain('正在加载交易…')
  })

  it('marks UI identifiers as non-translatable code tokens', () => {
    const text = uiTsx.map((file) => read(file)).join('\n')
    const nodeBrowser = read('src/components/NodeBrowser.tsx')

    expect(text).not.toMatch(/<code>\{/)
    expect(nodeBrowser).toContain('className="node-browser-key" translate="no"')
  })

  it('keeps graph and stateful controls keyboard/deep-link friendly', () => {
    const networkGraph = read('src/components/NetworkGraph.tsx')
    const queryPanel = read('src/features/network-explorer/components/QueryPanel.tsx')
    const nodeBrowser = read('src/components/NodeBrowser.tsx')

    expect(networkGraph).toContain('onKeyDown={handleCanvasKeyDown}')
    expect(networkGraph).not.toContain('role="menu"')
    expect(queryPanel).toContain("useUrlStateParam<LeftTab>('panel'")
    expect(queryPanel).not.toContain("useUrlBooleanParam('panelCollapsed'")
    expect(queryPanel).not.toContain('onKeyDown={handlePanelKeyDown}')
    expect(queryPanel).not.toContain('useDraggable')
    expect(queryPanel).toContain('className="query-panel-content"')
    expect(nodeBrowser).toContain("useUrlBooleanParam('nodeBrowserOpen'")
  })

  it('keeps floating panel content split from fixed shells', () => {
    const graphPanel = read('src/features/network-explorer/components/GraphPanel.tsx')
    const inspectorPanel = read('src/features/network-explorer/components/InspectorPanel.tsx')
    const queryPanel = read('src/features/network-explorer/components/QueryPanel.tsx')
    const app = read('src/app/App.tsx')

    expect(graphPanel).not.toContain('graph-welcome')
    expect(graphPanel).not.toContain('metrics-strip')
    expect(graphPanel).not.toContain('export-bar')
    expect(queryPanel).not.toContain('floating-head')
    expect(queryPanel).not.toContain('floating-reopen')
    expect(inspectorPanel).not.toContain('LoopsPanel')
    expect(inspectorPanel).toContain('className="inspector-panel-content"')
    expect(app).toContain('MetricsPanelContent')
    expect(app).toContain('ExportPanelContent')
    expect(app).toContain('LoopsPanel')
  })

  it('uses the floating dashboard shell instead of fixed page chrome', () => {
    const app = read('src/app/App.tsx')
    const appCss = read('src/App.css')

    expect(app).toContain('DashboardWorkspace')
    expect(app).not.toContain('TopBar')

    for (const selector of [
      '.dashboard-workspace',
      '.dashboard-graph',
      '.dock-icon',
      '.floating-panel',
      '.floating-panel__header',
      '.floating-panel__body',
    ]) {
      expect(appCss).toContain(selector)
    }

    for (const selector of [
      '.topbar',
      '.workspace {',
      '.query-panel {',
      '.floating-reopen',
      '.graph-welcome',
    ]) {
      expect(appCss).not.toContain(selector)
    }
  })

  it('keeps query panel content scrollable inside the fixed shell', () => {
    const appCss = read('src/App.css')
    const contentRule = cssRule(appCss, '.query-panel-content')
    const bodyRule = cssRule(appCss, '.query-panel-content .floating-body')

    expect(contentRule).toContain('display: flex;')
    expect(contentRule).toContain('flex-direction: column;')
    expect(contentRule).toContain('min-height: 0;')
    expect(contentRule).toContain('max-height: 100%;')
    expect(bodyRule).toContain('flex: 1 1 auto;')
    expect(bodyRule).toContain('min-height: 0;')
    expect(bodyRule).toContain('overflow: auto;')
  })

  it('keeps page arguments out of consume-chain query APIs', () => {
    const forbiddenDefaultSizeName = 'default' + 'PageSize'
    const forbiddenTargetPageName = 'target' + 'Page'
    const forbiddenNumericQueryCall = new RegExp('run' + 'Query\\(\\s*\\d')
    const forbiddenPageProperty = 'page' + ':'
    const forbiddenSizeProperty = 'size' + ':'
    const forbiddenSetStateName = 'set' + 'Slice'
    const forbiddenFactoryName = 'make' + 'Slice'
    const forbiddenDtoName = 'Slice' + 'ResponseDTO'
    const forbiddenReturnEntry = 'sli' + 'ce,'
    const types = read('src/lib/types.ts')
    const chainGraph = read('src/lib/chainGraph.ts')
    const consumeQuery = read('src/hooks/useConsumeChainQuery.ts')
    const queryTypeBody =
      /export interface ConsumeChainQuery\s*\{([\s\S]*?)\n\}/.exec(types)?.[1] ?? ''
    const hookReturnBody =
      /return\s*\{[\s\S]*?currencyFilter,[\s\S]*?warning,\s*\n\s*\}/.exec(consumeQuery)?.[0] ?? ''
    const files = [
      'src/hooks/useConsumeChainQuery.ts',
      'src/features/network-explorer/hooks/useNetworkExplorerController.ts',
      'src/app/App.tsx',
      'src/hooks/useFlowNodeRegistration.ts',
      'src/features/keyring/hooks/useRegistrationController.ts',
      'src/features/network-explorer/components/QueryPanel.tsx',
    ]

    for (const file of files) {
      const text = read(file)
      expect(text, file).not.toContain(forbiddenDefaultSizeName)
      expect(text, file).not.toContain(forbiddenTargetPageName)
      expect(text, file).not.toMatch(forbiddenNumericQueryCall)
    }

    expect(queryTypeBody).not.toContain(forbiddenPageProperty)
    expect(queryTypeBody).not.toContain(forbiddenSizeProperty)
    expect(chainGraph).not.toContain('query' + '.page')
    expect(chainGraph).not.toContain('query' + '.size')
    expect(hookReturnBody).not.toContain(forbiddenPageProperty)
    expect(hookReturnBody).not.toContain(forbiddenSizeProperty)
    expect(hookReturnBody).not.toContain(forbiddenReturnEntry)
    expect(consumeQuery).not.toContain(forbiddenSetStateName)
    expect(consumeQuery).not.toContain(forbiddenFactoryName)
    expect(consumeQuery).not.toContain(forbiddenDtoName)
  })

  it('uses shared fixed pagination constants for consume-chain requests and previews', () => {
    const config = read('src/app/config.ts')
    const chainGraph = read('src/lib/chainGraph.ts')
    const consumeQuery = read('src/hooks/useConsumeChainQuery.ts')

    expect(config).toContain('dashboardQueryPage')
    expect(config).toContain('dashboardQuerySize')
    expect(chainGraph).toContain('dashboardQueryPage')
    expect(chainGraph).toContain('dashboardQuerySize')
    expect(consumeQuery).toContain('dashboardQueryPage')
    expect(consumeQuery).toContain('dashboardQuerySize')
    expect(chainGraph).not.toContain('const consumeChainUrlPage')
    expect(chainGraph).not.toContain('const consumeChainUrlSize')
  })

  it('keeps loaded-result filter wording free of page labels', () => {
    const forbiddenCurrentPageLabel = '当前' + '页'
    const forbiddenCnPageControlsLabel = '分' + '页'

    for (const file of [
      'src/features/network-explorer/components/QueryPanel.tsx',
      'src/features/network-explorer/hooks/useNetworkExplorerController.ts',
      'src/App.test.tsx',
    ]) {
      const text = read(file)
      expect(text, file).not.toContain(forbiddenCurrentPageLabel)
      expect(text, file).not.toContain(forbiddenCnPageControlsLabel)
    }
  })

  it('keeps retired page-control CSS selectors removed', () => {
    const appCss = read('src/App.css')
    const footerSelector = '.footer' + 'bar'
    const pagerSelector = '.pagina' + 'tion'

    expect(appCss).not.toContain(footerSelector)
    expect(appCss).not.toContain(pagerSelector)
  })

  it('exposes async status and errors through live regions', () => {
    for (const file of [
      'src/components/ReturnFlowCard.tsx',
      'src/components/TransactionEvidence.tsx',
      'src/components/NodeBrowser.tsx',
      'src/components/VaultGate.tsx',
      'src/features/network-explorer/components/QueryPanel.tsx',
    ]) {
      const text = read(file)
      expect(text).toMatch(/aria-live="polite"|role="status"|role="alert"/)
    }
  })
})
