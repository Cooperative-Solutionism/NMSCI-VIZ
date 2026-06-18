import { ApiClient, getSystemStatus, type SystemStatusDTORaw } from '@nmsci/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

// 系统运行状态（GET /system/status，API.md §3）：最新高度、未入块消息数、中心公钥是否冻结。
// 用于顶栏健康指示与注册/授权前的预检（中心公钥冻结时这两个操作必然失败）。
export function useSystemStatus(apiBase: string) {
  const [data, setData] = useState<SystemStatusDTORaw | null>(null)
  const [error, setError] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const generationRef = useRef(0)

  const refresh = useCallback(async () => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    try {
      const res = await getSystemStatus(client)
      if (generation !== generationRef.current) return
      setData(res.data)
      setError(null)
    } catch (statusError) {
      if (generation !== generationRef.current) return
      setError(errorMessage(statusError, '加载系统状态失败'))
    }
  }, [client])

  useEffect(() => {
    void Promise.resolve().then(() => refresh())
  }, [refresh])

  return { data, error, refresh }
}
