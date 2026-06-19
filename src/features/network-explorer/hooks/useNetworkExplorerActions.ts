import { useCallback } from 'react'
import { downloadText } from '../../../shared/utils/downloadText'
import { edgesToCsv, rowsToJson, toCurl } from '../../../lib/exporters'
import { errorMessage } from '../../../lib/errors'
import type { ChainGraphEdge, ConsumeChainResponseDTO } from '../../../lib/types'

export function useNetworkExplorerActions({
  filteredRows,
  graphEdges,
  notifyError,
  notifyStatus,
  requestUrl,
}: {
  filteredRows: ConsumeChainResponseDTO[]
  graphEdges: ChainGraphEdge[]
  notifyError: (error: string | null) => void
  notifyStatus: (status: string | null) => void
  requestUrl: string
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

  return {
    handleCopyCurl,
    handleExportCsv,
    handleExportJson,
  }
}
