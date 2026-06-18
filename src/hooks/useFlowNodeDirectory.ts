import {
  ApiClient,
  listFlowNodes,
  type FlowNodeListItemDTORaw,
  type FlowNodeListQuery,
} from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

interface DirectoryState {
  items: FlowNodeListItemDTORaw[]
  loading: boolean
  error: string | null
  page: number
  hasNext: boolean
  hasPrevious: boolean
}

const EMPTY: DirectoryState = {
  items: [],
  loading: false,
  error: null,
  page: 0,
  hasNext: false,
  hasPrevious: false,
}

// 流转节点目录（GET /flow-nodes，API.md §5），让分析师无需预先持有 UUID 即可发现节点。
export function useFlowNodeDirectory(apiBase: string) {
  const [state, setState] = useState<DirectoryState>(EMPTY)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const generationRef = useRef(0)

  const load = useCallback(
    async (query: FlowNodeListQuery) => {
      const generation = generationRef.current + 1
      generationRef.current = generation
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const res = await listFlowNodes(client, query)
        if (generation !== generationRef.current) return
        setState({
          items: res.data.content,
          loading: false,
          error: null,
          page: res.data.page,
          hasNext: res.data.hasNext,
          hasPrevious: res.data.hasPrevious,
        })
      } catch (listError) {
        if (generation !== generationRef.current) return
        setState((current) => ({
          ...current,
          loading: false,
          error: errorMessage(listError, '列出流转节点失败'),
        }))
      }
    },
    [client],
  )

  return { ...state, load }
}
