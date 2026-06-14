import { ApiClient, getFlowNodeRegisterMsgById } from '@nmsci/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'
import type { FlowNodeRegisterMsgRaw } from '../lib/types'

export type NodeDetailStatus = 'idle' | 'loading' | 'loaded' | 'error'

export function useNodeDetail(apiBase: string, selectedNodeId: string | null) {
  const [nodeDetailsById, setNodeDetailsById] = useState<Record<string, FlowNodeRegisterMsgRaw>>({})
  const [nodeDetailStatus, setNodeDetailStatus] = useState<NodeDetailStatus>('idle')
  const [nodeDetailError, setNodeDetailError] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const nodeDetailGenerationRef = useRef<Record<string, number>>({})

  const loadNodeDetail = useCallback(async (targetNodeId: string) => {
    const generation = (nodeDetailGenerationRef.current[targetNodeId] ?? 0) + 1
    nodeDetailGenerationRef.current[targetNodeId] = generation
    setNodeDetailStatus('loading')
    setNodeDetailError(null)

    try {
      const detail = await getFlowNodeRegisterMsgById(client, targetNodeId)
      if (generation !== nodeDetailGenerationRef.current[targetNodeId]) return
      setNodeDetailsById((currentDetails) => ({
        ...currentDetails,
        [targetNodeId]: detail.data,
      }))
      setNodeDetailStatus('loaded')
    } catch (detailError) {
      if (generation !== nodeDetailGenerationRef.current[targetNodeId]) return
      setNodeDetailStatus('error')
      setNodeDetailError(errorMessage(detailError, 'Unknown node detail error'))
    }
  }, [client])

  useEffect(() => {
    if (!selectedNodeId || nodeDetailsById[selectedNodeId]) return
    void Promise.resolve().then(() => loadNodeDetail(selectedNodeId))
  }, [loadNodeDetail, nodeDetailsById, selectedNodeId])

  return {
    loadNodeDetail,
    nodeDetailError,
    nodeDetailStatus,
    nodeDetailsById,
  }
}
