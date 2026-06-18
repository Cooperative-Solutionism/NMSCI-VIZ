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

function collectCssFiles(dir = join(root, 'src')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return collectCssFiles(path)
    if (!entry.isFile() || !entry.name.endsWith('.css')) return []
    return relative(root, path).replaceAll('\\', '/')
  })
}

function readCssBundle(): string {
  return collectCssFiles()
    .map((file) => read(file))
    .join('\n')
}

describe('web interface guideline regressions', () => {
  const uiTsx = collectTsxFiles()

  it('keeps non-auth form controls named with autocomplete disabled', () => {
    const queryForm = read(
      'src/features/network-explorer/components/query-panel/QueryFormContent.tsx',
    )
    const recordForm = read('src/components/TransactionRecordForm.tsx')
    const mountForm = read('src/components/TransactionMountForm.tsx')
    const flowPanel = [
      read('src/components/flow-node-operate/FlowNodeRegistrationControls.tsx'),
      read('src/components/flow-node-operate/FlowNodeAuthorizationControls.tsx'),
    ].join('\n')
    const vaultGate = read('src/components/VaultGate.tsx')

    for (const name of ['apiBase', 'nodeId', 'currencyFilter']) {
      expect(queryForm).toContain(`name="${name}"`)
    }
    expect(queryForm).not.toContain('name="page"')
    expect(queryForm).not.toContain('name="size"')
    for (const name of [
      'consumeNodePubkey',
      'amount',
      'currencyType',
      'difficultyHex',
      'centralPubkey',
    ]) {
      expect(recordForm).toContain(`name="${name}"`)
    }
    for (const name of ['mountedRecordId', 'mountFlowNodePubkey', 'mountDifficultyHex']) {
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
    expect(text).toContain('\u52a0\u8f7d\u4e2d\u2026')
    expect(text).toContain('\u6b63\u5728\u52a0\u8f7d\u4ea4\u6613\u2026')
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
    expect(queryPanel).toMatch(/useUrlStateParam<QueryPanelTab>\(\s*'panel'/)
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
    const appCss = readCssBundle()

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
    const appCss = readCssBundle()
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

  it('lets shadcn tabs own query tab styling', () => {
    const appCss = readCssBundle()
    const tabsRule = cssRule(appCss, '.floating-tabs')

    expect(tabsRule).toContain('margin:')
    expect(tabsRule).not.toContain('grid-template-columns')
    expect(tabsRule).not.toContain('background:')
    expect(tabsRule).not.toContain('border:')
    expect(appCss).not.toContain('.floating-tabs button')
  })

  it('uses shadcn primitives for query panel controls', () => {
    const queryPanel = read('src/features/network-explorer/components/QueryPanel.tsx')
    const queryTabs = read(
      'src/features/network-explorer/components/query-panel/QueryPanelTabs.tsx',
    )
    const queryForm = read(
      'src/features/network-explorer/components/query-panel/QueryFormContent.tsx',
    )

    for (const module of [
      '../../../../components/ui/alert',
      '../../../../components/ui/badge',
      '../../../../components/ui/button',
      '../../../../components/ui/card',
      '../../../../components/ui/field',
      '../../../../components/ui/input',
      '../../../../components/ui/select',
      '../../../../components/ui/separator',
      '../../../../components/ui/textarea',
      '../../../../components/ui/toggle-group',
    ]) {
      expect(queryForm, module).toContain(module)
    }

    for (const token of [
      '<Alert',
      '<Badge',
      '<Button',
      '<Card',
      '<Field',
      '<FieldGroup',
      '<Input',
      '<Select',
      '<Separator',
      '<Textarea',
      '<ToggleGroup',
    ]) {
      expect(queryForm, token).toContain(token)
    }

    expect(queryPanel).toContain('<Tabs')
    expect(queryPanel).toContain('<TabsContent')
    expect(queryTabs).toContain('TabsList')
    expect(queryTabs).toContain('TabsTrigger')
    expect(queryTabs).not.toContain('role="tablist"')

    expect(queryForm).not.toContain("from '../../../../components'")
    expect(queryForm).not.toMatch(/<input[\s>]/)
    expect(queryForm).not.toMatch(/<textarea[\s>]/)
    expect(queryForm).not.toMatch(/<select[\s>]/)
    expect(queryForm).not.toContain('primary-button')
    expect(queryForm).not.toContain('secondary-button')
    expect(queryForm).not.toContain('segmented')
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
      'src/features/network-explorer/components/query-panel/QueryFormContent.tsx',
      'src/features/network-explorer/hooks/useNetworkExplorerController.ts',
      'src/App.test.tsx',
    ]) {
      const text = read(file)
      expect(text, file).not.toContain(forbiddenCurrentPageLabel)
      expect(text, file).not.toContain(forbiddenCnPageControlsLabel)
    }
  })

  it('keeps retired page-control CSS selectors removed', () => {
    const appCss = readCssBundle()
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
      'src/features/network-explorer/components/query-panel/QueryFormContent.tsx',
    ]) {
      const text = read(file)
      expect(text).toMatch(/aria-live="polite"|role="status"|role="alert"/)
    }
  })
})
