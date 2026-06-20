import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  chainRow,
  graphNodeAId,
  graphNodeBId,
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

function refreshedExistingChainRow() {
  const row = chainRow('chain-existing', 1, generatedConsumePubkey, graphNodeBId)
  row.consumeChain.amount = 2400
  row.consumeChain.tailMountTimestamp = 1_700_000_000_000_100
  row.consumeChainEdges = row.consumeChainEdges.map((edge) => ({
    ...edge,
    id: 'chain-existing-refreshed-edge',
    amount: 2400,
    target: graphNodeBId,
    relatedTransactionMountTimestamp: 1_700_000_000_000_101,
  }))
  return row
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

  it('mounts a created record and refreshes every visible consume chain by node identifier', async () => {
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
        if (url.searchParams.get('nodePubkey') === generatedConsumePubkey) {
          return jsonResponse(sliceResponse([refreshedExistingChainRow()]))
        }
        if (url.searchParams.get('nodeId') === graphNodeAId) {
          return jsonResponse(sliceResponse([refreshedExistingChainRow()]))
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
    await screen.findByRole('button', { name: 'Select edge chain-existing-edge' })

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

    const callsBeforeView = fetchMock.mock.calls.length

    // view the resulting consume chain: refresh every visible node, not only the mounted node
    fireEvent.click(await screen.findByRole('button', { name: /查看消费链/ }))
    await waitFor(() => {
      const postViewNodePubkeys = fetchMock.mock.calls
        .slice(callsBeforeView)
        .map(([input]) => new URL(requestInputUrl(input), 'http://localhost'))
        .filter((url) => url.pathname.includes('/consume-chains'))
        .map((url) => url.searchParams.get('nodePubkey') ?? url.searchParams.get('nodeId'))
      expect(postViewNodePubkeys).toContain(generatedConsumePubkey)
      expect(postViewNodePubkeys).toContain(graphNodeAId)
      expect(postViewNodePubkeys).toContain(generatedFlowPubkey)
      expect(screen.getByRole('button', { name: `Select node ${graphNodeBId}` })).toBeTruthy()
      expect(screen.getByRole('button', { name: `Select node ${graphNodeCId}` })).toBeTruthy()
      expect(
        screen.getByRole('button', { name: 'Select edge chain-existing-refreshed-edge' }),
      ).toBeTruthy()
    })
    expect(screen.queryByRole('button', { name: 'Select edge chain-existing-edge' })).toBeNull()
  })
})
