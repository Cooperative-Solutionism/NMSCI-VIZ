import { ApiClient, getFlowNodeState, type FlowNodeStateResponseDTO } from '@nmsci/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

export type NodeDetailStatus = 'idle' | 'loading' | 'loaded' | 'error'

// 流转节点状态只能按公钥查询（后端无「按 UUID 查节点」端点，API.md §5）。
// 图节点 id 是 UUID，因此仅当上游能提供公钥时才发起查询，否则保持 idle，不再误打注册消息端点。
export function useNodeDetail(apiBase: string, selectedPubkey: string | null) {
  const [stateByPubkey, setStateByPubkey] = useState<Record<string, FlowNodeStateResponseDTO>>({})
  const [nodeDetailStatus, setNodeDetailStatus] = useState<NodeDetailStatus>('idle')
  const [nodeDetailError, setNodeDetailError] = useState<string | null>(null)
  const client = useMemo(() => new ApiClient({ baseUrl: apiBase }), [apiBase])
  const generationRef = useRef<Record<string, number>>({})

  const loadNodeState = useCallback(async (pubkey: string) => {
    const generation = (generationRef.current[pubkey] ?? 0) + 1
    generationRef.current[pubkey] = generation
    setNodeDetailStatus('loading')
    setNodeDetailError(null)

    try {
      const detail = await getFlowNodeState(client, pubkey)
      if (generation !== generationRef.current[pubkey]) return
      setStateByPubkey((current) => ({ ...current, [pubkey]: detail.data }))
      setNodeDetailStatus('loaded')
    } catch (detailError) {
      if (generation !== generationRef.current[pubkey]) return
      setNodeDetailStatus('error')
      setNodeDetailError(errorMessage(detailError, 'Unknown node state error'))
    }
  }, [client])

  useEffect(() => {
    if (!selectedPubkey || stateByPubkey[selectedPubkey]) return
    void Promise.resolve().then(() => loadNodeState(selectedPubkey))
  }, [loadNodeState, selectedPubkey, stateByPubkey])

  return {
    loadNodeState,
    nodeDetailError,
    nodeDetailStatus,
    nodeState: selectedPubkey ? stateByPubkey[selectedPubkey] : undefined,
  }
}
