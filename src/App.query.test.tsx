import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  chainRow,
  flowNodeDetail,
  installAppTestLifecycle,
  jsonResponse,
  loopedChainRow,
  openBrowseTab,
  readSource,
  requestInputUrl,
  sliceResponse,
  stubFetchByUrl,
  transactionMount,
  transactionRecord,
} from './test/appTestHarness'
import App from './App'

describe('App initial state', () => {
  installAppTestLifecycle()

  it('loads queries with fixed first page and dashboard size', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(
          sliceResponse([chainRow('chain-cny', 1)], {
            pageIndex: Number(url.searchParams.get('page')),
            sliceSize: Number(url.searchParams.get('size')),
            hasNext: false,
          }),
        )
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const request = new URL(requestInputUrl(fetchMock.mock.calls[0]![0]), 'http://localhost')
    expect(request.searchParams.get('page')).toBe('0')
    expect(request.searchParams.get('size')).toBe('200')
  })

  it('labels currency as a loaded-result filter and reports visible row counts', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(
          sliceResponse([chainRow('chain-cny', 1), chainRow('chain-au', 0)], {
            hasNext: true,
          }),
        )
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.pointerDown(screen.getByRole('combobox', { name: /币种/ }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    })
    fireEvent.click(await screen.findByRole('option', { name: 'CNY' }))
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    await screen.findByText(/已加载结果视图过滤/)
    expect(screen.getByText(/查询完成：当前可见 1 行/)).toBeTruthy()
  })

  it('does not render page controls after an extended graph merge', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains' && url.searchParams.get('nodeId') === 'node-1') {
        return jsonResponse(sliceResponse([chainRow('chain-cny', 1)], { hasNext: true }))
      }
      if (url.pathname === '/consume-chains' && url.searchParams.get('startId') === 'node-a') {
        return jsonResponse(
          sliceResponse([chainRow('chain-extra', 1, 'node-a', 'node-c')], {
            hasNext: true,
          }),
        )
      }
      if (url.pathname.startsWith('/flow-node-registrations/')) {
        return jsonResponse(flowNodeDetail(url.pathname.split('/').pop() ?? 'node-a'))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))
    fireEvent.click(await screen.findByRole('button', { name: /select node node-a/i }))
    fireEvent.click(await screen.findByRole('button', { name: /扩展起点/ }))

    expect(await screen.findByText(/已扩展图谱视图/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /下一页/ })).toBeNull()
  })

  it('queries by public key when a 66-hex value is entered', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-cny', 1)]))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    const pubkey = `02${'a'.repeat(64)}`
    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), { target: { value: pubkey } })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const request = new URL(requestInputUrl(fetchMock.mock.calls[0]![0]), 'http://localhost')
    expect(request.searchParams.get('nodePubkey')).toBe(pubkey)
    expect(request.searchParams.get('nodeId')).toBeNull()
  })

  it('lists looped chains outside the inspector and highlights one when selected', async () => {
    const inspectorPanel = readSource('src/features/network-explorer/components/InspectorPanel.tsx')
    const app = readSource('src/app/App.tsx')
    expect(inspectorPanel).not.toContain('LoopsPanel')
    expect(inspectorPanel).toContain('inspector-panel-content')
    expect(app).toContain('LoopsPanel')

    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('open-1', 1), loopedChainRow('loop-1')]))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    expect(await screen.findByText('循环 (1)')).toBeTruthy()
    const loopRow = screen.getByRole('button', { name: /LOOP-1.*跳/ })
    expect(loopRow).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(loopRow)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /LOOP-1.*跳/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })
  })

  it('opens transaction evidence for a selected edge', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-1', 1)]))
      }
      if (url.pathname === '/transaction-records/chain-1-record') {
        return jsonResponse(transactionRecord('chain-1-record'))
      }
      if (url.pathname === '/transaction-mounts/chain-1-mount') {
        return jsonResponse(transactionMount('chain-1-mount'))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('流转节点 ID / 公钥'), {
      target: { value: 'node-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^加载$/ }))

    fireEvent.click(await screen.findByRole('button', { name: /打开交易/ }))

    expect(await screen.findByText(/记录 txid/)).toBeTruthy()
    expect(screen.getByText('recordtxid')).toBeTruthy()
  })

  it('discovers a node via the browser and fills its public key', async () => {
    const pubkey = `02${'d'.repeat(64)}`
    stubFetchByUrl((url) => {
      if (url.pathname === '/flow-nodes') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            content: [
              {
                id: 'n1',
                flowNodePubkey: pubkey,
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

    openBrowseTab()
    fireEvent.click(screen.getByRole('button', { name: /浏览节点/ }))
    fireEvent.click(screen.getByRole('button', { name: /^浏览$/ }))

    const row = await screen.findByRole('button', { name: /02DDDDDDDD/i })
    fireEvent.click(row)

    expect((screen.getByLabelText('流转节点 ID / 公钥') as HTMLTextAreaElement).value).toBe(pubkey)
  })
})
