import { ApiClient, getReturningFlowRateById, type ReturningFlowRateResponseDTO } from '@nmsci/sdk'
import { useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

export type FlowRateStatus = 'idle' | 'loading' | 'loaded' | 'error'

// 回流率/滞留指数（API.md §7）。targetId 必填；带 sourceId 时计算 source→target 回流率，
// 仅 targetId 时返回该节点的总成环/总滞留。两者都用 UUID（图节点 id 即可），无需公钥。
export function useReturningFlowRate(
  apiBase: string,
  targetId: string | null,
  sourceId: string | null,
) {
  const [data, setData] = useState<ReturningFlowRateResponseDTO | null>(null)
  const [status, setStatus] = useState<FlowRateStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const generationRef = useRef(0)

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation

    // 把所有 setState 推迟到微任务里，避免在 effect 同步阶段触发级联渲染（react-hooks/set-state-in-effect）。
    void Promise.resolve().then(async () => {
      if (generation !== generationRef.current) return
      if (!targetId) {
        setData(null)
        setStatus('idle')
        setError(null)
        return
      }

      setStatus('loading')
      setError(null)
      try {
        const res = await getReturningFlowRateById(
          client,
          sourceId ? { targetId, sourceId } : { targetId },
        )
        if (generation !== generationRef.current) return
        setData(res.data)
        setStatus('loaded')
      } catch (flowError) {
        if (generation !== generationRef.current) return
        setStatus('error')
        setError(errorMessage(flowError, '加载回流率失败'))
      }
    })
  }, [client, targetId, sourceId])

  return { data, error, status, mode: sourceId ? ('edge' as const) : ('node' as const) }
}
