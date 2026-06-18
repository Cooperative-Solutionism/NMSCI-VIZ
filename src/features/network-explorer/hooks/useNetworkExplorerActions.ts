import { useCallback } from 'react'
import { downloadText } from '../../../shared/utils/downloadText'
import { edgesToCsv, rowsToJson, toCurl } from '../../../lib/exporters'
import { errorMessage } from '../../../lib/errors'
import type { ChainGraphEdge, ConsumeChainResponseDTO, QueryMode } from '../../../lib/types'

export function useNetworkExplorerActions({
  filteredRows,
  graphEdges,
  notifyError,
  notifyStatus,
  requestUrl,
  setMode,
  setNodeId,
}: {
  filteredRows: ConsumeChainResponseDTO[]
  graphEdges: ChainGraphEdge[]
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  requestUrl: string
  setMode: (mode: QueryMode) => void
  setNodeId: (nodeId: string) => void
}) {
  const handleExportCsv = useCallback(() => {
    downloadText('consume-chain-edges.csv', 'text/csv;charset=utf-8', edgesToCsv(graphEdges))
  }, [graphEdges])

  const handleExportJson = useCallback(() => {
    downloadText('consume-chains.json', 'application/json', rowsToJson(filteredRows))
  }, [filteredRows])

  const handleCopyCurl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toCurl(requestUrl))
      notifyStatus('请求 curl 已复制。')
    } catch (clipboardError) {
      notifyError(errorMessage(clipboardError, '剪贴板不可用'))
    }
  }, [notifyError, notifyStatus, requestUrl])

  const handlePickNode = useCallback(
    (pubkey: string) => {
      setMode('node')
      setNodeId(pubkey)
      notifyStatus('已将所选节点公钥填入查询，请点击加载。')
    },
    [notifyStatus, setMode, setNodeId],
  )

  return {
    handleCopyCurl,
    handleExportCsv,
    handleExportJson,
    handlePickNode,
  }
}
