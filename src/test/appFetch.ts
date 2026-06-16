import type { Mock } from 'vitest'
import { vi } from 'vitest'
import type { ConsumeChainResponseDTORaw } from '../lib/types'

const firstPageIndex = 0

export function stubFetchByUrl(
  handler: (url: URL, init?: RequestInit) => Response,
): Mock<(...args: [RequestInfo | URL, RequestInit?]) => Promise<Response>> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(rawUrl, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      url.pathname = url.pathname.substring('/api'.length)
    }
    if (url.pathname === '/system/status') {
      return jsonResponse({
        code: 200,
        message: 'ok',
        data: {
          latestBlockHeight: 100,
          latestBlockHash: 'ab',
          latestBlockTimestamp: 1,
          pendingMessageCount: 0,
          oldestPendingConfirmTimestamp: null,
          blockIntervalMs: 600000,
          currentCentralPubkeyLocked: false,
        },
      })
    }
    if (url.pathname === '/returning-flow-rates') {
      return jsonResponse({
        code: 200,
        message: 'ok',
        data: {
          returningFlowRate: 0,
          loopedAmount: 0,
          unloopedAmount: 0,
          targetTotalLoopedAmount: 0,
          targetTotalUnloopedAmount: 0,
          currencyType: 1,
        },
      })
    }
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function requestInputUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

export function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

export function sliceResponse(
  content: ConsumeChainResponseDTORaw[],
  overrides: Partial<{
    pageIndex: number
    sliceSize: number
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
      page: overrides.pageIndex ?? firstPageIndex,
      size: overrides.sliceSize ?? 50,
      numberOfElements: overrides.numberOfElements ?? content.length,
      hasNext: overrides.hasNext ?? false,
      hasPrevious: overrides.hasPrevious ?? false,
    },
  }
}
