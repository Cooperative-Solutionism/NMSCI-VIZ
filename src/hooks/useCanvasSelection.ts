import { useCallback, useMemo, useState } from 'react'
import type { ChainGraphEdge, ChainGraphNode } from '../lib/types'

export function useCanvasSelection({
  selectNode,
  selectEdge,
}: {
  selectNode: (node: ChainGraphNode) => void
  selectEdge: (edge: ChainGraphEdge) => void
}) {
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null)

  const selectLocalNode = useCallback((id: string) => {
    setSelectedLocalId(id)
  }, [])

  const clearSelectedLocalNode = useCallback(() => {
    setSelectedLocalId(null)
  }, [])

  // 画布选择：点本地节点 → 进入对应操作面板；点链节点/边 → 清掉本地选择，走链检查器。
  const onCanvasSelectNode = useCallback((node: ChainGraphNode) => {
    if (node.kind === 'local-flow' || node.kind === 'local-consume') {
      setSelectedLocalId(node.id)
      return
    }
    setSelectedLocalId(null)
    selectNode(node)
  }, [selectNode])

  const onCanvasSelectEdge = useCallback((edge: ChainGraphEdge) => {
    setSelectedLocalId(null)
    selectEdge(edge)
  }, [selectEdge])

  return useMemo(() => ({
    selectedLocalId,
    selectLocalNode,
    clearSelectedLocalNode,
    onCanvasSelectNode,
    onCanvasSelectEdge,
  }), [
    clearSelectedLocalNode,
    onCanvasSelectEdge,
    onCanvasSelectNode,
    selectLocalNode,
    selectedLocalId,
  ])
}
