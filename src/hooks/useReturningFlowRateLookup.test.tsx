import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReturningFlowRateLookup } from './useReturningFlowRateLookup'

const pkSource = `02${'a'.repeat(64)}`
const pkTarget = `03${'b'.repeat(64)}`

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useReturningFlowRateLookup', () => {
  it('queries /returning-flow-rates by source/target pubkey and exposes the metrics', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const raw =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        const url = new URL(raw, 'http://localhost')
        calls.push(url.href)
        if (url.pathname.endsWith('/returning-flow-rates')) {
          return jsonResponse({
            code: 200,
            message: 'ok',
            data: {
              returningFlowRate: 0.4,
              loopedAmount: 4000,
              unloopedAmount: 6000,
              targetTotalLoopedAmount: 4000,
              targetTotalUnloopedAmount: 6000,
              currencyType: 1,
            },
          })
        }
        throw new Error(`Unexpected URL ${url.href}`)
      }),
    )

    const { result } = renderHook(() => useReturningFlowRateLookup('/api'))

    await act(async () => {
      await result.current.lookup(pkSource, pkTarget)
    })

    expect(result.current.status).toBe('loaded')
    expect(result.current.data).toMatchObject({
      returningFlowRate: 0.4,
      loopedAmount: 4000,
      unloopedAmount: 6000,
      currencyType: 1,
    })
    const lastUrl = calls.at(-1) ?? ''
    expect(lastUrl).toContain(pkSource)
    expect(lastUrl).toContain(pkTarget)
  })

  it('surfaces an error status and clears data when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    )

    const { result } = renderHook(() => useReturningFlowRateLookup('/api'))

    await act(async () => {
      await result.current.lookup(pkSource, pkTarget)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeTruthy()
  })
})
