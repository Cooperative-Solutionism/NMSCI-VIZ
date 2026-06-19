import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConsumeChainQuery } from './useConsumeChainQuery'
import { jsonResponse, sliceResponse, stubFetchByUrl } from '../test/appFetch'
import type { ChainGraphNode, ConsumeChainResponseDTORaw } from '../lib/types'

const pkA = `02${'a'.repeat(64)}`
const pkB = `02${'b'.repeat(64)}`

function chain(id: string, start: string, end: string): ConsumeChainResponseDTORaw {
  return {
    consumeChain: { id, start, end, amount: 1000, currencyType: 1, isLoop: false, tailMountTimestamp: 1 },
    consumeChainEdges: [
      {
        id: `${id}-edge`,
        source: start,
        target: end,
        amount: 1000,
        currencyType: 1,
        chain: id,
        relatedTransactionRecord: 'r',
        relatedTransactionMount: 'm',
        relatedTransactionMountTimestamp: 1,
        isLoop: false,
      },
    ],
  }
}

function node(id: string): ChainGraphNode {
  return { id, label: id.slice(0, 6), chainCount: 0, volumeByCurrency: new Map(), kind: 'chain' }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useConsumeChainQuery.extendFromNode', () => {
  it('merges both concurrent loads cumulatively (an in-flight load is never discarded)', async () => {
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        if (url.searchParams.get('startPubkey') === pkA) {
          return jsonResponse(sliceResponse([chain('chain-a', pkA, 'end-a')]))
        }
        if (url.searchParams.get('startPubkey') === pkB) {
          return jsonResponse(sliceResponse([chain('chain-b', pkB, 'end-b')]))
        }
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })

    const { result } = renderHook(() => useConsumeChainQuery('/api'))

    // 同时发起两次加载（不逐个 await）：旧的“最新者胜”代次守卫会丢弃先发起的一次。
    await act(async () => {
      await Promise.all([
        result.current.extendFromNode(node(pkA), 'start'),
        result.current.extendFromNode(node(pkB), 'start'),
      ])
    })

    await waitFor(() => {
      expect(result.current.rows.map((row) => row.consumeChain.id).sort()).toEqual([
        'chain-a',
        'chain-b',
      ])
    })
  })

  it('does not overwrite the browse query mode/nodeId (keeps requestUrl stable)', async () => {
    const seedNodeId = '11111111-1111-4111-8111-111111111111' // nodeId 模式需合法 UUID
    stubFetchByUrl((url) => {
      if (url.pathname === '/consume-chains') {
        if (url.searchParams.get('nodeId') === seedNodeId) {
          return jsonResponse(sliceResponse([chain('chain-seed', seedNodeId, 'end-seed')]))
        }
        if (url.searchParams.get('startPubkey') === pkA) {
          return jsonResponse(sliceResponse([chain('chain-a', pkA, 'end-a')]))
        }
      }
      throw new Error(`Unexpected URL ${url.href}`)
    })

    const { result } = renderHook(() => useConsumeChainQuery('/api'))

    await act(async () => {
      await result.current.runQuery({ mode: 'node', nodeId: seedNodeId })
    })
    await act(async () => {
      await result.current.extendFromNode(node(pkA), 'start')
    })

    // 加载消费链是加法语义：浏览查询的 mode/nodeId 不被改写，requestUrl/复制 curl 仍指向原查询。
    expect(result.current.mode).toBe('node')
    expect(result.current.nodeId).toBe(seedNodeId)
    expect(result.current.requestUrl).toContain(`nodeId=${seedNodeId}`)
    expect(result.current.requestUrl).not.toContain(pkA)
    // 但延展的链确实并入了。
    expect(result.current.rows.map((row) => row.consumeChain.id).sort()).toEqual([
      'chain-a',
      'chain-seed',
    ])
  })

  it('ignores an old extend response after a full browse query replaces the graph', async () => {
    const seedNodeId = '11111111-1111-4111-8111-111111111111'
    let resolveExtend!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const rawUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const url = new URL(rawUrl, 'http://localhost')
        if (url.pathname.startsWith('/api/')) {
          url.pathname = url.pathname.substring('/api'.length)
        }

        if (url.pathname === '/consume-chains') {
          if (url.searchParams.get('startPubkey') === pkA) {
            return new Promise<Response>((resolve) => {
              resolveExtend = resolve
            })
          }
          if (url.searchParams.get('nodeId') === seedNodeId) {
            return jsonResponse(sliceResponse([chain('chain-seed', seedNodeId, 'end-seed')]))
          }
        }
        throw new Error(`Unexpected URL ${url.href}`)
      }),
    )

    const { result } = renderHook(() => useConsumeChainQuery('/api'))
    let extendPromise!: Promise<void>

    act(() => {
      extendPromise = result.current.extendFromNode(node(pkA), 'start')
    })
    await waitFor(() => {
      expect(resolveExtend).toBeTypeOf('function')
    })

    await act(async () => {
      await result.current.runQuery({ mode: 'node', nodeId: seedNodeId })
    })

    await act(async () => {
      resolveExtend(jsonResponse(sliceResponse([chain('chain-a', pkA, 'end-a')])))
      await extendPromise
    })

    expect(result.current.rows.map((row) => row.consumeChain.id)).toEqual(['chain-seed'])
    expect(result.current.extendLoading).toBeNull()
  })
})
