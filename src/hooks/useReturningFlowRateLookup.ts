import {
  ApiClient,
  getReturningFlowRateByPubkey,
  type ReturningFlowRateResponseDTO,
} from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

export type FlowRateLookupStatus = 'idle' | 'loading' | 'loaded' | 'error'

// 指数查询：按两个流转节点公钥计算 source→target 的回流率/成环/未成环金额。
// 命令式（由“计算”按钮触发），与 effect 驱动、按 UUID 的 useReturningFlowRate 互补。
export function useReturningFlowRateLookup(apiBase: string) {
  const [data, setData] = useState<ReturningFlowRateResponseDTO | null>(null)
  const [status, setStatus] = useState<FlowRateLookupStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const generationRef = useRef(0)

  const lookup = useCallback(
    async (sourcePubkey: string, targetPubkey: string) => {
      const generation = generationRef.current + 1
      generationRef.current = generation
      setStatus('loading')
      setError(null)
      try {
        const res = await getReturningFlowRateByPubkey(client, {
          sourcePubkey: sourcePubkey.trim(),
          targetPubkey: targetPubkey.trim(),
        })
        if (generation !== generationRef.current) return
        setData(res.data)
        setStatus('loaded')
      } catch (lookupError) {
        if (generation !== generationRef.current) return
        setData(null)
        setStatus('error')
        setError(errorMessage(lookupError, '加载回流率失败'))
      }
    },
    [client],
  )

  return { data, error, status, lookup }
}
