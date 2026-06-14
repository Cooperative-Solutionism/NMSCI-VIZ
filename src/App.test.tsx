import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { ChainGraph, ChainGraphEdge, ChainGraphNode, ConsumeChainResponseDTORaw } from './lib/types'

vi.mock('./components/NetworkGraph', () => ({
  NetworkGraph: ({
    graph,
    onSelectEdge,
    onSelectNode,
  }: {
    graph: ChainGraph
    selectedId: string | null
    onSelectEdge: (edge: ChainGraphEdge) => void
    onSelectNode: (node: ChainGraphNode) => void
  }) => (
    <div data-testid="network-graph">
      {graph.nodes.map((node) => (
        <button key={node.id} type="button" onClick={() => onSelectNode(node)}>
          Select node {node.id}
        </button>
      ))}
      {graph.edges.map((edge) => (
        <button key={edge.id} type="button" onClick={() => onSelectEdge(edge)}>
          Select edge {edge.id}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('@nmsci/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nmsci/sdk')>()
  return {
    ...actual,
    generateKeyPair: () => ({
      privateKey: '0'.repeat(63) + '1',
      publicKey: '02'.padEnd(66, '1'),
    }),
  }
})

describe('App initial state', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    localStorage.clear()
  })

  it('starts without demo data or a demo reset action', () => {
    render(<App />)

    expect(screen.queryByRole('button', { name: /demo/i })).toBeNull()
    expect((screen.getByLabelText('Flow node UUID') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText('No chain data in the current filter.')).toBeTruthy()
    expect(screen.getByLabelText('Data status').textContent).toContain('No data')
  })

  it('generates a local flow node and persists it to localStorage', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /generate flow node/i }))

    await waitFor(() => {
      expect((screen.getByLabelText('Local flow node') as HTMLSelectElement).value)
        .toBe('02'.padEnd(66, '1'))
    })
    const raw = localStorage.getItem('nmsci.flowNodes.v1')
    expect(raw).not.toBeNull()
    const saved = JSON.parse(raw ?? '{"nodes":[]}') as {
      nodes: Array<{ privateKeyHex: string; publicKeyHex: string }>
    }
    expect(saved.nodes).toEqual([expect.objectContaining({
      privateKeyHex: '0'.repeat(63) + '1',
      publicKeyHex: '02'.padEnd(66, '1'),
    })])
  })

  it('can copy the selected generated flow node id into the query UUID field', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /generate flow node/i }))

    let generatedId = ''
    await waitFor(() => {
      const raw = localStorage.getItem('nmsci.flowNodes.v1')
      const saved = JSON.parse(raw ?? '{"nodes":[]}') as { nodes: Array<{ id: string }> }
      generatedId = saved.nodes[0]?.id ?? ''
      expect(generatedId).not.toBe('')
    })

    fireEvent.click(screen.getByRole('button', { name: /fill node uuid/i }))

    expect((screen.getByLabelText('Flow node UUID') as HTMLTextAreaElement).value).toBe(generatedId)
  })

  it('loads a hex register difficulty target returned by the backend', async () => {
    const centralPubkey = '03dfb2c7716697bba0a12c21c431f86d4bfe3b536b2ec0b7f32e7f97bbcfb20cbe'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      code: 200,
      message: 'ok',
      data: { height: 2518, registerDifficultyTarget: '20ffffff', centralPubkey },
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })))
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /use latest/i }))

    await waitFor(() => {
      expect((screen.getByLabelText('Register difficulty target') as HTMLInputElement).value)
        .toBe('20ffffff')
    })
    expect((screen.getByLabelText('Central pubkey') as HTMLTextAreaElement).value).toBe(centralPubkey)
    expect(screen.queryByText(/Latest block did not include registerDifficultyTarget/i)).toBeNull()
  })

  it('loads changed filters from the first page even when the page input is stale', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([chainRow('chain-cny', 1)], {
          page: Number(url.searchParams.get('page')),
          hasNext: false,
        }))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Flow node UUID'), { target: { value: 'node-1' } })
    fireEvent.change(screen.getByLabelText('Page'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    const request = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost')
    expect(request.searchParams.get('page')).toBe('0')
  })

  it('labels currency as a current-page filter and reports visible row counts', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([
          chainRow('chain-cny', 1),
          chainRow('chain-au', 0),
        ], { page: 0, hasNext: true }))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Flow node UUID'), { target: { value: 'node-1' } })
    fireEvent.change(screen.getByLabelText(/Currency/), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))

    await screen.findByText(/Current page view filter/i)
    expect(screen.getByText(/1 visible row \/ 2 backend rows/i)).toBeTruthy()
  })

  it('does not allow pagination after an extended graph merge', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains' && url.searchParams.get('nodeId') === 'node-1') {
        return jsonResponse(sliceResponse([chainRow('chain-cny', 1)], { page: 0, hasNext: true }))
      }
      if (url.pathname === '/consume-chains' && url.searchParams.get('startId') === 'node-a') {
        return jsonResponse(sliceResponse([chainRow('chain-extra', 1, 'node-a', 'node-c')], {
          page: 0,
          hasNext: true,
        }))
      }
      if (url.pathname.startsWith('/flow-node-registrations/')) {
        return jsonResponse(flowNodeDetail(url.pathname.split('/').pop() ?? 'node-a'))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Flow node UUID'), { target: { value: 'node-1' } })
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))
    fireEvent.click(await screen.findByRole('button', { name: /select node node-a/i }))
    fireEvent.click(await screen.findByRole('button', { name: /extend start/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled()
    })
    expect(screen.getByText(/Extended graph view/i)).toBeTruthy()
  })

  it('loads backend detail for the automatically selected fallback node', async () => {
    const fetchMock = stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        return jsonResponse(sliceResponse([{
          consumeChain: {
            id: 'chain-node-only',
            start: 'node-a',
            end: 'node-b',
            amount: 1200,
            currencyType: 1,
            isLoop: false,
            tailMountTimestamp: 1_700_000_000_000_000,
          },
          consumeChainEdges: [],
        }], { page: 0 }))
      }
      if (url.pathname === '/flow-node-registrations/node-a') {
        return jsonResponse(flowNodeDetail('node-a'))
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Flow node UUID'), { target: { value: 'node-1' } })
    fireEvent.click(screen.getByRole('button', { name: /^load$/i }))

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/flow-node-registrations/node-a')))
        .toBe(true)
    })
    expect(await screen.findByText('20ffffff')).toBeTruthy()
  })
})

function stubFetchByUrl(handler: (url: URL, init?: RequestInit) => Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.slice('/api'.length)
    }
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

function sliceResponse(
  content: ConsumeChainResponseDTORaw[],
  overrides: Partial<{
    page: number
    size: number
    numberOfElements: number
    hasNext: boolean
    hasPrevious: boolean
  }> = {},
) {
  return {
    code: 200,
    message: 'ok',
    data: {
      content,
      page: overrides.page ?? 0,
      size: overrides.size ?? 50,
      numberOfElements: overrides.numberOfElements ?? content.length,
      hasNext: overrides.hasNext ?? false,
      hasPrevious: overrides.hasPrevious ?? false,
    },
  }
}

function chainRow(
  id: string,
  currencyType: number,
  start = 'node-a',
  end = 'node-b',
): ConsumeChainResponseDTORaw {
  return {
    consumeChain: {
      id,
      start,
      end,
      amount: 1200,
      currencyType,
      isLoop: false,
      tailMountTimestamp: 1_700_000_000_000_000,
    },
    consumeChainEdges: [
      {
        id: `${id}-edge`,
        source: start,
        target: end,
        amount: 1200,
        currencyType,
        chain: id,
        relatedTransactionRecord: `${id}-record`,
        relatedTransactionMount: `${id}-mount`,
        relatedTransactionMountTimestamp: 1_700_000_000_000_000,
        isLoop: false,
      },
    ],
  }
}

function flowNodeDetail(id: string) {
  return {
    code: 200,
    message: 'ok',
    data: {
      id,
      msgType: 1,
      registerDifficultyTarget: '20ffffff',
      nonce: 7,
      flowNodePubkey: '02'.padEnd(66, '1'),
      flowNodeSignature: '1'.repeat(128),
      rawBytes: '00',
      txid: 'ab',
    },
  }
}
