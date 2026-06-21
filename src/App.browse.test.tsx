import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  installAppTestLifecycle,
  jsonResponse,
  requestInputUrl,
  stubFetchByUrl,
} from './test/appTestHarness'
import App from './App'

describe('App browse panel', () => {
  installAppTestLifecycle()

  it('renames the former query panel and exposes only paged browser tabs', () => {
    render(<App />)

    expect(screen.getByRole('dialog', { name: '浏览' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '区块' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '流转节点' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: '消费链' })).toBeNull()
    expect(screen.queryByRole('tab', { name: '查询' })).toBeNull()
    expect(screen.queryByRole('group', { name: '数据源' })).toBeNull()
    expect(screen.queryByLabelText('API 基址')).toBeNull()
    expect(screen.queryByRole('heading', { name: '消费链' })).toBeNull()
    expect(screen.queryByLabelText('流转节点 ID / 公钥')).toBeNull()
    expect(screen.queryByRole('button', { name: /^加载消费链$/ })).toBeNull()
    expect(screen.queryByLabelText('消费链页码')).toBeNull()
    expect(screen.queryByLabelText('消费链每页数量')).toBeNull()
  })

  it('shows local node actions in a separate dashboard panel', () => {
    render(<App />)

    const localPanel = screen.getByRole('dialog', { name: '本地节点' })

    expect(within(localPanel).getByRole('button', { name: '新建流转节点' })).toBeTruthy()
    expect(within(localPanel).getByRole('button', { name: '新建消费节点' })).toBeTruthy()
  })

  it('loads block pages by latest height and descending block height', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/blocks/latest') {
        return jsonResponse({ code: 200, message: 'ok', data: blockInfo(5) })
      }
      if (url.pathname === '/blocks/5') {
        return jsonResponse({ code: 200, message: 'ok', data: blockInfo(5) })
      }
      if (url.pathname === '/blocks/4') {
        return jsonResponse({ code: 200, message: 'ok', data: blockInfo(4) })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('区块每页数量'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /^加载区块$/ }))

    await screen.findByText('高度 5')
    expect(screen.getByRole('table', { name: '区块列表' })).toBeTruthy()
    expect(screen.getByRole('table', { name: '区块列表' }).closest('.browse-results-table')).toBe(
      screen.getByTestId('block-results-table'),
    )
    const paths = fetchMock.mock.calls.map((call) => {
      const url = new URL(requestInputUrl(call[0]), 'http://localhost')
      return url.pathname.startsWith('/api') ? url.pathname.slice('/api'.length) : url.pathname
    })
    expect(paths).toEqual(expect.arrayContaining(['/blocks/latest', '/blocks/5', '/blocks/4']))
  })

  it('renders flow node results in a bounded table', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/flow-nodes') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            content: [
              {
                id: 'flow-node-1',
                flowNodePubkey: `02${'d'.repeat(64)}`,
                registered: true,
                authorized: false,
                locked: false,
                currentCentralPubkeyAuthorized: false,
              },
            ],
            page: 0,
            size: 10,
            numberOfElements: 1,
            hasNext: false,
            hasPrevious: false,
          },
        })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    const flowNodesTab = screen.getByRole('tab', { name: '流转节点' })
    fireEvent.mouseDown(flowNodesTab, { button: 0, ctrlKey: false })
    fireEvent.click(flowNodesTab)
    fireEvent.click(screen.getByRole('button', { name: /^加载流转节点$/ }))

    expect(await screen.findByRole('table', { name: '流转节点列表' })).toBeTruthy()
    expect(screen.getByRole('table', { name: '流转节点列表' }).closest('.browse-results-table')).toBe(
      screen.getByTestId('flow-node-results-table'),
    )
    expect(screen.queryByRole('button', { name: /选择流转节点 FLOW-N/ })).toBeNull()
    expect(screen.getByText('FLOW-N')).toBeTruthy()
  })
})

function blockInfo(height: number) {
  return {
    id: `block-${height}`,
    version: 1,
    height,
    sourceCodeZipHash: '00',
    previousBlockHash: '11',
    merkleRoot: `merkle-${height}`,
    maxMsgTimestamp: 1,
    registerDifficultyTarget: '20ffffff',
    transactionDifficultyTarget: '20ffffff',
    centralPubkey: '02'.padEnd(66, 'a'),
    timestamp: height,
    centralSignature: 'aa',
    datFilepath: `/tmp/${height}.dat`,
    sourceCodeZipFilepath: `/tmp/${height}.zip`,
  }
}
