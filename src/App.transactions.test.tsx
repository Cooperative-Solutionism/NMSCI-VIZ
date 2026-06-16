import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  chainRow,
  installAppTestLifecycle,
  jsonResponse,
  requestInputUrl,
  sliceResponse,
  stubFetchByUrl,
} from './test/appTestHarness'
import App from './App'

describe('App initial state', () => {
  installAppTestLifecycle()

  it('creates a transaction record with consume + flow double-signing', async () => {
    const pubkey = '02'.padEnd(66, '1')
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/metadata/difficulty') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            register: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
            transaction: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
          },
        })
      }
      if (url.pathname === '/transaction-records' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: 'tx-rec-1', txid: 'txid-rec' },
        })
      }
      if (url.pathname === `/flow-nodes/${pubkey}`) {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            registered: true,
            authorized: true,
            locked: false,
            currentCentralPubkeyAuthorized: true,
          },
        })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    // a consume node (record source) then a flow node (operator) — flow node ends up selected
    fireEvent.click(await screen.findByRole('button', { name: /canvas add consume node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /创建交易记录/ }))

    fireEvent.change(await screen.findByLabelText('金额'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('记录中心公钥'), {
      target: { value: '02'.padEnd(66, '2') },
    })
    await waitFor(() => {
      expect((screen.getByLabelText('交易难度') as HTMLInputElement).value).toBe('1d00ffff')
    })
    fireEvent.click(screen.getByRole('button', { name: /^创建记录$/ }))

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('nmsci.txRecords.v1') ?? '{"records":[]}') as {
        records: Array<{ id: string; amount: string }>
      }
      expect(saved.records[0]?.id).toBe('tx-rec-1')
      expect(saved.records[0]?.amount).toBe('5000')
    })
    const recordPost = fetchMock.mock.calls.find(
      ([input, init]) =>
        requestInputUrl(input).includes('/transaction-records') &&
        (init as RequestInit | undefined)?.method === 'POST',
    )
    expect(recordPost).toBeTruthy()
  })

  it('mounts a created record and views the resulting consume chain by pubkey', async () => {
    const pubkey = '02'.padEnd(66, '1')
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/metadata/difficulty') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            register: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
            transaction: { nbitsInt: 0, nbitsHex: '1d00ffff', targetDecimal: '0', targetHex: '0' },
          },
        })
      }
      if (url.pathname === '/transaction-records' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: '11111111-1111-4111-8111-1111111111aa', txid: 'r' },
        })
      }
      if (url.pathname === '/transaction-mounts' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: '22222222-2222-4222-8222-2222222222bb', txid: 'm' },
        })
      }
      if (url.pathname === `/flow-nodes/${pubkey}`) {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: {
            registered: true,
            authorized: true,
            locked: false,
            currentCentralPubkeyAuthorized: true,
          },
        })
      }
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-x', 1)]))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add consume node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    // create a record first
    fireEvent.click(await screen.findByRole('button', { name: /创建交易记录/ }))
    fireEvent.change(await screen.findByLabelText('金额'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('记录中心公钥'), {
      target: { value: '02'.padEnd(66, '2') },
    })
    await waitFor(() => {
      expect((screen.getByLabelText('交易难度') as HTMLInputElement).value).toBe('1d00ffff')
    })
    fireEvent.click(screen.getByRole('button', { name: /^创建记录$/ }))
    await waitFor(() => {
      expect(localStorage.getItem('nmsci.txRecords.v1')).toContain(
        '11111111-1111-4111-8111-1111111111aa',
      )
    })

    // mount it
    fireEvent.click(screen.getByRole('button', { name: /挂载已有记录/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^提交挂载$/ }))
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, requestInit]) =>
            requestInputUrl(input).includes('/transaction-mounts') &&
            (requestInit as RequestInit | undefined)?.method === 'POST',
        ),
      ).toBe(true)
    })

    // view the resulting consume chain — queries by pubkey
    fireEvent.click(await screen.findByRole('button', { name: /查看消费链/ }))
    await waitFor(() => {
      const chainCall = fetchMock.mock.calls.find(([input]) =>
        requestInputUrl(input).includes('/consume-chains'),
      )
      expect(chainCall).toBeTruthy()
      expect(
        new URL(requestInputUrl(chainCall![0]), 'http://localhost').searchParams.get('nodePubkey'),
      ).toBe(pubkey)
    })
  })
})
