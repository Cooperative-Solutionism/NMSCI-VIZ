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

function collectProductTsxFiles(): string[] {
  return collectTsxFiles().filter(
    (file) => !file.startsWith('src/components/ui/') && !file.startsWith('src/test/'),
  )
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
    const browseForms = [
      read('src/features/network-explorer/components/browse-panel/BlockBrowser.tsx'),
      read('src/features/network-explorer/components/browse-panel/FlowNodeBrowser.tsx'),
    ].join('\n')
    const recordDialog = read(
      'src/features/network-explorer/components/TransactionRecordDialog.tsx',
    )
    const vaultGate = read('src/components/VaultGate.tsx')

    for (const name of ['blockPage', 'blockPageSize', 'flowNodePage', 'flowNodePageSize']) {
      expect(browseForms).toContain(`name="${name}"`)
    }
    expect(browseForms).not.toContain('name="page"')
    expect(browseForms).not.toContain('name="size"')
    // 难度与中心公钥已内化为自动拉取，记录弹窗只保留金额输入。
    expect(recordDialog).toContain('name="amount"')
    expect(recordDialog).toContain('autoComplete="off"')
    expect(recordDialog).not.toContain('name="difficultyHex"')
    expect(recordDialog).not.toContain('name="centralPubkey"')
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
    const nodeBrowser = read(
      'src/features/network-explorer/components/browse-panel/FlowNodeBrowser.tsx',
    )

    expect(text).not.toMatch(/<code>\{/)
    expect(nodeBrowser).toContain('className="node-browser-key" translate="no"')
  })

  it('keeps graph and stateful controls keyboard/deep-link friendly', () => {
    const networkGraph = read('src/components/NetworkGraph.tsx')
    const browsePanel = read('src/features/network-explorer/components/BrowsePanel.tsx')
    const flowNodeBrowser = read(
      'src/features/network-explorer/components/browse-panel/FlowNodeBrowser.tsx',
    )

    expect(networkGraph).toContain('onKeyDown={handleCanvasKeyDown}')
    expect(networkGraph).not.toContain('role="menu"')
    expect(browsePanel).toMatch(/useUrlStateParam<BrowsePanelTab>\(\s*'panel'/)
    expect(browsePanel).not.toContain("useUrlBooleanParam('panelCollapsed'")
    expect(browsePanel).not.toContain('onKeyDown={handlePanelKeyDown}')
    expect(browsePanel).not.toContain('useDraggable')
    expect(browsePanel).toContain('className="browse-panel-content"')
    expect(flowNodeBrowser).toContain("useUrlNumberParam('flowNodePage'")
  })

  it('keeps floating panel content split from fixed shells', () => {
    const graphPanel = read('src/features/network-explorer/components/GraphPanel.tsx')
    const inspectorPanel = read('src/features/network-explorer/components/InspectorPanel.tsx')
    const browsePanel = read('src/features/network-explorer/components/BrowsePanel.tsx')
    const app = read('src/app/App.tsx')

    expect(graphPanel).not.toContain('graph-welcome')
    expect(graphPanel).not.toContain('metrics-strip')
    expect(graphPanel).not.toContain('export-bar')
    expect(browsePanel).not.toContain('floating-head')
    expect(browsePanel).not.toContain('floating-reopen')
    expect(inspectorPanel).not.toContain('LoopsPanel')
    expect(inspectorPanel).toContain('className="inspector-panel-content"')
    expect(app).not.toContain('MetricsPanelContent')
    expect(app).toContain('ExportPanelContent')
    expect(app).not.toContain('LoopsPanel')
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

  it('keeps browse panel content scrollable inside the fixed shell', () => {
    const appCss = readCssBundle()
    const contentRule = cssRule(appCss, '.browse-panel-content')
    const bodyRule = cssRule(appCss, '.browse-panel-content .floating-body')

    expect(contentRule).toContain('display: flex;')
    expect(contentRule).toContain('flex-direction: column;')
    expect(contentRule).toContain('min-height: 0;')
    expect(contentRule).toContain('max-height: 100%;')
    expect(bodyRule).toContain('flex: 1 1 auto;')
    expect(bodyRule).toContain('min-height: 0;')
    expect(bodyRule).toContain('overflow: auto;')
  })

  it('lets shadcn tabs own browse tab styling', () => {
    const appCss = readCssBundle()
    const tabsRule = cssRule(appCss, '.floating-tabs')

    expect(tabsRule).toContain('margin:')
    expect(tabsRule).not.toContain('grid-template-columns')
    expect(tabsRule).not.toContain('background:')
    expect(tabsRule).not.toContain('border:')
    expect(appCss).not.toContain('.floating-tabs button')
  })

  it('uses shadcn primitives for browse panel controls', () => {
    const browsePanel = read('src/features/network-explorer/components/BrowsePanel.tsx')
    const browseTabs = read(
      'src/features/network-explorer/components/browse-panel/BrowsePanelTabs.tsx',
    )
    const browseControls = [
      read('src/features/network-explorer/components/browse-panel/BlockBrowser.tsx'),
      read('src/features/network-explorer/components/browse-panel/FlowNodeBrowser.tsx'),
    ].join('\n')
    const localNodePanel = read('src/features/keyring/components/LocalNodePanel.tsx')
    const productControls = [browseControls, localNodePanel].join('\n')

    for (const module of [
      '../../../../components/ui/alert',
      '../../../../components/ui/badge',
      '../../../../components/ui/button',
      '../../../../components/ui/card',
      '../../../../components/ui/field',
      '../../../../components/ui/input',
      '../../../../components/ui/table',
      '../../../../components/ui/toggle',
    ]) {
      expect(browseControls, module).toContain(module)
    }
    expect(localNodePanel).toContain('../../../components/ui/separator')

    for (const token of [
      '<Alert',
      '<Badge',
      '<Button',
      '<Card',
      '<Field',
      '<FieldGroup',
      '<Input',
      '<Separator',
      '<Table',
      '<Toggle',
    ]) {
      expect(productControls, token).toContain(token)
    }

    expect(browsePanel).toContain('<Tabs')
    expect(browsePanel).toContain('<TabsContent')
    expect(browseTabs).toContain('TabsList')
    expect(browseTabs).toContain('TabsTrigger')
    expect(browseTabs).not.toContain('role="tablist"')

    expect(productControls).not.toContain("from '../../../../components'")
    expect(productControls).not.toMatch(/<input[\s>]/)
    expect(productControls).not.toMatch(/<textarea[\s>]/)
    expect(productControls).not.toMatch(/<select[\s>]/)
    expect(productControls).not.toContain('primary-button')
    expect(productControls).not.toContain('secondary-button')
    expect(productControls).not.toContain('segmented')
  })

  it('uses shadcn primitives for product controls that shadcn/ui provides', () => {
    const productSources = collectProductTsxFiles().map((file) => [file, read(file)] as const)
    const nativeControlPatterns = [
      /<button[\s>]/,
      /<input[\s>]/,
      /<select[\s>]/,
      /<textarea[\s>]/,
      /<label[\s>]/,
      /<hr[\s>]/,
    ]
    const legacyTokens = [
      "from './Field'",
      "from '../Field'",
      "export * from './Field'",
      'primary-button',
      'secondary-button',
      'ghost-button',
      'icon-button',
      'className="segmented',
      '<em className="badge',
    ]

    for (const [file, source] of productSources) {
      for (const pattern of nativeControlPatterns) {
        expect(source, `${file} should use shadcn/ui instead of ${pattern}`).not.toMatch(pattern)
      }
      for (const token of legacyTokens) {
        expect(source, `${file} should not use legacy token ${token}`).not.toContain(token)
      }
    }
  })

  it('keeps consume-chain page arguments explicit in browse APIs', () => {
    const forbiddenTargetPageName = 'target' + 'Page'
    const forbiddenNumericQueryCall = new RegExp('run' + 'Query\\(\\s*\\d')
    const forbiddenSetStateName = 'set' + 'Slice'
    const forbiddenFactoryName = 'make' + 'Slice'
    const forbiddenDtoName = 'Slice' + 'ResponseDTO'
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
      'src/features/network-explorer/components/BrowsePanel.tsx',
    ]

    for (const file of files) {
      const text = read(file)
      expect(text, file).not.toContain(forbiddenTargetPageName)
      expect(text, file).not.toMatch(forbiddenNumericQueryCall)
    }

    expect(queryTypeBody).toContain('page: number')
    expect(queryTypeBody).toContain('size: number')
    expect(chainGraph).toContain('query' + '.page')
    expect(chainGraph).toContain('query' + '.size')
    expect(hookReturnBody).toContain('page: queryPage')
    expect(hookReturnBody).toContain('pageSize: queryPageSize')
    expect(hookReturnBody).toContain('hasNextPage')
    expect(hookReturnBody).toContain('hasPreviousPage')
    expect(consumeQuery).not.toContain(forbiddenSetStateName)
    expect(consumeQuery).not.toContain(forbiddenFactoryName)
    expect(consumeQuery).not.toContain(forbiddenDtoName)
  })

  it('uses shared default pagination constants without fixed dashboard pagination', () => {
    const config = read('src/app/config.ts')
    const chainGraph = read('src/lib/chainGraph.ts')
    const consumeQuery = read('src/hooks/useConsumeChainQuery.ts')

    expect(config).toContain('defaultConsumeChainPage')
    expect(config).toContain('defaultConsumeChainPageSize')
    expect(config).not.toContain('dashboardQueryPage')
    expect(config).not.toContain('dashboardQuerySize')
    expect(chainGraph).not.toContain('dashboardQueryPage')
    expect(chainGraph).not.toContain('dashboardQuerySize')
    expect(consumeQuery).toContain('defaultConsumeChainPage')
    expect(consumeQuery).toContain('defaultConsumeChainPageSize')
    expect(chainGraph).not.toContain('const consumeChainUrlPage')
    expect(chainGraph).not.toContain('const consumeChainUrlSize')
  })

  it('keeps loaded-result filter wording free of page labels', () => {
    const forbiddenCurrentPageLabel = '当前' + '页'
    const forbiddenCnPageControlsLabel = '分' + '页'

    for (const file of [
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
      'src/features/network-explorer/components/browse-panel/FlowNodeBrowser.tsx',
      'src/components/VaultGate.tsx',
    ]) {
      const text = read(file)
      expect(text).toMatch(/aria-live="polite"|role="status"|role="alert"/)
    }
  })
})
