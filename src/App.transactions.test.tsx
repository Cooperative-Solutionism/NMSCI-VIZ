import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  chainRow,
  graphNodeAId,
  graphNodeCId,
  installAppTestLifecycle,
  jsonResponse,
  requestInputUrl,
  sliceResponse,
  stubFetchByUrl,
} from './test/appTestHarness'
import App from './App'

const centralPubkey = '02'.padEnd(66, '2')
const generatedConsumePubkey = '02'.padEnd(66, '1')
const generatedFlowPubkey = '02'.padEnd(66, '2')

// 记录创建/挂载所需的难度目标与中心公钥统一来自最新区块。
function latestBlock() {
  return {
    code: 200,
    message: 'ok',
    data: {
      height: 100,
      registerDifficultyTarget: '1d00ffff',
      transactionDifficultyTarget: '1d00ffff',
      centralPubkey,
    },
  }
}

describe('App initial state', () => {
  installAppTestLifecycle()

  it('creates a transaction record from the context menu with consume + flow double-signing', async () => {
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/blocks/latest') {
        return jsonResponse(latestBlock())
      }
      if (url.pathname === '/transaction-records' && init?.method === 'POST') {
        return jsonResponse({
          code: 200,
          message: 'ok',
          data: { id: 'tx-rec-1', txid: 'txid-rec' },
        })
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    // a consume node (payer) and a flow node (payee), both in the keyring
    fireEvent.click(await screen.findByRole('button', { name: /canvas add consume node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    fireEvent.click(
      await screen.findByRole('button', {
        name: `context generate record ${generatedConsumePubkey}`,
      }),
    )
    fireEvent.change(await screen.findByLabelText('金额'), { target: { value: '5000' } })
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
    const fetchMock = stubFetchByUrl((url, init) => {
      if (url.pathname === '/blocks/latest') {
        return jsonResponse(latestBlock())
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
      if (url.pathname === '/consume-chains') {
        if (url.searchParams.get('startPubkey') === generatedConsumePubkey) {
          return jsonResponse(
            sliceResponse([chainRow('chain-existing', 1, generatedConsumePubkey, graphNodeAId)]),
          )
        }
        if (url.searchParams.get('nodePubkey') === generatedFlowPubkey) {
          return jsonResponse(
            sliceResponse([chainRow('chain-mounted', 1, generatedFlowPubkey, graphNodeCId)]),
          )
        }
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /canvas add consume node/i }))
    fireEvent.click(await screen.findByRole('button', { name: /canvas add flow node/i }))

    fireEvent.click(
      await screen.findByRole('button', {
        name: `context load following ${generatedConsumePubkey}`,
      }),
    )
    await screen.findByRole('button', { name: `Select node ${graphNodeAId}` })

    // create a record first
    fireEvent.click(
      await screen.findByRole('button', {
        name: `context generate record ${generatedConsumePubkey}`,
      }),
    )
    fireEvent.change(await screen.findByLabelText('金额'), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: /^创建记录$/ }))
    await waitFor(() => {
      expect(localStorage.getItem('nmsci.txRecords.v1')).toContain(
        '11111111-1111-4111-8111-1111111111aa',
      )
    })
    // close the record dialog
    fireEvent.keyDown(screen.getByRole('dialog', { name: '生成消费记录' }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '生成消费记录' })).toBeNull())

    // mount it
    fireEvent.click(
      await screen.findByRole('button', { name: `context mount record ${generatedFlowPubkey}` }),
    )
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
    expect(
      fetchMock.mock.calls.some(([input]) => {
        const url = new URL(requestInputUrl(input), 'http://localhost')
        return (
          url.pathname.includes('/consume-chains') &&
          url.searchParams.get('nodePubkey') === generatedFlowPubkey
        )
      }),
    ).toBe(false)
    await waitFor(() => {
      const chainCall = fetchMock.mock.calls.find(([input]) => {
        const url = new URL(requestInputUrl(input), 'http://localhost')
        return (
          url.pathname.includes('/consume-chains') &&
          url.searchParams.get('nodePubkey') === generatedFlowPubkey
        )
      })
      expect(chainCall).toBeTruthy()
      expect(screen.getByRole('button', { name: `Select node ${graphNodeAId}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Select node ${graphNodeCId}` })).toBeTruthy()
      expect(
        new URL(requestInputUrl(chainCall![0]), 'http://localhost').searchParams.get('nodePubkey'),
      ).toBe(generatedFlowPubkey)
    })
  })
})
