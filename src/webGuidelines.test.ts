import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
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

    for (const name of ['apiBase', 'nodeId', 'currencyFilter', 'page', 'size']) {
      expect(queryPanel).toContain(`name="${name}"`)
    }
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
    expect(queryPanel).toContain("useUrlBooleanParam('panelCollapsed'")
    expect(queryPanel).toContain('onKeyDown={handlePanelKeyDown}')
    expect(nodeBrowser).toContain("useUrlBooleanParam('nodeBrowserOpen'")
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
