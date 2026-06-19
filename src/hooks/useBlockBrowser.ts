import { ApiClient, getBlockByHeight, getLastBlock, type BlockInfoRaw } from '@nmsci/sdk'
import { useCallback, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

interface BlockBrowserState {
  items: BlockInfoRaw[]
  latestHeight: number | null
  loading: boolean
  error: string | null
  page: number
  hasNext: boolean
  hasPrevious: boolean
}

const EMPTY: BlockBrowserState = {
  items: [],
  latestHeight: null,
  loading: false,
  error: null,
  page: 0,
  hasNext: false,
  hasPrevious: false,
}

function normalizePage(value: number): number {
  return Math.max(0, Math.trunc(value))
}

function normalizePageSize(value: number): number {
  return Math.max(1, Math.trunc(value))
}

export function useBlockBrowser(apiBase: string) {
  const [state, setState] = useState<BlockBrowserState>(EMPTY)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const generationRef = useRef(0)

  const load = useCallback(
    async ({ page, size }: { page: number; size: number }) => {
      const requestedPage = normalizePage(page)
      const requestedSize = normalizePageSize(size)
      const generation = generationRef.current + 1
      generationRef.current = generation
      setState((current) => ({ ...current, loading: true, error: null }))

      try {
        const latest = await getLastBlock(client)
        const latestHeight = latest.data.height
        const startHeight = latestHeight - requestedPage * requestedSize
        const visibleCount = startHeight >= 0 ? Math.min(requestedSize, startHeight + 1) : 0
        const heights = Array.from({ length: visibleCount }, (_, index) => startHeight - index)
        const blocks = await Promise.all(
          heights.map(async (height) => {
            const block = await getBlockByHeight(client, height)
            return block.data
          }),
        )
        if (generation !== generationRef.current) return
        setState({
          items: blocks,
          latestHeight,
          loading: false,
          error: null,
          page: requestedPage,
          hasNext: startHeight - requestedSize >= 0,
          hasPrevious: requestedPage > 0,
        })
      } catch (blockError) {
        if (generation !== generationRef.current) return
        setState((current) => ({
          ...current,
          loading: false,
          error: errorMessage(blockError, '加载区块失败'),
        }))
      }
    },
    [client],
  )

  return { ...state, load }
}
